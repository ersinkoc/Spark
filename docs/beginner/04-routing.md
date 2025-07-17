# Understanding Routing

Routing is how your application responds to different URLs and HTTP methods. Let's explore Spark's powerful routing system!

## Basic Routing

Every route consists of:
- **HTTP Method** (GET, POST, PUT, DELETE, etc.)
- **Path** (URL pattern)
- **Handler** (function that processes the request)

```javascript
const { Spark } = require('@oxog/spark');
const app = new Spark();

// Basic routes
app.get('/', (ctx) => {
  ctx.json({ message: 'Home page' });
});

app.post('/users', (ctx) => {
  ctx.json({ message: 'Create user' });
});

app.put('/users/:id', (ctx) => {
  ctx.json({ message: `Update user ${ctx.params.id}` });
});

app.delete('/users/:id', (ctx) => {
  ctx.json({ message: `Delete user ${ctx.params.id}` });
});
```

## HTTP Methods

Spark supports all standard HTTP methods:

```javascript
// GET - Retrieve data
app.get('/posts', (ctx) => {
  ctx.json({ posts: [] });
});

// POST - Create new data
app.post('/posts', (ctx) => {
  ctx.json({ message: 'Post created' });
});

// PUT - Update existing data (full update)
app.put('/posts/:id', (ctx) => {
  ctx.json({ message: 'Post updated' });
});

// PATCH - Update existing data (partial update)
app.patch('/posts/:id', (ctx) => {
  ctx.json({ message: 'Post partially updated' });
});

// DELETE - Remove data
app.delete('/posts/:id', (ctx) => {
  ctx.json({ message: 'Post deleted' });
});

// HEAD - Get headers only
app.head('/posts/:id', (ctx) => {
  ctx.set('X-Post-Exists', 'true');
  ctx.status(200).end();
});

// OPTIONS - Get allowed methods
app.options('/posts', (ctx) => {
  ctx.set('Allow', 'GET, POST, PUT, DELETE');
  ctx.status(200).end();
});
```

## Route Parameters

Route parameters capture values from the URL:

```javascript
// Single parameter
app.get('/users/:id', (ctx) => {
  const userId = ctx.params.id;
  ctx.json({ userId });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params;
  ctx.json({ userId, postId });
});

// Optional parameters (using Router - we'll cover this later)
app.get('/posts/:id?', (ctx) => {
  const id = ctx.params.id;
  if (id) {
    ctx.json({ post: `Post ${id}` });
  } else {
    ctx.json({ posts: 'All posts' });
  }
});
```

## Query Parameters

Query parameters come after the `?` in the URL:

```javascript
// GET /search?q=nodejs&limit=10&page=1
app.get('/search', (ctx) => {
  const { q, limit = 10, page = 1 } = ctx.query;
  
  ctx.json({
    query: q,
    limit: parseInt(limit),
    page: parseInt(page),
    results: []
  });
});

// GET /users?role=admin&active=true
app.get('/users', (ctx) => {
  const { role, active } = ctx.query;
  
  // Filter users based on query parameters
  let users = getAllUsers();
  
  if (role) {
    users = users.filter(user => user.role === role);
  }
  
  if (active === 'true') {
    users = users.filter(user => user.active === true);
  }
  
  ctx.json({ users });
});
```

## Route Patterns

Spark supports various route patterns:

```javascript
// Exact match
app.get('/about', (ctx) => {
  ctx.json({ page: 'About' });
});

// Wildcard (matches any path starting with /files/)
app.get('/files/*', (ctx) => {
  const filePath = ctx.path.replace('/files/', '');
  ctx.json({ file: filePath });
});

// Multiple route handlers (middleware pattern)
app.get('/protected', 
  requireAuth,  // First handler (middleware)
  (ctx) => {    // Second handler (main route)
    ctx.json({ message: 'Protected content' });
  }
);

function requireAuth(ctx, next) {
  const token = ctx.get('authorization');
  if (!token) {
    return ctx.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}
```

## Using the Router

For better organization, use the Router class:

```javascript
const { Spark, Router } = require('@oxog/spark');

const app = new Spark();
const apiRouter = new Router();

// Define routes on the router
apiRouter.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

apiRouter.post('/users', (ctx) => {
  ctx.json({ message: 'User created' });
});

apiRouter.get('/users/:id', (ctx) => {
  ctx.json({ user: ctx.params.id });
});

// Mount the router on the app
app.use('/api/v1', apiRouter.routes());

// Now your routes are:
// GET /api/v1/users
// POST /api/v1/users
// GET /api/v1/users/:id
```

## Organizing Routes in Separate Files

**routes/users.js:**
```javascript
const { Router } = require('@oxog/spark');

const router = new Router();

// In-memory storage for demo
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

// Get all users
router.get('/', (ctx) => {
  ctx.json({ users });
});

// Get user by ID
router.get('/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return ctx.status(404).json({ error: 'User not found' });
  }
  
  ctx.json({ user });
});

// Create new user
router.post('/', (ctx) => {
  const { name, email } = ctx.body;
  
  if (!name || !email) {
    return ctx.status(400).json({ error: 'Name and email required' });
  }
  
  const user = {
    id: users.length + 1,
    name,
    email
  };
  
  users.push(user);
  ctx.status(201).json({ user });
});

module.exports = router;
```

**routes/posts.js:**
```javascript
const { Router } = require('@oxog/spark');

const router = new Router();

const posts = [
  { id: 1, title: 'Hello World', content: 'My first post', authorId: 1 },
  { id: 2, title: 'Second Post', content: 'Another post', authorId: 2 }
];

router.get('/', (ctx) => {
  ctx.json({ posts });
});

router.get('/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === id);
  
  if (!post) {
    return ctx.status(404).json({ error: 'Post not found' });
  }
  
  ctx.json({ post });
});

router.post('/', (ctx) => {
  const { title, content, authorId } = ctx.body;
  
  if (!title || !content) {
    return ctx.status(400).json({ error: 'Title and content required' });
  }
  
  const post = {
    id: posts.length + 1,
    title,
    content,
    authorId: authorId || 1
  };
  
  posts.push(post);
  ctx.status(201).json({ post });
});

module.exports = router;
```

**server.js:**
```javascript
const { Spark } = require('@oxog/spark');
const bodyParser = require('@oxog/spark/middleware/body-parser');

const app = new Spark();

// Middleware
app.use(bodyParser());

// Import routes
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');

// Mount routes
app.use('/api/users', usersRouter.routes());
app.use('/api/posts', postsRouter.routes());

// Home route
app.get('/', (ctx) => {
  ctx.json({
    message: 'API Server',
    endpoints: {
      users: '/api/users',
      posts: '/api/posts'
    }
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Route Middleware

Add middleware to specific routes:

```javascript
// Middleware functions
function authenticate(ctx, next) {
  const token = ctx.get('authorization');
  if (!token) {
    return ctx.status(401).json({ error: 'Token required' });
  }
  // Add user to context
  ctx.user = { id: 1, name: 'John' };
  return next();
}

function validateUser(ctx, next) {
  const { name, email } = ctx.body;
  if (!name || !email) {
    return ctx.status(400).json({ error: 'Name and email required' });
  }
  return next();
}

function logRequest(ctx, next) {
  console.log(`${ctx.method} ${ctx.path}`);
  return next();
}

// Apply middleware to specific routes
app.get('/protected', authenticate, (ctx) => {
  ctx.json({ message: 'Protected route', user: ctx.user });
});

app.post('/users', 
  authenticate,    // Check authentication
  validateUser,    // Validate request body
  (ctx) => {       // Main handler
    ctx.json({ message: 'User created' });
  }
);

// Apply middleware to all routes in a router
const protectedRouter = new Router();
protectedRouter.use(authenticate);  // All routes need authentication

protectedRouter.get('/profile', (ctx) => {
  ctx.json({ user: ctx.user });
});

protectedRouter.get('/settings', (ctx) => {
  ctx.json({ settings: {} });
});

