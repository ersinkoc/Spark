# Advanced Routing Patterns

Master advanced routing techniques to build sophisticated web applications with Spark.

## Route Matching Algorithms

Understanding how Spark matches routes helps you design better APIs:

```javascript
const { Spark, Router } = require('@oxog/spark');
const app = new Spark();

// Route matching order is important
app.get('/users/profile', (ctx) => {
  ctx.json({ message: 'User profile' });
});

app.get('/users/:id', (ctx) => {
  ctx.json({ message: `User ${ctx.params.id}` });
});

// /users/profile will match the first route
// /users/123 will match the second route
```

## Dynamic Route Generation

Create routes programmatically:

```javascript
// Route generator function
function createCRUDRoutes(router, resource, controller) {
  const routes = [
    { method: 'get', path: `/${resource}`, handler: controller.getAll },
    { method: 'post', path: `/${resource}`, handler: controller.create },
    { method: 'get', path: `/${resource}/:id`, handler: controller.getOne },
    { method: 'put', path: `/${resource}/:id`, handler: controller.update },
    { method: 'delete', path: `/${resource}/:id`, handler: controller.delete }
  ];
  
  routes.forEach(route => {
    router[route.method](route.path, route.handler);
  });
}

// Controllers
const userController = {
  getAll: (ctx) => ctx.json({ users: [] }),
  create: (ctx) => ctx.json({ message: 'User created' }),
  getOne: (ctx) => ctx.json({ user: ctx.params.id }),
  update: (ctx) => ctx.json({ message: 'User updated' }),
  delete: (ctx) => ctx.json({ message: 'User deleted' })
};

const postController = {
  getAll: (ctx) => ctx.json({ posts: [] }),
  create: (ctx) => ctx.json({ message: 'Post created' }),
  getOne: (ctx) => ctx.json({ post: ctx.params.id }),
  update: (ctx) => ctx.json({ message: 'Post updated' }),
  delete: (ctx) => ctx.json({ message: 'Post deleted' })
};

// Generate routes
const apiRouter = new Router();
createCRUDRoutes(apiRouter, 'users', userController);
createCRUDRoutes(apiRouter, 'posts', postController);

app.use('/api', apiRouter.routes());
```

## Route Constraints and Validation

Add constraints to route parameters:

```javascript
// Custom route constraint middleware
function constrainParam(param, constraint) {
  return (ctx, next) => {
    const value = ctx.params[param];
    
    if (constraint.type === 'int') {
      const num = parseInt(value);
      if (isNaN(num) || num < (constraint.min || 0) || num > (constraint.max || Infinity)) {
        return ctx.status(400).json({
          error: `Invalid ${param}: must be an integer between ${constraint.min || 0} and ${constraint.max || 'infinity'}`
        });
      }
      ctx.params[param] = num;
    }
    
    if (constraint.type === 'uuid') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return ctx.status(400).json({
          error: `Invalid ${param}: must be a valid UUID`
        });
      }
    }
    
    if (constraint.type === 'enum') {
      if (!constraint.values.includes(value)) {
        return ctx.status(400).json({
          error: `Invalid ${param}: must be one of ${constraint.values.join(', ')}`
        });
      }
    }
    
    return next();
  };
}

// Usage with constraints
app.get('/users/:id', 
  constrainParam('id', { type: 'int', min: 1, max: 999999 }),
  (ctx) => {
    ctx.json({ user: ctx.params.id }); // id is now a number
  }
);

app.get('/products/:category/:id',
  constrainParam('category', { type: 'enum', values: ['electronics', 'clothing', 'books'] }),
  constrainParam('id', { type: 'uuid' }),
  (ctx) => {
    ctx.json({ 
      category: ctx.params.category,
      productId: ctx.params.id 
    });
  }
);
```

## Advanced Route Patterns

### Route Versioning

