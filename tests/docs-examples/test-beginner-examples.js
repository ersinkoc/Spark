/**
 * Test examples from beginner documentation
 */

const { Spark, Router } = require('../../src/index');
const bodyParser = require('../../src/middleware/body-parser');

console.log('🧪 Testing Beginner Documentation Examples\n');

// Helper function to get server port
function getServerPort(app) {
  return new Promise((resolve, reject) => {
    const server = app.server;
    if (server && server.address()) {
      resolve(server.address().port);
    } else {
      reject(new Error('Server not ready'));
    }
  });
}

// Test 1: Basic Hello World from introduction
async function testHelloWorld() {
  console.log('Test 1: Hello World Example');
  
  const app = new Spark();
  
  app.get('/', (ctx) => {
    ctx.json({ message: 'Hello, Spark!' });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Server running on port ${port}`);
      
      // Test the endpoint
      const response = await fetch(`http://localhost:${port}/`);
      const data = await response.json();
      
      if (data.message === 'Hello, Spark!') {
        console.log('✅ Hello World endpoint works');
      } else {
        console.log('❌ Hello World endpoint failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  });
}

// Test 2: First Application - Blog API
async function testBlogAPI() {
  console.log('\nTest 2: Blog API Example');
  
  const app = new Spark();
  app.use(bodyParser());
  
  // In-memory storage
  const posts = [];
  const comments = [];
  let nextPostId = 1;
  let nextCommentId = 1;
  
  // Basic route
  app.get('/', (ctx) => {
    ctx.json({
      message: 'Welcome to My Blog API!',
      version: '1.0.0',
      endpoints: {
        posts: '/api/posts',
        comments: '/api/comments',
        stats: '/api/stats'
      }
    });
  });
  
  // Get all posts
  app.get('/api/posts', (ctx) => {
    ctx.json({
      posts: posts,
      total: posts.length
    });
  });
  
  // Create a new post
  app.post('/api/posts', (ctx) => {
    const { title, content, author } = ctx.body;
    
    if (!title || !content) {
      return ctx.status(400).json({
        error: 'Title and content are required'
      });
    }
    
    const post = {
      id: nextPostId++,
      title,
      content,
      author: author || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    posts.push(post);
    
    ctx.status(201).json({
      message: 'Post created successfully',
      post
    });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Blog API running on port ${port}`);
      
      // Test creating a post
      const response = await fetch(`http://localhost:${port}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Post',
          content: 'This is a test post',
          author: 'Test Author'
        })
      });
      
      if (response.status === 201) {
        console.log('✅ POST /api/posts - Success');
      } else {
        console.log('❌ POST /api/posts - Failed');
      }
      
      // Test getting posts
      const getResponse = await fetch(`http://localhost:${port}/api/posts`);
      const data = await getResponse.json();
      
      if (data.posts && data.posts.length === 1) {
        console.log('✅ GET /api/posts - Success');
      } else {
        console.log('❌ GET /api/posts - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ API test failed:', error.message);
    }
  });
}

// Test 3: Routing Examples
async function testRouting() {
  console.log('\nTest 3: Routing Examples');
  
  const app = new Spark();
  app.use(bodyParser());
  
  // Route parameters
  app.get('/users/:id', (ctx) => {
    const userId = ctx.params.id;
    ctx.json({ userId });
  });
  
  // Query parameters
  app.get('/search', (ctx) => {
    const { q, limit = 10, page = 1 } = ctx.query;
    ctx.json({
      query: q,
      limit: parseInt(limit),
      page: parseInt(page),
      results: []
    });
  });
  
  // Multiple route handlers (middleware pattern)
  function requireAuth(ctx, next) {
    const token = ctx.get('authorization');
    if (!token) {
      return ctx.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }
  
  app.get('/protected', 
    requireAuth,
    (ctx) => {
      ctx.json({ message: 'Protected content' });
    }
  );
  
  // Using Router
  const apiRouter = new Router();
  
  apiRouter.get('/users', (ctx) => {
    ctx.json({ users: [] });
  });
  
  apiRouter.post('/users', (ctx) => {
    ctx.json({ message: 'User created' });
  });
  
  app.use('/api/v1', apiRouter.routes());
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Routing examples running on port ${port}`);
      
      // Test route parameters
      const paramResponse = await fetch(`http://localhost:${port}/users/123`);
      const paramData = await paramResponse.json();
      
      if (paramData.userId === '123') {
        console.log('✅ Route parameters - Success');
      } else {
        console.log('❌ Route parameters - Failed');
      }
      
      // Test query parameters
      const queryResponse = await fetch(`http://localhost:${port}/search?q=test&limit=5`);
      const queryData = await queryResponse.json();
      
      if (queryData.query === 'test' && queryData.limit === 5) {
        console.log('✅ Query parameters - Success');
      } else {
        console.log('❌ Query parameters - Failed');
      }
      
      // Test protected route
      const protectedResponse = await fetch(`http://localhost:${port}/protected`);
      
      if (protectedResponse.status === 401) {
        console.log('✅ Protected route - Success');
      } else {
        console.log('❌ Protected route - Failed');
      }
      
      // Test router
      const routerResponse = await fetch(`http://localhost:${port}/api/v1/users`);
      const routerData = await routerResponse.json();
      
      if (Array.isArray(routerData.users)) {
        console.log('✅ Router mounting - Success');
      } else {
        console.log('❌ Router mounting - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Routing test failed:', error.message);
    }
  });
}

// Test 4: Data Validation Example
async function testDataValidation() {
  console.log('\nTest 4: Data Validation Example');
  
  const app = new Spark();
  app.use(bodyParser());
  
  function validateUser(userData) {
    const errors = [];
    
    if (!userData.name) errors.push('Name is required');
    if (!userData.email) errors.push('Email is required');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (userData.email && !emailRegex.test(userData.email)) {
      errors.push('Invalid email format');
    }
    
    if (userData.age !== undefined) {
      if (typeof userData.age !== 'number' || userData.age < 0 || userData.age > 150) {
        errors.push('Age must be a number between 0 and 150');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  app.post('/users', (ctx) => {
    const validation = validateUser(ctx.body);
    
    if (!validation.isValid) {
      return ctx.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    ctx.json({
      message: 'User created successfully',
      user: ctx.body
    });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Validation example running on port ${port}`);
      
      // Test valid user
      const validResponse = await fetch(`http://localhost:${port}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25
        })
      });
      
      if (validResponse.status === 200) {
        console.log('✅ Valid user validation - Success');
      } else {
        console.log('❌ Valid user validation - Failed');
      }
      
      // Test invalid user
      const invalidResponse = await fetch(`http://localhost:${port}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          email: 'invalid-email',
          age: 200
        })
      });
      
      if (invalidResponse.status === 400) {
        const data = await invalidResponse.json();
        if (data.details && data.details.length > 0) {
          console.log('✅ Invalid user validation - Success');
        } else {
          console.log('❌ Invalid user validation - Failed');
        }
      } else {
        console.log('❌ Invalid user validation - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Validation test failed:', error.message);
    }
  });
}

// Run all tests
async function runAllTests() {
  await testHelloWorld();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
  
  await testBlogAPI();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testRouting();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testDataValidation();
  
  console.log('\n✅ All beginner documentation examples tested!');
  process.exit(0);
}

runAllTests().catch(console.error);