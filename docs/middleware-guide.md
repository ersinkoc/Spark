# Middleware Guide

Comprehensive guide to creating and using middleware in Spark.

## Table of Contents

- [What is Middleware?](#what-is-middleware)
- [Middleware Flow](#middleware-flow)
- [Creating Custom Middleware](#creating-custom-middleware)
- [Built-in Middleware](#built-in-middleware)
- [Advanced Patterns](#advanced-patterns)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)

## What is Middleware?

Middleware functions are functions that have access to the request context (`ctx`) and the `next` function in the application's request-response cycle. They can:

- Execute code before and after route handlers
- Modify the request/response
- End the request-response cycle
- Call the next middleware function in the stack

## Middleware Flow

```
Request → Middleware 1 → Middleware 2 → Route Handler → Middleware 2 → Middleware 1 → Response
```

Each middleware can:
1. Execute code before calling `next()`
2. Call `next()` to pass control to the next middleware
3. Execute code after `next()` returns
4. Skip calling `next()` to end the request cycle

## Creating Custom Middleware

### Basic Middleware Structure

```javascript
function myMiddleware(ctx, next) {
  // Code executed before next middleware
  console.log('Before next middleware');
  
  // Call next middleware
  const result = next();
  
  // Code executed after next middleware
  console.log('After next middleware');
  
  return result;
}
```

### Async Middleware

```javascript
async function asyncMiddleware(ctx, next) {
  // Async operation before
  const startTime = Date.now();
  
  try {
    await next();
  } finally {
    // Async operation after
    const duration = Date.now() - startTime;
    console.log(`Request took ${duration}ms`);
  }
}
```

### Middleware with Configuration

```javascript
function configurableMiddleware(options = {}) {
  const config = {
    enabled: true,
    prefix: '[MIDDLEWARE]',
    ...options
  };

  return function(ctx, next) {
    if (!config.enabled) {
      return next();
    }

    console.log(`${config.prefix} ${ctx.method} ${ctx.path}`);
    return next();
  };
}

// Usage
app.use(configurableMiddleware({
  prefix: '[LOG]',
  enabled: process.env.NODE_ENV !== 'production'
}));
```

## Built-in Middleware

### Body Parser

Parse request bodies from various content types.

```javascript
const bodyParser = require('@oxog/spark/middleware/body-parser');

app.use(bodyParser({
  limit: '10mb',
  type: ['json', 'form', 'text']
}));

app.post('/api/users', (ctx) => {
  console.log(ctx.body); // Parsed request body
  ctx.json({ received: ctx.body });
});
```

### CORS

Handle Cross-Origin Resource Sharing.

```javascript
const cors = require('@oxog/spark/middleware/cors');

app.use(cors({
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count']
}));
```

### Session Management

Handle user sessions with auto-save functionality.

```javascript
const session = require('@oxog/spark/middleware/session');

app.use(session({
  secret: 'your-secret-key',
  saveUninitialized: false,
  resave: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

app.get('/profile', (ctx) => {
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Not authenticated' });
  }
  
  ctx.json({ userId: ctx.session.userId });
});
```

### Rate Limiting

Limit request rates to prevent abuse.

```javascript
const rateLimit = require('@oxog/spark/middleware/rate-limit');

app.use(rateLimit({
  max: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (ctx) => ctx.ip || ctx.get('x-forwarded-for') || 'unknown'
}));
```

### Security Headers

Add security headers to responses.

```javascript
const security = require('@oxog/spark/middleware/security');

app.use(security({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  xssProtection: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Compression

Compress responses to reduce bandwidth.

```javascript
const compression = require('@oxog/spark/middleware/compression');

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    return compression.filter(req, res);
  }
}));
```

### Static Files

Serve static files with caching.

```javascript
const staticFiles = require('@oxog/spark/middleware/static');

app.use('/public', staticFiles({
  root: './public',
  maxAge: 86400000, // 1 day
  etag: true,
  lastModified: true,
  extensions: ['html', 'htm'],
  dotfiles: 'ignore'
}));
```

### Logger

Log requests with customizable format.

```javascript
const logger = require('@oxog/spark/middleware/logger');

app.use(logger({
  format: ':method :url :status :response-time ms :res[content-length]',
  skip: (ctx) => ctx.path.startsWith('/health')
}));
```

### Health Check

Monitor application health.

```javascript
const health = require('@oxog/spark/middleware/health');

app.use('/health', health({
  path: '/health',
  checks: {
    database: async () => {
      // Check database connection
      return await db.ping();
    },
    redis: async () => {
      // Check Redis connection
      return await redis.ping();
    },
    memory: () => {
      const usage = process.memoryUsage();
      return usage.heapUsed < 100 * 1024 * 1024; // 100MB
    }
  }
}));
```

## Advanced Patterns

### Conditional Middleware

```javascript
function conditionalMiddleware(condition, middleware) {
  return function(ctx, next) {
    if (condition(ctx)) {
      return middleware(ctx, next);
    }
    return next();
  };
}

app.use(conditionalMiddleware(
  (ctx) => ctx.path.startsWith('/api'),
  require('@oxog/spark/middleware/rate-limit')({ max: 100 })
));
```

### Middleware Composition

```javascript
function compose(...middlewares) {
  return function(ctx, next) {
    let index = -1;
    
    function dispatch(i) {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'));
      index = i;
      
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return Promise.resolve();
      
      try {
        return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    
    return dispatch(0);
  };
}

const authMiddleware = compose(
  require('@oxog/spark/middleware/session')({ secret: 'secret' }),
  require('@oxog/spark/middleware/rate-limit')({ max: 10 }),
  function requireAuth(ctx, next) {
    if (!ctx.session.userId) {
      return ctx.status(401).json({ error: 'Authentication required' });
    }
    return next();
  }
);

app.use('/api/protected', authMiddleware);
```

### Router-Level Middleware

```javascript
const { Router } = require('@oxog/spark');

const api = new Router();

// Router-level middleware
api.use(require('@oxog/spark/middleware/body-parser')());
api.use(require('@oxog/spark/middleware/cors')());

// Route-specific middleware
api.get('/users', 
  require('@oxog/spark/middleware/rate-limit')({ max: 50 }),
  (ctx) => ctx.json({ users: [] })
);

app.use('/api', api.routes());
```

## Error Handling

### Global Error Handler

```javascript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Request error:', error);
    
    // Set status code
    ctx.status(error.status || error.statusCode || 500);
    
    // Development vs Production error response
    if (process.env.NODE_ENV === 'development') {
      ctx.json({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    } else {
      ctx.json({
        error: {
          message: error.status < 500 ? error.message : 'Internal Server Error'
        }
      });
    }
  }
});
```

### Custom Error Classes

```javascript
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.field = field;
  }
}