```javascript
// Version-based routing
function createVersionedAPI(versions) {
  const router = new Router();
  
  versions.forEach(version => {
    const versionRouter = new Router();
    
    // Load version-specific routes
    version.routes.forEach(route => {
      versionRouter[route.method](route.path, route.handler);
    });
    
    router.use(`/v${version.number}`, versionRouter.routes());
  });
  
  return router;
}

// Define API versions
const apiVersions = [
  {
    number: 1,
    routes: [
      { method: 'get', path: '/users', handler: (ctx) => ctx.json({ version: 1, users: [] }) },
      { method: 'get', path: '/posts', handler: (ctx) => ctx.json({ version: 1, posts: [] }) }
    ]
  },
  {
    number: 2,
    routes: [
      { method: 'get', path: '/users', handler: (ctx) => ctx.json({ version: 2, users: [], metadata: {} }) },
      { method: 'get', path: '/posts', handler: (ctx) => ctx.json({ version: 2, posts: [], pagination: {} }) }
    ]
  }
];

const versionedAPI = createVersionedAPI(apiVersions);
app.use('/api', versionedAPI.routes());

// Routes available:
// /api/v1/users
// /api/v1/posts
// /api/v2/users
// /api/v2/posts
```

### Content Negotiation Routing

```javascript
// Content negotiation middleware
function negotiateContent(supportedTypes = ['json', 'xml', 'text']) {
  return (ctx, next) => {
    const acceptHeader = ctx.get('accept') || 'application/json';
    
    let contentType = 'json';
    
    if (acceptHeader.includes('application/xml') && supportedTypes.includes('xml')) {
      contentType = 'xml';
    } else if (acceptHeader.includes('text/plain') && supportedTypes.includes('text')) {
      contentType = 'text';
    }
    
    ctx.responseType = contentType;
    return next();
  };
}

// Content-aware response helper
function respond(ctx, data) {
  switch (ctx.responseType) {
    case 'xml':
      ctx.set('Content-Type', 'application/xml');
      ctx.send(convertToXML(data));
      break;
    case 'text':
      ctx.set('Content-Type', 'text/plain');
      ctx.send(typeof data === 'string' ? data : JSON.stringify(data));
      break;
    default:
      ctx.json(data);
  }
}

function convertToXML(data) {
  // Simple XML conversion (you'd use a proper library in production)
  return `<?xml version="1.0"?><root>${JSON.stringify(data)}</root>`;
}

// Usage
app.get('/api/users', 
  negotiateContent(['json', 'xml', 'text']),
  (ctx) => {
    const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
    respond(ctx, { users });
  }
);
```

## Route Composition and Inheritance

```javascript
// Base route class
class BaseRoute {
  constructor(path, methods = ['get']) {
    this.path = path;
    this.methods = methods;
    this.middleware = [];
  }
  
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }
  
  build(router) {
    this.methods.forEach(method => {
      router[method](this.path, ...this.middleware, this.handler.bind(this));
    });
  }
  
  handler(ctx) {
    throw new Error('Handler must be implemented');
  }
}

// Specific route implementations
class UserRoute extends BaseRoute {
  constructor() {
    super('/users/:id', ['get', 'put', 'delete']);
  }
  
  handler(ctx) {
    const { id } = ctx.params;
    const method = ctx.method.toLowerCase();
    
    switch (method) {
      case 'get':
        ctx.json({ user: { id, name: 'John' } });
        break;
      case 'put':
        ctx.json({ message: 'User updated', id });
        break;
      case 'delete':
        ctx.json({ message: 'User deleted', id });
        break;
    }
  }
}

class PostRoute extends BaseRoute {
  constructor() {
    super('/posts', ['get', 'post']);
  }
  
  handler(ctx) {
    const method = ctx.method.toLowerCase();
    
    switch (method) {
      case 'get':
        ctx.json({ posts: [] });
        break;
      case 'post':
        ctx.json({ message: 'Post created' });
        break;
    }
  }
}

// Build routes
const router = new Router();
const userRoute = new UserRoute().use(authenticateUser);
const postRoute = new PostRoute().use(authenticateUser);

userRoute.build(router);
postRoute.build(router);

app.use('/api', router.routes());
```

## Sub-applications and Route Mounting

