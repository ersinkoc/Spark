# Middleware Architecture

Learn advanced middleware patterns and build sophisticated middleware architectures for complex applications.

## Middleware Execution Flow

Understanding the middleware execution model is crucial for building efficient applications:

```javascript
const { Spark } = require('@oxog/spark');
const app = new Spark();

// Middleware execution order demonstration
app.use((ctx, next) => {
  console.log('1. Before first middleware');
  const start = Date.now();
  
  return next().then(() => {
    console.log('6. After first middleware');
    ctx.set('X-Response-Time', `${Date.now() - start}ms`);
  });
});

app.use((ctx, next) => {
  console.log('2. Before second middleware');
  ctx.requestId = Math.random().toString(36).substr(2, 9);
  
  return next().then(() => {
    console.log('5. After second middleware');
    ctx.set('X-Request-ID', ctx.requestId);
  });
});

app.get('/test', (ctx) => {
  console.log('3. In route handler');
  ctx.json({ 
    message: 'Hello',
    requestId: ctx.requestId,
    timestamp: Date.now()
  });
  console.log('4. After route handler');
});

// Execution order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
```

## Middleware Composition Patterns

### 1. Functional Composition

```javascript
// Compose multiple middleware functions
function compose(...middlewares) {
  return (ctx, next) => {
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

// Usage
const authMiddleware = compose(
  sessionMiddleware,
  parseJWT,
  validateUser,
  checkPermissions
);

app.use('/api/protected', authMiddleware);
```

### 2. Conditional Middleware

```javascript
// Middleware that conditionally applies other middleware
function conditional(condition, middleware) {
  return async (ctx, next) => {
    if (typeof condition === 'function' ? condition(ctx) : condition) {
      return middleware(ctx, next);
    }
    return next();
  };
}

// Apply rate limiting only to API routes
app.use(conditional(
  (ctx) => ctx.path.startsWith('/api'),
  rateLimit({ max: 100, windowMs: 60000 })
));

// Apply compression only to large responses
app.use(conditional(
  (ctx) => ctx.get('content-length') > 1024,
  compression()
));
```

### 3. Pipeline Middleware

```javascript
// Create processing pipelines
class MiddlewarePipeline {
  constructor() {
    this.stages = [];
  }
  
  addStage(name, middleware) {
    this.stages.push({ name, middleware });
    return this;
  }
  
  execute() {
    return async (ctx, next) => {
      let currentStage = 0;
      
      async function processStage() {
        if (currentStage >= this.stages.length) {
          return next();
        }
        
        const stage = this.stages[currentStage];
        console.log(`Processing stage: ${stage.name}`);
        
        currentStage++;
        return stage.middleware(ctx, processStage);
      }
      
      return processStage.call(this);
    };
  }
}

// Request processing pipeline
const requestPipeline = new MiddlewarePipeline()
  .addStage('validation', validateRequest)
  .addStage('authentication', authenticateUser)
  .addStage('authorization', authorizeAccess)
  .addStage('transformation', transformData)
  .addStage('caching', cacheResponse);

app.use('/api/users', requestPipeline.execute());
```

## Advanced Middleware Patterns

### 1. Middleware Factory

```javascript
// Factory for creating configurable middleware
function createMiddlewareFactory(type, defaultConfig = {}) {
  const middlewareMap = {
    auth: (config) => createAuthMiddleware(config),
    validation: (config) => createValidationMiddleware(config),
    logging: (config) => createLoggingMiddleware(config),
    caching: (config) => createCachingMiddleware(config)
  };
  
  return (config = {}) => {
    const finalConfig = { ...defaultConfig, ...config };
    const factory = middlewareMap[type];
    
    if (!factory) {
      throw new Error(`Unknown middleware type: ${type}`);
    }
    
    return factory(finalConfig);
  };
}

// Auth middleware factory
function createAuthMiddleware(config) {
  return async (ctx, next) => {
    const token = ctx.get(config.header || 'authorization');
    
    if (!token && config.required) {
      return ctx.status(401).json({ error: 'Authentication required' });
    }
    
    if (token) {
      try {
        ctx.user = await verifyToken(token, config.secret);
      } catch (error) {
        return ctx.status(401).json({ error: 'Invalid token' });
      }
    }
    
    return next();
  };
}

// Usage
const authFactory = createMiddlewareFactory('auth', {
  header: 'authorization',
  required: true,
  secret: process.env.JWT_SECRET
});

app.use('/api/admin', authFactory({ required: true }));
app.use('/api/optional', authFactory({ required: false }));
```

