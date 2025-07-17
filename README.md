# ⚡ Spark

A fast, lightweight, and zero-dependency Node.js web framework built for performance and simplicity.

[![npm version](https://badge.fury.io/js/@oxog/spark.svg)](https://badge.fury.io/js/@oxog/spark)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)

## 🚀 Features

- **Zero Dependencies** - No external dependencies, pure Node.js
- **High Performance** - Built for speed with optimized request handling
- **Middleware Support** - Express-like middleware system
- **Advanced Router** - Powerful routing with parameter support
- **Session Management** - Built-in session handling with auto-save
- **Security First** - CORS, CSRF, rate limiting, and security headers
- **TypeScript Support** - Full TypeScript definitions included
- **Memory Efficient** - Optimized for low memory usage
- **Easy to Use** - Simple, intuitive API

## 📦 Installation

```bash
npm install @oxog/spark
```

## 🌟 Quick Start

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

## 📚 Documentation

### 🎯 **Quick Links**
- **[📖 Complete Documentation](docs/README.md)** - Full documentation index
- **[🚀 Getting Started](docs/getting-started.md)** - Quick start guide
- **[📋 API Reference](docs/api-reference.md)** - Complete API documentation
- **[🔧 Middleware Guide](docs/middleware-guide.md)** - Comprehensive middleware guide

### 📈 **Learning Path**
- **[🟢 Beginner Level](docs/beginner/)** - Start here if you're new to Spark
- **[🟡 Intermediate Level](docs/intermediate/)** - Build sophisticated applications
- **[🔴 Expert Level](docs/expert/)** - Master advanced patterns and architecture

### 🛡️ **Production Ready**
- **[Security Best Practices](docs/security-best-practices.md)** - Security guidelines
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions

## 🔧 Core Components

### Application
The main Spark application class that handles server lifecycle, middleware, and routing.

### Router
Advanced routing system with support for parameters, middleware, and nested routes.

### Context
Request/response context object with helper methods for common operations.

### Middleware
Extensible middleware system with built-in middleware for common tasks.

## 🛠️ Built-in Middleware

- **Body Parser** - Parse JSON, form data, and text
- **CORS** - Cross-origin resource sharing
- **Session** - Session management with auto-save functionality
- **Security** - Security headers and protection
- **Rate Limiting** - Request rate limiting
- **Compression** - Response compression
- **Static Files** - Static file serving
- **Logger** - Request logging
- **Health Check** - Health monitoring endpoints

## 📊 Performance

Spark is designed for high performance with minimal overhead:

- **~4000 req/sec** on standard hardware
- **<1ms** average response time
- **<50MB** memory footprint
- **Zero** external dependencies

## 🏗️ Architecture

```
┌─────────────────┐
│   Application   │
├─────────────────┤
│   Middleware    │
├─────────────────┤
│     Router      │
├─────────────────┤
│    Context      │
├─────────────────┤
│   HTTP Server   │
└─────────────────┘
```

## 🔒 Security

Spark includes built-in security features:

- CORS protection
- CSRF protection  
- Rate limiting
- Security headers
- Input validation
- XSS protection

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:examples

# Run performance benchmarks
npm run benchmark
```

## 📈 Examples

### Basic API
```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

app.get('/users', (ctx) => {
  ctx.json([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]);
});

app.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ id, name: 'User ' + id });
});

app.listen(3000);
```

### With Middleware
```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

// Global middleware
app.use(require('@oxog/spark/middleware/logger')());
app.use(require('@oxog/spark/middleware/cors')());

// Route-specific middleware
app.get('/protected', 
  require('@oxog/spark/middleware/auth'),
  (ctx) => {
    ctx.json({ message: 'Protected route' });
  }
);

app.listen(3000);
```

### E-commerce API with Sessions
```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const api = new Router();

// Session middleware with auto-save
app.use(require('@oxog/spark/middleware/session')({
  secret: 'your-secret-key',
  saveUninitialized: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Authentication
api.post('/auth/login', (ctx) => {
  const { email, password } = ctx.body;
  
  if (authenticate(email, password)) {
    ctx.session.userId = user.id; // Auto-saved immediately
    ctx.json({ success: true });
  } else {
    ctx.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected routes
api.get('/orders', requireAuth, (ctx) => {
  const orders = getOrdersByUser(ctx.session.userId);
  ctx.json({ orders });
});

app.use('/api', api.routes());
app.listen(3000);
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Documentation](docs/)
- [Examples](examples/)
- [Issues](https://github.com/oxog/spark/issues)
- [Changelog](CHANGELOG.md)

## 🌟 Support

If you find Spark useful, please consider giving it a star on GitHub!

---

Built with ❤️ by the Spark team