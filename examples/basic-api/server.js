const { Spark, bodyParser, cors, healthCheck, metrics, errorHandling } = require('../../src/index');

const app = new Spark({
  port: process.env.PORT || 3001,
  security: {
    cors: { origin: true },
    rateLimit: { max: 100, window: 60000 }
  }
});

// Global middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());
app.use(healthCheck());
app.use(metrics());

// Health check endpoint
app.get('/health', (ctx) => {
  ctx.json({ status: 'ok', healthy: true });
});

// Basic routes
app.get('/', (ctx) => {
  ctx.json({ 
    message: 'Welcome to Basic API',
    timestamp: new Date().toISOString(),
    framework: '@oxog/spark',
    version: '1.1.0',
    features: [
      'Security hardening',
      'Memory leak protection',
      'Enhanced error handling',
      'ReDoS protection',
      'Path traversal protection'
    ]
  });
});

// Users collection endpoint
app.get('/users', (ctx) => {
  ctx.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
  ]);
});

// Create user endpoint
app.post('/users', errorHandling.asyncHandler(async (ctx) => {
  const { name = 'New User' } = ctx.body || {};
  
  const newUser = {
    id: Date.now(),
    name,
    email: `user${Date.now()}@example.com`,
    created: new Date().toISOString()
  };
  
  ctx.res.statusCode = 201;
  ctx.json(newUser);
}));

// Enhanced routes with error handling
app.get('/users/:id', errorHandling.asyncHandler(async (ctx) => {
  const userId = parseInt(ctx.params.id);
  
  if (isNaN(userId) || userId < 1) {
    throw errorHandling.errors.badRequest('Invalid user ID');
  }
  
  // Simulate database lookup
  if (userId > 1000) {
    throw errorHandling.errors.notFound('User not found');
  }
  
  ctx.json({
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    created: new Date().toISOString()
  });
}));

app.post('/echo', errorHandling.asyncHandler(async (ctx) => {
  const { name, email } = ctx.body || {};
  
  if (!name) {
    throw errorHandling.errors.badRequest('Name is required');
  }
  
  ctx.json({
    message: 'Echo successful',
    received: {
      name,
      email,
      timestamp: new Date().toISOString()
    },
    method: ctx.method,
    path: ctx.path
  });
}));

// Graceful shutdown
app.onShutdown(async () => {
  console.log('🔄 Gracefully shutting down...');
  // Cleanup resources here (database connections, etc.)
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/_health`);
  console.log(`📈 Metrics: http://localhost:${port}/_metrics`);
  console.log(`👤 Users: http://localhost:${port}/users`);
  console.log(`👤 User by ID: http://localhost:${port}/users/123`);
  console.log(`🔄 Echo endpoint: POST http://localhost:${port}/echo`);
  console.log('');
  console.log('✨ @oxog/spark v1.1.0 features:');
  console.log('  🔒 Security hardened (Path traversal, ReDoS, Header injection protection)');
  console.log('  🛡️ Memory leak protection with graceful shutdown');
  console.log('  🚨 Enhanced error handling with structured responses');
});

module.exports = app;