class NotFoundError extends Error {
  constructor(resource) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

// Middleware to handle specific error types
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.status(400).json({
        error: {
          type: 'validation',
          message: error.message,
          field: error.field
        }
      });
    } else if (error instanceof NotFoundError) {
      ctx.status(404).json({
        error: {
          type: 'not_found',
          message: error.message
        }
      });
    } else {
      throw error; // Re-throw for global error handler
    }
  }
});
```

## Performance Considerations

### Middleware Ordering

Order middleware by frequency of use and performance impact:

```javascript
// Fast middleware first
app.use(require('@oxog/spark/middleware/compression')());
app.use(require('@oxog/spark/middleware/security')());

// Session middleware (moderate performance impact)
app.use(require('@oxog/spark/middleware/session')({ secret: 'secret' }));

// Body parser (potentially slow for large payloads)
app.use(require('@oxog/spark/middleware/body-parser')({ limit: '1mb' }));

// Rate limiting (may involve external storage)
app.use(require('@oxog/spark/middleware/rate-limit')({ max: 100 }));
```

### Caching in Middleware

```javascript
const cache = new Map();

function cachingMiddleware(ttl = 60000) {
  return function(ctx, next) {
    if (ctx.method !== 'GET') {
      return next();
    }
    
    const key = ctx.path + JSON.stringify(ctx.query);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      ctx.set('X-Cache', 'HIT');
      return ctx.json(cached.data);
    }
    
    // Override json to cache response
    const originalJson = ctx.json;
    ctx.json = function(data) {
      cache.set(key, {
        data: data,
        timestamp: Date.now()
      });
      ctx.set('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };
    
    return next();
  };
}

app.use('/api/products', cachingMiddleware(300000)); // 5 minutes
```

## Best Practices

### 1. Keep Middleware Focused

Each middleware should have a single responsibility:

```javascript
// Good: Focused on authentication
function requireAuth(ctx, next) {
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

// Bad: Multiple responsibilities
function authAndLog(ctx, next) {
  console.log(`Request: ${ctx.method} ${ctx.path}`);
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Authentication required' });
  }
  return next();
}
```

### 2. Handle Errors Gracefully

```javascript
function safeMiddleware(ctx, next) {
  try {
    // Middleware logic
    return next();
  } catch (error) {
    console.error('Middleware error:', error);
    // Don't break the request chain
    return next();
  }
}
```

### 3. Use Configuration Objects

```javascript
function configurable(options = {}) {
  const config = {
    enabled: true,
    timeout: 5000,
    retries: 3,
    ...options
  };
  
  return function(ctx, next) {
    if (!config.enabled) {
      return next();
    }
    
    // Use config values
    setTimeout(() => {
      console.log('Middleware timeout');
    }, config.timeout);
    
    return next();
  };
}
```

### 4. Provide Clear Error Messages

```javascript
function validateApiKey(ctx, next) {
  const apiKey = ctx.get('x-api-key');
  
  if (!apiKey) {
    return ctx.status(401).json({
      error: 'API key is required',
      code: 'MISSING_API_KEY',
      hint: 'Include X-API-Key header in your request'
    });
  }
  
  if (!isValidApiKey(apiKey)) {
    return ctx.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
      hint: 'Check your API key and try again'
    });
  }
  
  return next();
}
```

### 5. Document Middleware

```javascript
/**
 * Rate limiting middleware
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.max - Maximum requests per window
 * @param {number} options.windowMs - Window duration in milliseconds
 * @param {string} options.message - Error message for rate limit exceeded
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 * @returns {Function} Middleware function
 */