### 2. Middleware Decorators

```javascript
// Decorator for adding middleware to routes
function withMiddleware(...middlewares) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(ctx, next) {
      const composed = compose(...middlewares, originalMethod);
      return composed(ctx, next);
    };
    
    return descriptor;
  };
}

// Class-based route handlers with middleware decorators
class UserController {
  @withMiddleware(authenticateUser, validateUserAccess)
  async getProfile(ctx) {
    ctx.json({ profile: ctx.user });
  }
  
  @withMiddleware(authenticateUser, requireAdmin, validateInput)
  async updateUser(ctx) {
    ctx.json({ message: 'User updated' });
  }
}
```

### 3. Middleware Hooks

```javascript
// Hook system for middleware
class MiddlewareHooks {
  constructor() {
    this.hooks = {
      before: [],
      after: [],
      error: []
    };
  }
  
  before(fn) {
    this.hooks.before.push(fn);
    return this;
  }
  
  after(fn) {
    this.hooks.after.push(fn);
    return this;
  }
  
  error(fn) {
    this.hooks.error.push(fn);
    return this;
  }
  
  middleware() {
    return async (ctx, next) => {
      try {
        // Execute before hooks
        for (const hook of this.hooks.before) {
          await hook(ctx);
        }
        
        await next();
        
        // Execute after hooks
        for (const hook of this.hooks.after) {
          await hook(ctx);
        }
      } catch (error) {
        // Execute error hooks
        for (const hook of this.hooks.error) {
          await hook(ctx, error);
        }
        throw error;
      }
    };
  }
}

// Usage
const hooks = new MiddlewareHooks()
  .before((ctx) => console.log('Before request'))
  .after((ctx) => console.log('After request'))
  .error((ctx, error) => console.error('Error:', error));

app.use('/api', hooks.middleware());
```

## Performance Optimization

### 1. Middleware Caching

```javascript
// Cache middleware results
function cacheMiddleware(keyGenerator, ttl = 60000) {
  const cache = new Map();
  
  return async (ctx, next) => {
    const key = keyGenerator(ctx);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      Object.assign(ctx, cached.context);
      return next();
    }
    
    const originalContext = { ...ctx };
    await next();
    
    // Cache context changes
    cache.set(key, {
      context: { ...ctx },
      timestamp: Date.now()
    });
  };
}

// Usage
app.use(cacheMiddleware(
  (ctx) => `user:${ctx.user?.id}:permissions`,
  300000 // 5 minutes
));
```

### 2. Lazy Loading Middleware

```javascript
// Lazy load expensive middleware
function lazyMiddleware(loader) {
  let cached = null;
  
  return async (ctx, next) => {
    if (!cached) {
      cached = await loader();
    }
    
    return cached(ctx, next);
  };
}

// Usage
app.use('/api/heavy', lazyMiddleware(async () => {
  const heavyLibrary = await import('./heavy-processing');
  return heavyLibrary.createMiddleware();
}));
```

### 3. Middleware Pooling

