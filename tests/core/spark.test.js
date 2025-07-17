/**
 * Core Spark framework tests
 */

const { Spark } = require('../../src');
const http = require('http');

describe('Spark Core', () => {
  let app;
  let server;

  beforeEach(() => {
    app = new Spark();
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
  });

  test('should create Spark instance', () => {
    expect(app).toBeDefined();
    expect(app.use).toBeDefined();
    expect(app.get).toBeDefined();
    expect(app.post).toBeDefined();
    expect(app.listen).toBeDefined();
  });

  test('should handle GET requests', async () => {
    app.get('/test', (ctx) => {
      ctx.json({ message: 'test' });
    });

    server = app.listen(0);
    const port = server.address().port;

    const response = await makeRequest(`http://localhost:${port}/test`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('test');
  });

  test('should handle POST requests', async () => {
    app.use(app.middleware.bodyParser());
    app.post('/test', (ctx) => {
      ctx.json({ received: ctx.body });
    });

    server = app.listen(0);
    const port = server.address().port;

    const response = await makeRequest(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' })
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('test');
  });

  test('should handle middleware', async () => {
    let middlewareRan = false;
    
    app.use((ctx, next) => {
      middlewareRan = true;
      return next();
    });

    app.get('/test', (ctx) => {
      ctx.json({ success: true });
    });

    server = app.listen(0);
    const port = server.address().port;

    await makeRequest(`http://localhost:${port}/test`);
    expect(middlewareRan).toBe(true);
  });

  test('should handle errors', async () => {
    app.get('/error', (ctx) => {
      throw new Error('Test error');
    });

    server = app.listen(0);
    const port = server.address().port;

    const response = await makeRequest(`http://localhost:${port}/error`);
    expect(response.statusCode).toBe(500);
  });

  test('should handle 404 errors', async () => {
    server = app.listen(0);
    const port = server.address().port;

    const response = await makeRequest(`http://localhost:${port}/nonexistent`);
    expect(response.statusCode).toBe(404);
  });

  test('should support middleware chaining', async () => {
    const order = [];
    
    app.use((ctx, next) => {
      order.push('middleware1');
      return next();
    });

    app.use((ctx, next) => {
      order.push('middleware2');
      return next();
    });

    app.get('/test', (ctx) => {
      order.push('handler');
      ctx.json({ order });
    });

    server = app.listen(0);
    const port = server.address().port;

    const response = await makeRequest(`http://localhost:${port}/test`);
    const body = JSON.parse(response.body);
    expect(body.order).toEqual(['middleware1', 'middleware2', 'handler']);
  });
});

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Simple test runner
function describe(name, fn) {
  console.log(`\n🧪 ${name}`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
    throw error;
  }
}

function beforeEach(fn) {
  // Store for later execution
  global.beforeEachFn = fn;
}

function afterEach(fn) {
  // Store for later execution
  global.afterEachFn = fn;
}

function expect(actual) {
  return {
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected ${actual} to be defined`);
      }
    },
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    }
  };
}

// Export for use in test runner
module.exports = { describe, test, beforeEach, afterEach, expect };