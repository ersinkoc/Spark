/**
 * Test examples from intermediate documentation
 */

const { Spark, Router } = require('../../src/index');
const bodyParser = require('../../src/middleware/body-parser');

console.log('🧪 Testing Intermediate Documentation Examples\n');

// Helper function to get server port
function getServerPort(app) {
  return new Promise((resolve, reject) => {
    const server = app.server;
    if (server && server.address()) {
      resolve(server.address().port);
    } else {
      setTimeout(() => {
        const server = app.server;
        if (server && server.address()) {
          resolve(server.address().port);
        } else {
          reject(new Error('Server not ready'));
        }
      }, 100);
    }
  });
}

// Test 1: Advanced Routing - Dynamic Route Generation
async function testDynamicRouteGeneration() {
  console.log('Test 1: Dynamic Route Generation');
  
  const app = new Spark();
  app.use(bodyParser());
  
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
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Dynamic routes running on port ${port}`);
      
      // Test user routes
      const userResponse = await fetch(`http://localhost:${port}/api/users`);
      const userData = await userResponse.json();
      
      if (Array.isArray(userData.users)) {
        console.log('✅ Dynamic user routes - Success');
      } else {
        console.log('❌ Dynamic user routes - Failed');
      }
      
      // Test post routes
      const postResponse = await fetch(`http://localhost:${port}/api/posts/123`);
      const postData = await postResponse.json();
      
      if (postData.post === '123') {
        console.log('✅ Dynamic post routes - Success');
      } else {
        console.log('❌ Dynamic post routes - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Dynamic routing test failed:', error.message);
    }
  });
}

// Test 2: Route Constraints
async function testRouteConstraints() {
  console.log('\nTest 2: Route Constraints');
  
  const app = new Spark();
  
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
      ctx.json({ user: ctx.params.id, type: typeof ctx.params.id });
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
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Route constraints running on port ${port}`);
      
      // Test valid integer constraint
      const validIntResponse = await fetch(`http://localhost:${port}/users/123`);
      const validIntData = await validIntResponse.json();
      
      if (validIntData.user === 123 && validIntData.type === 'number') {
        console.log('✅ Integer constraint - Success');
      } else {
        console.log('❌ Integer constraint - Failed');
      }
      
      // Test invalid integer constraint
      const invalidIntResponse = await fetch(`http://localhost:${port}/users/abc`);
      
      if (invalidIntResponse.status === 400) {
        console.log('✅ Invalid integer rejection - Success');
      } else {
        console.log('❌ Invalid integer rejection - Failed');
      }
      
      // Test enum constraint
      const enumResponse = await fetch(`http://localhost:${port}/products/electronics/550e8400-e29b-41d4-a716-446655440000`);
      const enumData = await enumResponse.json();
      
      if (enumData.category === 'electronics') {
        console.log('✅ Enum constraint - Success');
      } else {
        console.log('❌ Enum constraint - Failed');
      }
      
      // Test invalid enum
      const invalidEnumResponse = await fetch(`http://localhost:${port}/products/invalid/550e8400-e29b-41d4-a716-446655440000`);
      
      if (invalidEnumResponse.status === 400) {
        console.log('✅ Invalid enum rejection - Success');
      } else {
        console.log('❌ Invalid enum rejection - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Route constraints test failed:', error.message);
    }
  });
}

// Test 3: Middleware Composition
async function testMiddlewareComposition() {
  console.log('\nTest 3: Middleware Composition');
  
  const app = new Spark();
  app.use(bodyParser());
  
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
  
  // Example middleware
  async function addRequestId(ctx, next) {
    ctx.requestId = Math.random().toString(36).substr(2, 9);
    return next();
  }
  
  async function logRequest(ctx, next) {
    console.log(`[${ctx.requestId}] ${ctx.method} ${ctx.path}`);
    return next();
  }
  
  async function authenticate(ctx, next) {
    const token = ctx.get('authorization');
    if (!token) {
      return ctx.status(401).json({ error: 'Authentication required' });
    }
    ctx.user = { id: 1, name: 'Test User' };
    return next();
  }
  
  // Compose middleware
  const authMiddleware = compose(
    addRequestId,
    logRequest,
    authenticate
  );
  
  app.get('/protected', authMiddleware, (ctx) => {
    ctx.json({ 
      message: 'Protected content',
      requestId: ctx.requestId,
      user: ctx.user
    });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Middleware composition running on port ${port}`);
      
      // Test without auth
      const noAuthResponse = await fetch(`http://localhost:${port}/protected`);
      
      if (noAuthResponse.status === 401) {
        console.log('✅ Authentication required - Success');
      } else {
        console.log('❌ Authentication required - Failed');
      }
      
      // Test with auth
      const authResponse = await fetch(`http://localhost:${port}/protected`, {
        headers: { 'Authorization': 'Bearer token' }
      });
      const authData = await authResponse.json();
      
      if (authData.requestId && authData.user) {
        console.log('✅ Composed middleware - Success');
      } else {
        console.log('❌ Composed middleware - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Middleware composition test failed:', error.message);
      await app.close();
    }
  });
}

// Test 4: Conditional Middleware
async function testConditionalMiddleware() {
  console.log('\nTest 4: Conditional Middleware');
  
  const app = new Spark();
  
  // Middleware that conditionally applies other middleware
  function conditional(condition, middleware) {
    return async (ctx, next) => {
      if (typeof condition === 'function' ? condition(ctx) : condition) {
        return middleware(ctx, next);
      }
      return next();
    };
  }
  
  // Sample middleware
  function apiRateLimit(ctx, next) {
    ctx.set('X-Rate-Limited', 'true');
    return next();
  }
  
  function publicRateLimit(ctx, next) {
    ctx.set('X-Public-Rate-Limited', 'true');
    return next();
  }
  
  // Apply rate limiting only to API routes
  app.use(conditional(
    (ctx) => ctx.path.startsWith('/api'),
    apiRateLimit
  ));
  
  // Apply different rate limit to public routes
  app.use(conditional(
    (ctx) => !ctx.path.startsWith('/api'),
    publicRateLimit
  ));
  
  app.get('/api/users', (ctx) => {
    ctx.json({ 
      users: [],
      rateLimited: ctx.get('X-Rate-Limited')
    });
  });
  
  app.get('/public/info', (ctx) => {
    ctx.json({ 
      info: 'Public information',
      publicRateLimited: ctx.get('X-Public-Rate-Limited')
    });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Conditional middleware running on port ${port}`);
      
      // Test API route
      const apiResponse = await fetch(`http://localhost:${port}/api/users`);
      const apiHeaders = apiResponse.headers;
      
      if (apiHeaders.get('x-rate-limited') === 'true') {
        console.log('✅ API rate limiting - Success');
      } else {
        console.log('❌ API rate limiting - Failed');
      }
      
      // Test public route
      const publicResponse = await fetch(`http://localhost:${port}/public/info`);
      const publicHeaders = publicResponse.headers;
      
      if (publicHeaders.get('x-public-rate-limited') === 'true') {
        console.log('✅ Public rate limiting - Success');
      } else {
        console.log('❌ Public rate limiting - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Conditional middleware test failed:', error.message);
    }
  });
}

// Run all tests
async function runAllTests() {
  try {
    await testDynamicRouteGeneration();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testRouteConstraints();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testMiddlewareComposition();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testConditionalMiddleware();
    
    console.log('\n✅ All intermediate documentation examples tested!');
    process.exit(0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();