function rateLimit(options = {}) {
  // Implementation
}
```

### 6. Test Middleware Thoroughly

```javascript
const request = require('supertest');
const { Spark } = require('@oxog/spark');

describe('Auth Middleware', () => {
  let app;
  
  beforeEach(() => {
    app = new Spark();
    app.use(requireAuth);
    app.get('/protected', (ctx) => ctx.json({ success: true }));
  });
  
  test('should return 401 without session', async () => {
    const response = await request(app.callback())
      .get('/protected');
    
    expect(response.status).toBe(401);
  });
  
  test('should allow access with valid session', async () => {
    // Set up session mock
    const response = await request(app.callback())
      .get('/protected')
      .set('Cookie', 'session=valid-session');
    
    expect(response.status).toBe(200);
  });
});
```

## Common Middleware Patterns

### Request ID Middleware

```javascript
const crypto = require('crypto');

function requestId(header = 'X-Request-ID') {
  return function(ctx, next) {
    const id = ctx.get(header) || crypto.randomUUID();
    ctx.set(header, id);
    ctx.requestId = id;
    return next();
  };
}
```

### Timeout Middleware

```javascript
function timeout(ms = 30000) {
  return function(ctx, next) {
    return Promise.race([
      next(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${ms}ms`));
        }, ms);
      })
    ]);
  };
}
```

### Content Negotiation

```javascript
function negotiate(types = ['json']) {
  return function(ctx, next) {
    const accepted = ctx.get('accept') || 'application/json';
    
    if (types.includes('json') && accepted.includes('application/json')) {
      ctx.type = 'json';
    } else if (types.includes('xml') && accepted.includes('application/xml')) {
      ctx.type = 'xml';
    } else {
      return ctx.status(406).json({
        error: 'Not Acceptable',
        supported: types
      });
    }
    
    return next();
  };
}
```

This comprehensive guide should help you understand and effectively use middleware in your Spark applications. Remember to always consider performance, error handling, and maintainability when creating custom middleware.
