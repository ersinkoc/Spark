const { App } = require('../../src/index');
const http = require('http');
const { promisify } = require('util');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`Running ${this.tests.length} tests...\n`);
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Helper function to make HTTP requests
async function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(data) 
            : data;
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        } catch (error) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Tests
const runner = new TestRunner();

runner.test('App should create instance', () => {
  const app = new App();
  assert(app instanceof App, 'App should be instance of App');
});

runner.test('App should have middleware methods', () => {
  const app = new App();
  assert(typeof app.use === 'function', 'App should have use method');
  assert(typeof app.get === 'function', 'App should have get method');
  assert(typeof app.post === 'function', 'App should have post method');
  assert(typeof app.put === 'function', 'App should have put method');
  assert(typeof app.delete === 'function', 'App should have delete method');
});

runner.test('App should handle basic GET request', async () => {
  const app = new App();
  
  app.get('/', (ctx) => {
    ctx.json({ message: 'Hello World' });
  });
  
  const server = app.listen(0); // Use random port
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response.statusCode, 200);
    assertEqual(response.body.message, 'Hello World');
  } finally {
    await app.close();
  }
});

runner.test('App should handle POST request with JSON body', async () => {
  const app = new App();
  
  app.use(app.middleware.bodyParser());
  
  app.post('/echo', (ctx) => {
    ctx.json({ received: ctx.body });
  });
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/echo',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data' })
    });
    
    assertEqual(response.statusCode, 200);
    assertEqual(response.body.received.test, 'data');
  } finally {
    await app.close();
  }
});

runner.test('App should handle middleware chain', async () => {
  const app = new App();
  const order = [];
  
  app.use(async (ctx, next) => {
    order.push('middleware1');
    await next();
    order.push('middleware1-after');
  });
  
  app.use(async (ctx, next) => {
    order.push('middleware2');
    await next();
    order.push('middleware2-after');
  });
  
  app.get('/', (ctx) => {
    order.push('handler');
    ctx.json({ order });
  });
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response.statusCode, 200);
    const expectedOrder = ['middleware1', 'middleware2', 'handler', 'middleware2-after', 'middleware1-after'];
    assertEqual(JSON.stringify(response.body.order), JSON.stringify(expectedOrder));
  } finally {
    await app.close();
  }
});

runner.test('App should handle 404 for unknown routes', async () => {
  const app = new App();
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/nonexistent',
      method: 'GET'
    });
    
    assertEqual(response.statusCode, 404);
  } finally {
    await app.close();
  }
});

runner.test('App should handle errors in middleware', async () => {
  const app = new App();
  
  app.use(async (ctx, next) => {
    throw new Error('Test error');
  });
  
  app.get('/', (ctx) => {
    ctx.json({ message: 'Should not reach here' });
  });
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response.statusCode, 500);
  } finally {
    await app.close();
  }
});

runner.test('App should handle CORS middleware', async () => {
  const app = new App();
  
  app.use(app.middleware.cors());
  
  app.get('/', (ctx) => {
    ctx.json({ message: 'CORS test' });
  });
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response.statusCode, 200);
    assert(response.headers['access-control-allow-origin'], 'Should have CORS header');
  } finally {
    await app.close();
  }
});

runner.test('App should handle rate limiting', async () => {
  const app = new App();
  
  app.use(app.middleware.rateLimit({ max: 1, windowMs: 1000 }));
  
  app.get('/', (ctx) => {
    ctx.json({ message: 'Rate limit test' });
  });
  
  const server = app.listen(0);
  const port = server.server.address().port;
  
  try {
    // First request should succeed
    const response1 = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response1.statusCode, 200);
    
    // Second request should be rate limited
    const response2 = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET'
    });
    
    assertEqual(response2.statusCode, 429);
  } finally {
    await app.close();
  }
});

// Run tests
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runner };