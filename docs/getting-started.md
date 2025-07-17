# Getting Started with @oxog/spark

Welcome to @oxog/spark, a zero-dependency, ultra-fast Node.js API framework built for performance and security.

## Installation

```bash
npm install @oxog/spark
```

## Quick Start

### Basic Server

```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### With Middleware

```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

// Add middleware
app.use(app.middleware.cors());
app.use(app.middleware.bodyParser());
app.use(app.middleware.compression());

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World!' });
});

app.post('/api/users', (ctx) => {
  console.log('Received:', ctx.body);
  ctx.status(201).json({ id: 1, ...ctx.body });
});

app.listen(3000);
```

## Core Concepts

### Context Object

The context object (`ctx`) contains request and response information:

```javascript
app.get('/info', (ctx) => {
  console.log('Method:', ctx.method);
  console.log('Path:', ctx.path);
  console.log('Query:', ctx.query);
  console.log('Headers:', ctx.headers);
  console.log('IP:', ctx.ip());
  
  ctx.json({
    method: ctx.method,
    path: ctx.path,
    userAgent: ctx.get('user-agent')
  });
});
```

### Middleware

Middleware functions have access to the context object and a `next` function:

```javascript
// Custom middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
});
```

### Router

Use the Router class for organizing routes:

```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const router = new Router();

router.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

router.post('/users', (ctx) => {
  ctx.status(201).json({ id: 1, ...ctx.body });
});

app.use('/api', router);
```

## Route Parameters

```javascript
app.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ userId: id });
});

app.get('/posts/:postId/comments/:commentId', (ctx) => {
  const { postId, commentId } = ctx.params;
  ctx.json({ postId, commentId });
});
```

## Query Parameters

```javascript
app.get('/search', (ctx) => {
  const { q, page = 1, limit = 10 } = ctx.query;
  ctx.json({ query: q, page, limit });
});
```

## Request Body

```javascript
app.use(app.middleware.bodyParser());

app.post('/api/data', (ctx) => {
  console.log('JSON body:', ctx.body);
  ctx.json({ received: ctx.body });
});
```

## File Uploads

```javascript
app.use(app.middleware.bodyParser());

app.post('/upload', (ctx) => {
  if (ctx.files && ctx.files.file) {
    const file = ctx.files.file;
    console.log('File:', file.filename, file.size);
    ctx.json({ filename: file.filename, size: file.size });
  } else {
    ctx.status(400).json({ error: 'No file uploaded' });
  }
});
```

## Error Handling

```javascript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    ctx.status(500).json({ error: 'Internal Server Error' });
  }
});
```

## Built-in Middleware

### CORS

```javascript
app.use(app.middleware.cors({
  origin: 'https://example.com',
  methods: ['GET', 'POST'],
  credentials: true
}));
```

### Rate Limiting

```javascript
app.use(app.middleware.rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests'
}));
```

### Compression

```javascript
app.use(app.middleware.compression({
  threshold: 1024,
  level: 6
}));
```

### Static Files

```javascript
app.use('/static', app.middleware.static('./public'));
```

### Security Headers

```javascript
app.use(app.middleware.security({
  hsts: { maxAge: 31536000 },
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"]
  }
}));
```

### Sessions

```javascript
app.use(app.middleware.session({
  secret: 'your-secret-key',
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.get('/session', (ctx) => {
  ctx.session.views = (ctx.session.views || 0) + 1;
  ctx.json({ views: ctx.session.views });
});
```

## Response Methods

```javascript
app.get('/api/examples', (ctx) => {
  // JSON response
  ctx.json({ data: 'example' });
  
  // Text response
  ctx.text('Hello World');
  
  // HTML response
  ctx.html('<h1>Hello World</h1>');
  
  // Status code
  ctx.status(201).json({ created: true });
  
  // Headers
  ctx.set('X-Custom-Header', 'value');
  
  // Redirect
  ctx.redirect('/other-page');
  
  // Cookies
  ctx.setCookie('session', 'value', { httpOnly: true });
});
```

## Configuration

```javascript
const app = new Spark({
  port: 3000,
  cluster: true,
  compression: true,
  security: {
    cors: { origin: '*' },
    rateLimit: { max: 1000, window: 60000 }
  }
});
```

## Next Steps

- [API Reference](api-reference.md)
- [Middleware Guide](middleware-guide.md)
- [Security Best Practices](security-best-practices.md)
- [Deployment Guide](deployment.md)

## Examples

Check out the [examples](../examples/) directory for complete applications:

- [Basic API](../examples/basic-api/)
- [REST CRUD](../examples/rest-crud/)
- [File Upload](../examples/file-upload/)
- [E-commerce API](../examples/ecommerce-api/)

## Performance

@oxog/spark is designed for performance:

- **32,000+ requests/second** (basic JSON response)
- **<0.5ms overhead** per request
- **Zero dependencies** - only Node.js built-ins
- **Memory efficient** - minimal memory footprint
- **Cluster support** - automatic scaling across CPU cores

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { Spark, Context } from '@oxog/spark';

const app = new Spark();

app.get('/', (ctx: Context) => {
  ctx.json({ message: 'Hello TypeScript!' });
});
```