```javascript
// Pool expensive middleware instances
class MiddlewarePool {
  constructor(factory, maxSize = 10) {
    this.factory = factory;
    this.pool = [];
    this.maxSize = maxSize;
    this.active = 0;
  }
  
  async acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    if (this.active < this.maxSize) {
      this.active++;
      return this.factory();
    }
    
    // Wait for an instance to become available
    return new Promise((resolve) => {
      const check = () => {
        if (this.pool.length > 0) {
          resolve(this.pool.pop());
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }
  
  release(instance) {
    this.pool.push(instance);
  }
  
  middleware() {
    return async (ctx, next) => {
      const instance = await this.acquire();
      
      try {
        await instance(ctx, next);
      } finally {
        this.release(instance);
      }
    };
  }
}

// Usage
const processingPool = new MiddlewarePool(
  () => createExpensiveProcessor(),
  5
);

app.use('/api/process', processingPool.middleware());
```

## Error Handling in Middleware

### 1. Error Boundary Middleware

```javascript
// Error boundary that catches and handles errors
function errorBoundary(options = {}) {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      // Log error with context
      console.error('Error in middleware:', {
        error: error.message,
        stack: error.stack,
        path: ctx.path,
        method: ctx.method,
        user: ctx.user?.id,
        requestId: ctx.requestId
      });
      
      // Custom error handling
      if (options.onError) {
        await options.onError(error, ctx);
      }
      
      // Send appropriate response
      if (error.status) {
        ctx.status(error.status).json({
          error: error.message,
          code: error.code
        });
      } else {
        ctx.status(500).json({
          error: 'Internal server error',
          requestId: ctx.requestId
        });
      }
    }
  };
}

// Usage
app.use(errorBoundary({
  onError: async (error, ctx) => {
    // Send to error tracking service
    await errorTracker.report(error, {
      user: ctx.user,
      path: ctx.path,
      requestId: ctx.requestId
    });
  }
}));
```

### 2. Circuit Breaker Middleware

```javascript
// Circuit breaker pattern for external services
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  middleware() {
    return async (ctx, next) => {
      try {
        await this.execute(() => next());
      } catch (error) {
        if (error.message === 'Circuit breaker is OPEN') {
          ctx.status(503).json({
            error: 'Service temporarily unavailable',
            retryAfter: Math.ceil(this.resetTimeout / 1000)
          });
        } else {
          throw error;
        }
      }
    };
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000
});

app.use('/api/database', dbCircuitBreaker.middleware());
```

## Testing Middleware

### 1. Middleware Testing Framework

```javascript
// Testing framework for middleware
class MiddlewareTest {
  constructor() {
    this.mockCtx = {
      method: 'GET',
      path: '/',
      query: {},
      params: {},
      headers: {},
      body: null,
      status: (code) => ({ json: (data) => ({ status: code, data }) }),
      json: (data) => ({ data }),
      set: (key, value) => { this.headers[key] = value; },
      get: (key) => this.headers[key]
    };
  }
  
  async test(middleware, ctx = {}) {
    const testCtx = { ...this.mockCtx, ...ctx };
    let nextCalled = false;
    
    const next = () => {
      nextCalled = true;
      return Promise.resolve();
    };
    
    const result = await middleware(testCtx, next);
    
    return {
      context: testCtx,
      nextCalled,
      result
    };
  }
}

// Test authentication middleware
async function testAuthMiddleware() {
  const test = new MiddlewareTest();
  
  // Test without token
  const result1 = await test.test(authenticateUser, {
    get: () => null
  });
  
  console.assert(result1.nextCalled === false, 'Should not call next without token');
  
  // Test with valid token
  const result2 = await test.test(authenticateUser, {
    get: () => 'valid-token'
  });
  
  console.assert(result2.nextCalled === true, 'Should call next with valid token');
  console.assert(result2.context.user !== undefined, 'Should set user in context');
}
```

### 2. Integration Testing

```javascript
// Integration testing for middleware chains
async function testMiddlewareChain() {
  const app = new Spark();
  
  // Add middleware chain
  app.use(authenticateUser);
  app.use(validatePermissions);
  app.use(logRequest);
  
  app.get('/test', (ctx) => {
    ctx.json({ message: 'Success' });
  });
  
  // Test with supertest-like functionality
  const response = await request(app)
    .get('/test')
    .set('Authorization', 'Bearer valid-token')
    .expect(200);
  
  console.assert(response.body.message === 'Success', 'Should return success message');
}
```

