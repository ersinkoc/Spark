# Getting Started with Spark

This guide will help you get started with Spark, a fast and lightweight Node.js web framework.

## Installation

Install Spark using npm:

```bash
npm install @oxog/spark
```

## Your First Spark Application

Create a new file called `app.js`:

```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello, Spark!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run your application:

```bash
node app.js
```

Visit `http://localhost:3000` in your browser to see your app in action!

## Basic Routing

Spark supports all standard HTTP methods:

```javascript
const { Spark } = require('@oxog/spark');
const app = new Spark();

// GET route
app.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

// POST route
app.post('/users', (ctx) => {
  const user = ctx.body;
  ctx.status(201).json({ user });
});

// PUT route
app.put('/users/:id', (ctx) => {
  const { id } = ctx.params;
  const user = ctx.body;
  ctx.json({ id, ...user });
});

// DELETE route
app.delete('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.status(204).end();
});

app.listen(3000);
```

## Route Parameters

Use route parameters to capture values from the URL:

```javascript
app.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ userId: id });
});

app.get('/users/:id/posts/:postId', (ctx) => {
  const { id, postId } = ctx.params;
  ctx.json({ userId: id, postId });
});
```

## Query Parameters

Access query parameters through `ctx.query`:

```javascript
app.get('/search', (ctx) => {
  const { q, limit = 10 } = ctx.query;
  ctx.json({ 
    query: q, 
    limit: parseInt(limit),
    results: [] 
  });
});

// GET /search?q=nodejs&limit=5
```

## Request Body

Parse request bodies using the body-parser middleware:

```javascript
const { Spark } = require('@oxog/spark');
const bodyParser = require('@oxog/spark/middleware/body-parser');

const app = new Spark();

app.use(bodyParser());

app.post('/users', (ctx) => {
  const { name, email } = ctx.body;
  ctx.status(201).json({ 
    id: 1, 
    name, 
    email 
  });
});

app.listen(3000);
```

## Middleware

Middleware functions execute during the request/response cycle:

### Global Middleware

```javascript
const { Spark } = require('@oxog/spark');
const app = new Spark();

// Global middleware
app.use((ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  return next();
});

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});

app.listen(3000);
```

### Route-Specific Middleware

```javascript
// Authentication middleware
function requireAuth(ctx, next) {
  const token = ctx.get('authorization');
  if (!token) {
    return ctx.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.get('/protected', requireAuth, (ctx) => {
  ctx.json({ message: 'Protected resource' });
});
```

### Multiple Middleware

```javascript
app.get('/admin', 
  requireAuth,
  requireAdmin,
  (ctx) => {
    ctx.json({ message: 'Admin area' });
  }
);
```

## Using Routers

Organize your routes using routers:

```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const api = new Router();

// API routes
api.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

api.post('/users', (ctx) => {
  const user = ctx.body;
  ctx.status(201).json({ user });
});

// Mount the router
app.use('/api/v1', api.routes());

app.listen(3000);
```

## Error Handling

Handle errors gracefully:

```javascript
const { Spark } = require('@oxog/spark');
const app = new Spark();

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    ctx.status(error.status || 500);
    ctx.json({
      error: {
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  }
});

app.get('/error', (ctx) => {
  throw new Error('Something went wrong!');
});

app.listen(3000);
```

## Common Middleware

### CORS

Enable Cross-Origin Resource Sharing:

```javascript
const cors = require('@oxog/spark/middleware/cors');

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
```

### Compression

Compress responses:

```javascript
const compression = require('@oxog/spark/middleware/compression');

app.use(compression());
```

### Static Files

Serve static files:

```javascript
const staticFiles = require('@oxog/spark/middleware/static');

app.use('/public', staticFiles({
  root: './public'
}));
```

### Request Logging

Log requests:

```javascript
const logger = require('@oxog/spark/middleware/logger');

app.use(logger({
  format: ':method :url :status :response-time ms'
}));
```

