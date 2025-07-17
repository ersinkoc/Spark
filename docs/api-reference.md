# API Reference

Complete reference documentation for the Spark framework.

## Table of Contents

- [Application](#application)
- [Router](#router)
- [Context](#context)
- [Middleware](#middleware)
- [Built-in Middleware](#built-in-middleware)
- [Error Handling](#error-handling)

## Application

The main Spark application class.

### Constructor

```javascript
const app = new Spark(options);
```

#### Options

- `port` (number) - Default port for the server (default: 3000)
- `security` (object) - Security configuration
  - `cors` (object) - CORS configuration
  - `csrf` (boolean) - Enable CSRF protection
  - `rateLimit` (object) - Rate limiting configuration

### Methods

#### `use(middleware)`

Add middleware to the application.

```javascript
app.use((ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  return next();
});
```

#### `use(path, middleware)`

Add middleware for a specific path.

```javascript
app.use('/api', apiMiddleware);
```

#### `get(path, ...handlers)`

Register a GET route.

```javascript
app.get('/users', (ctx) => {
  ctx.json({ users: [] });
});
```

#### `post(path, ...handlers)`

Register a POST route.

```javascript
app.post('/users', (ctx) => {
  const user = ctx.body;
  ctx.status(201).json({ user });
});
```

#### `put(path, ...handlers)`

Register a PUT route.

```javascript
app.put('/users/:id', (ctx) => {
  const { id } = ctx.params;
  const user = ctx.body;
  ctx.json({ id, ...user });
});
```

#### `delete(path, ...handlers)`

Register a DELETE route.

```javascript
app.delete('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.status(204).end();
});
```

#### `listen(port, callback)`

Start the server.

```javascript
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Router

Advanced routing system with support for parameters and middleware.

### Constructor

```javascript
const router = new Router();
```

### Methods

#### `get(path, ...handlers)`

Register a GET route on the router.

```javascript
router.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});
```

#### `post(path, ...handlers)`

Register a POST route on the router.

#### `put(path, ...handlers)`

Register a PUT route on the router.

#### `delete(path, ...handlers)`

Register a DELETE route on the router.

#### `use(middleware)`

Add middleware to the router.

```javascript
router.use((ctx, next) => {
  // Router-level middleware
  return next();
});
```

#### `routes()`

Get the router middleware function.

```javascript
app.use('/api', router.routes());
```

## Context

The request/response context object.

### Properties

#### `req`

The Node.js request object.

#### `res`

The Node.js response object.

#### `method`

The HTTP method (GET, POST, etc.).

#### `path`

The request path.

#### `query`

Parsed query string parameters.

```javascript
// GET /users?limit=10&offset=20
ctx.query.limit  // '10'
ctx.query.offset // '20'
```

#### `params`

Route parameters.

```javascript
// Route: /users/:id
// URL: /users/123
ctx.params.id // '123'
```

#### `body`

Parsed request body (requires body-parser middleware).

#### `headers`

Request headers.

#### `cookies`

Parsed cookies.

#### `session`

Session object (requires session middleware).

### Methods

#### `get(headerName)`

Get a request header.

```javascript
const userAgent = ctx.get('user-agent');
```

#### `set(headerName, value)`

Set a response header.

```javascript
ctx.set('content-type', 'application/json');
```

#### `status(code)`

Set the response status code.

```javascript
ctx.status(404);
```

#### `json(data)`

Send a JSON response.

```javascript
ctx.json({ message: 'Hello World' });
```

#### `text(data)`

Send a text response.

```javascript
ctx.text('Hello World');
```

#### `html(data)`

Send an HTML response.

```javascript
ctx.html('<h1>Hello World</h1>');
```

#### `redirect(url, status)`

Redirect to a URL.

```javascript
ctx.redirect('/login'); // 302 redirect
ctx.redirect('/login', 301); // 301 redirect
```

#### `setCookie(name, value, options)`

Set a cookie.

```javascript
ctx.setCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600000 // 1 hour
});
```

#### `clearCookie(name)`

Clear a cookie.

```javascript
ctx.clearCookie('session');
```

## Middleware

Middleware functions have access to the context object and next function.

### Structure

```javascript
async function middleware(ctx, next) {
  // Do something before
  await next();
  // Do something after
}
```

### Error Handling

```javascript
async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (error) {
    ctx.status(500).json({ error: error.message });
  }
}
```

## Built-in Middleware

### Body Parser

Parse request bodies.

```javascript
const bodyParser = require('@oxog/spark/middleware/body-parser');

app.use(bodyParser({
  limit: '1mb',
  type: 'json'
}));
```

### CORS

Handle Cross-Origin Resource Sharing.

```javascript
const cors = require('@oxog/spark/middleware/cors');

app.use(cors({
  origin: 'https://example.com',
  credentials: true
}));
```

### Session

Session management with auto-save.

```javascript
const session = require('@oxog/spark/middleware/session');

app.use(session({
  secret: 'your-secret-key',
  saveUninitialized: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

### Security

Security headers and protection.

```javascript
const security = require('@oxog/spark/middleware/security');

app.use(security({
  contentSecurityPolicy: true,
  xssProtection: true,
  noSniff: true
}));
```

### Rate Limiting

Request rate limiting.

```javascript
const rateLimit = require('@oxog/spark/middleware/rate-limit');

app.use(rateLimit({
  max: 100,
  windowMs: 60000, // 1 minute
  message: 'Too many requests'
}));
```

### Compression

Response compression.

```javascript
const compression = require('@oxog/spark/middleware/compression');

app.use(compression({
  threshold: 1024,
  level: 6
}));
```

### Static Files

Serve static files.

```javascript
const staticFiles = require('@oxog/spark/middleware/static');

app.use('/public', staticFiles({
  root: './public',
  maxAge: 86400000 // 1 day
}));
```

### Logger

Request logging.

```javascript
const logger = require('@oxog/spark/middleware/logger');

app.use(logger({
  format: ':method :url :status :response-time ms'
}));
```

### Health Check

Health monitoring endpoints.

```javascript
const health = require('@oxog/spark/middleware/health');

app.use('/health', health({
  path: '/health',
  checks: {
    database: () => checkDatabase(),
    redis: () => checkRedis()
  }
}));
```

## Error Handling

### Custom Error Classes

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}
```

### Global Error Handler

```javascript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status(error.status || 500);
    ctx.json({
      error: {
        message: error.message,
        name: error.name,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  }
});
```

### Error Events

```javascript
app.on('error', (error, ctx) => {
  console.error('Application error:', error);
  // Log to external service
});
```

## TypeScript Support

Full TypeScript definitions are included.

```typescript
import { Spark, Router, Context } from '@oxog/spark';

const app = new Spark();

app.get('/', (ctx: Context) => {
  ctx.json({ message: 'Hello TypeScript!' });
});
```

## Examples

### Complete API Server

```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const api = new Router();

// Middleware
app.use(require('@oxog/spark/middleware/logger')());
app.use(require('@oxog/spark/middleware/cors')());
app.use(require('@oxog/spark/middleware/body-parser')());

// Routes
api.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

api.post('/users', (ctx) => {
  const user = ctx.body;
  ctx.status(201).json({ user });
});

// Mount router
app.use('/api/v1', api.routes());

// Start server
app.listen(3000);
```

### Authentication Example

```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const api = new Router();

// Session middleware
app.use(require('@oxog/spark/middleware/session')({
  secret: 'your-secret-key',
  saveUninitialized: true
}));

// Authentication middleware
function requireAuth(ctx, next) {
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

// Login
api.post('/auth/login', (ctx) => {
  const { email, password } = ctx.body;
  
  if (authenticate(email, password)) {
    ctx.session.userId = user.id;
    ctx.json({ success: true });
  } else {
    ctx.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected route
api.get('/profile', requireAuth, (ctx) => {
  const user = getUserById(ctx.session.userId);
  ctx.json({ user });
});

app.use('/api', api.routes());
app.listen(3000);
```