## Middleware Documentation

### 1. Self-Documenting Middleware

```javascript
// Middleware with built-in documentation
function documentedMiddleware(spec) {
  const middleware = async (ctx, next) => {
    // Middleware logic here
    return next();
  };
  
  // Add documentation metadata
  middleware.documentation = {
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters || [],
    effects: spec.effects || [],
    dependencies: spec.dependencies || [],
    examples: spec.examples || []
  };
  
  return middleware;
}

// Usage
const authMiddleware = documentedMiddleware({
  name: 'Authentication',
  description: 'Validates JWT tokens and sets user context',
  parameters: [
    { name: 'header', description: 'Authorization header name', default: 'authorization' }
  ],
  effects: [
    'Sets ctx.user if token is valid',
    'Returns 401 if token is invalid or missing'
  ],
  dependencies: ['jsonwebtoken'],
  examples: [
    'app.use(authMiddleware({ required: true }))',
    'app.use(\'/api/admin\', authMiddleware({ role: \'admin\' }))'
  ]
});
```

### 2. Middleware Registry

```javascript
// Registry for managing middleware
class MiddlewareRegistry {
  constructor() {
    this.middlewares = new Map();
  }
  
  register(name, middleware) {
    this.middlewares.set(name, middleware);
    return this;
  }
  
  get(name) {
    return this.middlewares.get(name);
  }
  
  getDocumentation(name) {
    const middleware = this.get(name);
    return middleware?.documentation || null;
  }
  
  list() {
    return Array.from(this.middlewares.keys());
  }
  
  generateDocs() {
    const docs = [];
    
    for (const [name, middleware] of this.middlewares) {
      if (middleware.documentation) {
        docs.push({
          name,
          ...middleware.documentation
        });
      }
    }
    
    return docs;
  }
}

// Usage
const registry = new MiddlewareRegistry()
  .register('auth', authMiddleware)
  .register('validation', validationMiddleware)
  .register('logging', loggingMiddleware);

// Generate documentation endpoint
app.get('/api/docs/middleware', (ctx) => {
  ctx.json(registry.generateDocs());
});
```

## Best Practices

### 1. Middleware Composition Guidelines

```javascript
// Good: Composable, single responsibility
const authFlow = compose(
  parseToken,
  validateToken,
  loadUser,
  checkPermissions
);

// Bad: Monolithic, multiple responsibilities
const badAuthMiddleware = async (ctx, next) => {
  // Token parsing, validation, user loading, permission checking all in one
};
```

### 2. Error Handling Best Practices

```javascript
// Good: Proper error handling and propagation
const safeMiddleware = async (ctx, next) => {
  try {
    await someOperation();
    await next();
  } catch (error) {
    // Log and re-throw for upstream handling
    console.error('Middleware error:', error);
    throw error;
  }
};

// Bad: Swallowing errors
const badMiddleware = async (ctx, next) => {
  try {
    await someOperation();
    await next();
  } catch (error) {
    // Silently ignoring errors
  }
};
```

### 3. Performance Considerations

```javascript
// Good: Efficient middleware ordering
app.use(compression); // Fast
app.use(staticFiles); // Fast for static files
app.use(authentication); // Moderate
app.use(databaseConnection); // Slow
app.use(heavyProcessing); // Slowest

// Bad: Inefficient ordering
app.use(heavyProcessing); // Slow middleware first
app.use(authentication); // Could fail early
```

You now have the tools to build sophisticated middleware architectures that are performant, testable, and maintainable!

## What's Next?

Ready to explore more advanced patterns?

👉 **Next Guide:** [Database Integration](03-database-integration.md)

You'll learn:
- Database connection patterns
- Query optimization
- Transaction handling
- Connection pooling

Keep building! 🚀