### Rate Limiting

Limit request rates:

```javascript
const rateLimit = require('@oxog/spark/middleware/rate-limit');

app.use(rateLimit({
  max: 100,
  windowMs: 60000 // 1 minute
}));
```

## Sessions

Use sessions for user authentication:

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

app.post('/login', (ctx) => {
  const { email, password } = ctx.body;
  
  if (authenticate(email, password)) {
    ctx.session.userId = user.id;
    ctx.json({ success: true });
  } else {
    ctx.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/profile', (ctx) => {
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = getUserById(ctx.session.userId);
  ctx.json({ user });
});
```

## Complete Example

Here's a complete example that puts it all together:

```javascript
const { Spark, Router } = require('@oxog/spark');

// Import middleware
const bodyParser = require('@oxog/spark/middleware/body-parser');
const cors = require('@oxog/spark/middleware/cors');
const logger = require('@oxog/spark/middleware/logger');
const session = require('@oxog/spark/middleware/session');

const app = new Spark();

// Global middleware
app.use(logger());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(bodyParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  saveUninitialized: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// In-memory user store (use a database in production)
const users = [];
let nextId = 1;

// Authentication middleware
function requireAuth(ctx, next) {
  if (!ctx.session.userId) {
    return ctx.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

// API router
const api = new Router();

// Auth routes
api.post('/auth/register', (ctx) => {
  const { name, email, password } = ctx.body;
  
  // Check if user exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return ctx.status(409).json({ error: 'User already exists' });
  }
  
  // Create user
  const user = {
    id: nextId++,
    name,
    email,
    password // Hash this in production!
  };
  users.push(user);
  
  // Log in user
  ctx.session.userId = user.id;
  
  ctx.status(201).json({
    user: { id: user.id, name: user.name, email: user.email }
  });
});

api.post('/auth/login', (ctx) => {
  const { email, password } = ctx.body;
  
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return ctx.status(401).json({ error: 'Invalid credentials' });
  }
  
  ctx.session.userId = user.id;
  ctx.json({
    user: { id: user.id, name: user.name, email: user.email }
  });
});

api.post('/auth/logout', (ctx) => {
  ctx.session.destroy();
  ctx.json({ message: 'Logged out successfully' });
});

// Protected routes
api.get('/profile', requireAuth, (ctx) => {
  const user = users.find(u => u.id === ctx.session.userId);
  ctx.json({
    user: { id: user.id, name: user.name, email: user.email }
  });
});

api.get('/users', requireAuth, (ctx) => {
  const publicUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email
  }));
  ctx.json({ users: publicUsers });
});

// Mount API routes
app.use('/api', api.routes());

// Health check
app.get('/health', (ctx) => {
  ctx.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 Health check: http://localhost:${port}/health`);
});
```

## Environment Variables

Use environment variables for configuration:

```javascript
const app = new Spark({
  port: process.env.PORT || 3000,
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001'
    }
  }
});
```

Create a `.env` file:

```
PORT=3000
CORS_ORIGIN=http://localhost:3001
SESSION_SECRET=your-super-secret-key
NODE_ENV=development
```

## Next Steps

- Read the [API Reference](api-reference.md) for detailed documentation
- Check out the [Middleware Guide](middleware-guide.md) for advanced middleware usage
- Learn about [Security Best Practices](security-best-practices.md)
- See the [Deployment Guide](deployment.md) for production deployment

## Examples

Check out the `examples/` directory for complete working examples:

- `basic-api/` - Simple REST API
- `ecommerce-api/` - E-commerce API with authentication
- `file-upload/` - File upload handling
- `rest-crud/` - Complete CRUD operations

## Getting Help

- Read the documentation in the `docs/` folder
- Check the [GitHub Issues](https://github.com/oxog/spark/issues) for known problems
- Open a new issue if you find a bug or have a feature request

Welcome to Spark! 🎉