app.use('/api/protected', protectedRouter.routes());
```

## Advanced Routing Patterns

### Nested Routes

```javascript
const { Router } = require('@oxog/spark');

const app = new Spark();

// Users router
const usersRouter = new Router();
usersRouter.get('/', (ctx) => ctx.json({ users: [] }));
usersRouter.get('/:id', (ctx) => ctx.json({ user: ctx.params.id }));

// Posts router for specific user
const userPostsRouter = new Router();
userPostsRouter.get('/', (ctx) => {
  const userId = ctx.params.id;  // From parent route
  ctx.json({ posts: [], userId });
});

userPostsRouter.post('/', (ctx) => {
  const userId = ctx.params.id;
  ctx.json({ message: 'Post created', userId });
});

// Mount nested routes
usersRouter.use('/:id/posts', userPostsRouter.routes());
app.use('/api/users', usersRouter.routes());

// Results in:
// GET /api/users/:id/posts
// POST /api/users/:id/posts
```

### Route Groups

```javascript
function createRouteGroup(prefix, routes) {
  const router = new Router();
  
  routes.forEach(route => {
    router[route.method](route.path, ...route.handlers);
  });
  
  return { prefix, router };
}

// Define route groups
const apiV1 = createRouteGroup('/api/v1', [
  { method: 'get', path: '/users', handlers: [(ctx) => ctx.json({ version: 'v1', users: [] })] },
  { method: 'get', path: '/posts', handlers: [(ctx) => ctx.json({ version: 'v1', posts: [] })] }
]);

const apiV2 = createRouteGroup('/api/v2', [
  { method: 'get', path: '/users', handlers: [(ctx) => ctx.json({ version: 'v2', users: [] })] },
  { method: 'get', path: '/posts', handlers: [(ctx) => ctx.json({ version: 'v2', posts: [] })] }
]);

// Mount groups
app.use(apiV1.prefix, apiV1.router.routes());
app.use(apiV2.prefix, apiV2.router.routes());
```

## Route Testing

Create a test file for your routes:

**test-routes.js:**
```javascript
const { Spark } = require('@oxog/spark');

async function testRoutes() {
  const app = new Spark();
  
  // Add your routes
  app.get('/test', (ctx) => {
    ctx.json({ message: 'Test successful' });
  });
  
  // Start server
  const server = app.listen(3001, () => {
    console.log('Test server running on port 3001');
  });
  
  // Test with curl or fetch
  try {
    const response = await fetch('http://localhost:3001/test');
    const data = await response.json();
    console.log('Test result:', data);
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  // Close server
  server.close();
}

testRoutes();
```

## Common Routing Patterns

### REST API Structure

```javascript
// RESTful routes for a resource
app.get('/api/posts', getAllPosts);        // GET all
app.post('/api/posts', createPost);        // CREATE
app.get('/api/posts/:id', getPost);        // GET one
app.put('/api/posts/:id', updatePost);     // UPDATE (full)
app.patch('/api/posts/:id', patchPost);    // UPDATE (partial)
app.delete('/api/posts/:id', deletePost);  // DELETE
```

### Error Handling Routes

```javascript
// Catch-all error handler
app.use((ctx, next) => {
  try {
    return next();
  } catch (error) {
    ctx.status(500).json({ error: error.message });
  }
});

// 404 handler (put at the end)
app.use((ctx) => {
  ctx.status(404).json({ error: 'Route not found' });
});
```

## Best Practices

1. **Organize routes in separate files** for better maintainability
2. **Use consistent naming** for your routes
3. **Add proper validation** to route parameters
4. **Use middleware** for common functionality
5. **Handle errors gracefully** in your routes
6. **Add authentication** to protected routes
7. **Use proper HTTP status codes**
8. **Document your routes** with comments

## What's Next?

You now understand routing! Next, let's learn about handling data:

👉 **Next Guide:** [Working with Data](05-working-with-data.md)

You'll learn:
- Request and response handling
- Data validation
- File uploads
- Database integration

Keep learning! 🚀