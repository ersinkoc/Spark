const { Spark, Router, middleware } = require('../../src/index');

const app = new Spark({
  port: process.env.PORT || 3000
});
const router = new Router();

// In-memory data store (for demo purposes)
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

let nextId = 3;

// Middleware
app.use(middleware.cors());
app.use(middleware.bodyParser());
app.use(middleware.compression());
app.use(middleware.rateLimit({ max: 100, window: 60000 }));

// CRUD Routes for items (generic resource)
router.get('/items', async (ctx) => {
  ctx.json([]);
});

router.post('/items', async (ctx) => {
  const item = { id: Date.now(), ...ctx.body };
  ctx.status = 201;
  ctx.json(item);
});

router.get('/items/:id', async (ctx) => {
  ctx.json({ id: ctx.params.id, name: 'Sample Item' });
});

router.put('/items/:id', async (ctx) => {
  ctx.json({ id: ctx.params.id, ...ctx.body });
});

router.delete('/items/:id', async (ctx) => {
  ctx.status = 204;
});

// CRUD Routes for users
router.get('/users', async (ctx) => {
  const { page = 1, limit = 10, search } = ctx.query;
  let filteredUsers = users;

  if (search) {
    filteredUsers = users.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  ctx.json({
    data: paginatedUsers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: filteredUsers.length,
      pages: Math.ceil(filteredUsers.length / limit)
    }
  });
});

router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  const user = users.find(u => u.id === parseInt(id));

  if (!user) {
    return ctx.status(404).json({ error: 'User not found' });
  }

  ctx.json({ data: user });
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.body;

  if (!name || !email) {
    return ctx.status(400).json({ 
      error: 'Validation failed',
      message: 'Name and email are required' 
    });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return ctx.status(409).json({ 
      error: 'Conflict',
      message: 'User with this email already exists' 
    });
  }

  const user = {
    id: nextId++,
    name,
    email,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  ctx.status(201).json({ data: user });
});

router.put('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  const { name, email } = ctx.body;
  
  const userIndex = users.findIndex(u => u.id === parseInt(id));
  if (userIndex === -1) {
    return ctx.status(404).json({ error: 'User not found' });
  }

  if (!name || !email) {
    return ctx.status(400).json({ 
      error: 'Validation failed',
      message: 'Name and email are required' 
    });
  }

  users[userIndex] = {
    ...users[userIndex],
    name,
    email,
    updatedAt: new Date().toISOString()
  };

  ctx.json({ data: users[userIndex] });
});

router.delete('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  const userIndex = users.findIndex(u => u.id === parseInt(id));

  if (userIndex === -1) {
    return ctx.status(404).json({ error: 'User not found' });
  }

  users.splice(userIndex, 1);
  ctx.status(204).end();
});

// Statistics endpoint
router.get('/stats', async (ctx) => {
  ctx.json({
    totalUsers: users.length,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount router
console.log('Router routes:', router.routes);
console.log('Router routes function:', typeof router.routes);
if (typeof router.routes === 'function') {
  app.use('/api/v1', router.routes());
} else {
  console.error('Router.routes is not a function!');
  // Try alternative approach
  app.use(router.middleware('/api/v1'));
}

// Debug route
app.get('/test', (ctx) => {
  ctx.json({ message: 'Test route works' });
});

// Root endpoint
app.get('/', (ctx) => {
  ctx.json({
    message: 'CRUD API Example',
    version: '1.0.0',
    endpoints: {
      'GET /api/v1/users': 'Get all users',
      'GET /api/v1/users/:id': 'Get user by ID',
      'POST /api/v1/users': 'Create new user',
      'PUT /api/v1/users/:id': 'Update user',
      'DELETE /api/v1/users/:id': 'Delete user',
      'GET /api/v1/stats': 'Get statistics'
    }
  });
});

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    ctx.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    const actualPort = app.server?.address()?.port || port;
    console.log(`🚀 CRUD API Server running on http://localhost:${actualPort}`);
    console.log(`📚 API Documentation: http://localhost:${actualPort}`);
    console.log(`👥 Users API: http://localhost:${actualPort}/api/v1/users`);
  });
}

module.exports = app;