```javascript
// Create sub-applications
function createSubApp(name, routes) {
  const subApp = new Spark();
  
  // Add sub-app specific middleware
  subApp.use((ctx, next) => {
    ctx.set('X-Sub-App', name);
    return next();
  });
  
  // Add routes
  routes.forEach(route => {
    subApp[route.method](route.path, route.handler);
  });
  
  return subApp;
}

// Admin sub-application
const adminApp = createSubApp('admin', [
  { method: 'get', path: '/dashboard', handler: (ctx) => ctx.json({ dashboard: 'admin' }) },
  { method: 'get', path: '/users', handler: (ctx) => ctx.json({ adminUsers: [] }) },
  { method: 'post', path: '/users', handler: (ctx) => ctx.json({ message: 'Admin user created' }) }
]);

// API sub-application
const apiApp = createSubApp('api', [
  { method: 'get', path: '/status', handler: (ctx) => ctx.json({ status: 'ok' }) },
  { method: 'get', path: '/users', handler: (ctx) => ctx.json({ users: [] }) }
]);

// Mount sub-applications
app.use('/admin', adminApp.routes());
app.use('/api', apiApp.routes());
```

## Route Caching and Performance

```javascript
// Route response caching
const cache = new Map();

function cacheRoute(ttl = 60000) {
  return (ctx, next) => {
    if (ctx.method !== 'GET') {
      return next();
    }
    
    const key = ctx.path + JSON.stringify(ctx.query);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      ctx.set('X-Cache', 'HIT');
      ctx.set('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000));
      return ctx.json(cached.data);
    }
    
    // Override response methods to cache
    const originalJson = ctx.json;
    ctx.json = function(data) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
      ctx.set('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };
    
    return next();
  };
}

// Route performance monitoring
function monitorRoute(ctx, next) {
  const start = Date.now();
  
  return next().then(() => {
    const duration = Date.now() - start;
    ctx.set('X-Response-Time', `${duration}ms`);
    
    if (duration > 1000) {
      console.warn(`Slow route: ${ctx.method} ${ctx.path} took ${duration}ms`);
    }
  });
}

// Usage
app.get('/api/heavy-data', 
  monitorRoute,
  cacheRoute(300000), // Cache for 5 minutes
  (ctx) => {
    // Simulate heavy computation
    const data = generateHeavyData();
    ctx.json(data);
  }
);
```

## Route Documentation and OpenAPI

```javascript
// Route documentation decorator
function documented(spec) {
  return (target, propertyKey, descriptor) => {
    if (!target.routes) target.routes = [];
    
    target.routes.push({
      method: spec.method,
      path: spec.path,
      summary: spec.summary,
      parameters: spec.parameters || [],
      responses: spec.responses || {},
      handler: descriptor.value
    });
    
    return descriptor;
  };
}

// Documented API class
class UserAPI {
  @documented({
    method: 'GET',
    path: '/users',
    summary: 'Get all users',
    parameters: [
      { name: 'limit', in: 'query', type: 'integer', description: 'Number of users to return' },
      { name: 'offset', in: 'query', type: 'integer', description: 'Number of users to skip' }
    ],
    responses: {
      200: { description: 'List of users' },
      500: { description: 'Server error' }
    }
  })
  getUsers(ctx) {
    const { limit = 10, offset = 0 } = ctx.query;
    ctx.json({ users: [], limit, offset });
  }
  
  @documented({
    method: 'POST',
    path: '/users',
    summary: 'Create a new user',
    parameters: [
      { name: 'body', in: 'body', required: true, schema: { type: 'object' } }
    ],
    responses: {
      201: { description: 'User created' },
      400: { description: 'Invalid input' }
    }
  })
  createUser(ctx) {
    ctx.status(201).json({ message: 'User created' });
  }
}

// Generate OpenAPI documentation
function generateOpenAPI(apiClass) {
  const instance = new apiClass();
  const spec = {
    openapi: '3.0.0',
    info: { title: 'API', version: '1.0.0' },
    paths: {}
  };
  
  instance.routes.forEach(route => {
    if (!spec.paths[route.path]) {
      spec.paths[route.path] = {};
    }
    
    spec.paths[route.path][route.method.toLowerCase()] = {
      summary: route.summary,
      parameters: route.parameters,
      responses: route.responses
    };
  });
  
  return spec;
}

// Auto-register documented routes
function registerAPI(app, apiClass, prefix = '') {
  const instance = new apiClass();
  const router = new Router();
  
  instance.routes.forEach(route => {
    router[route.method.toLowerCase()](route.path, route.handler.bind(instance));
  });
  
  app.use(prefix, router.routes());
  
  // Serve OpenAPI spec
  const spec = generateOpenAPI(apiClass);
  app.get(prefix + '/openapi.json', (ctx) => ctx.json(spec));
}

// Usage
registerAPI(app, UserAPI, '/api');
// Available endpoints:
// GET /api/users
// POST /api/users
// GET /api/openapi.json
```

## Route Testing Framework

```javascript
// Route testing helper
class RouteTest {
  constructor(app) {
    this.app = app;
    this.server = null;
  }
  
  async start() {
    this.server = this.app.listen(0); // Random port
    const address = this.server.address();
    this.baseUrl = `http://localhost:${address.port}`;
  }
  
  async stop() {
    if (this.server) {
      this.server.close();
    }
  }
  
  async request(method, path, options = {}) {
    const url = this.baseUrl + path;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    return {
      status: response.status,
      headers: response.headers,
      json: async () => response.json(),
      text: async () => response.text()
    };
  }
  
  async get(path, options) {
    return this.request('GET', path, options);
  }
  
  async post(path, body, options) {
    return this.request('POST', path, { body, ...options });
  }
  
  async put(path, body, options) {
    return this.request('PUT', path, { body, ...options });
  }
  
  async delete(path, options) {
    return this.request('DELETE', path, options);
  }
}

// Test suite
async function testRoutes() {
  const app = new Spark();
  
  app.get('/users', (ctx) => ctx.json({ users: [] }));
  app.post('/users', (ctx) => ctx.status(201).json({ user: ctx.body }));
  
  const test = new RouteTest(app);
  await test.start();
  
  try {
    // Test GET /users
    const getResponse = await test.get('/users');
    console.assert(getResponse.status === 200, 'GET /users should return 200');
    
    const userData = await getResponse.json();
    console.assert(Array.isArray(userData.users), 'Should return users array');
    
    // Test POST /users
    const postResponse = await test.post('/users', { name: 'John' });
    console.assert(postResponse.status === 201, 'POST /users should return 201');
    
    console.log('All tests passed!');
  } finally {
    await test.stop();
  }
}

// Run tests
testRoutes().catch(console.error);
```

## Best Practices for Advanced Routing

### 1. Route Organization

```javascript
// Organize routes by feature/domain
const routes = {
  auth: require('./routes/auth'),
  users: require('./routes/users'),
  posts: require('./routes/posts'),
  admin: require('./routes/admin')
};

// Mount with consistent prefixes
Object.entries(routes).forEach(([prefix, router]) => {
  app.use(`/api/${prefix}`, router.routes());
});
```

### 2. Route Middleware Composition

```javascript
// Compose middleware for different route types
const publicRoute = [];
const authenticatedRoute = [authenticate];
const adminRoute = [authenticate, requireAdmin];

// Apply to routes
app.get('/api/public', ...publicRoute, handler);
app.get('/api/user', ...authenticatedRoute, handler);
app.get('/api/admin', ...adminRoute, handler);
```

### 3. Error Handling

```javascript
// Centralized route error handling
function routeErrorHandler(handler) {
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      console.error(`Route error: ${ctx.method} ${ctx.path}`, error);
      
      if (error.status) {
        ctx.status(error.status).json({ error: error.message });
      } else {
        ctx.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// Use with all routes
app.get('/api/users', routeErrorHandler(async (ctx) => {
  const users = await getUsersFromDatabase();
  ctx.json({ users });
}));
```

You now have powerful tools for advanced routing! This enables you to build sophisticated, maintainable, and performant web applications with complex routing requirements.

## What's Next?

Ready for more advanced topics?

👉 **Next Guide:** [Middleware Architecture](02-middleware-architecture.md)

You'll learn:
- Advanced middleware patterns
- Middleware composition
- Performance optimization
- Custom middleware development

Keep advancing! 🚀