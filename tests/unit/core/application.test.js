const assert = require('assert');
const { EventEmitter } = require('events');
const Application = require('../../../src/core/application');
const { Spark } = require('../../../src');
const TestHelper = require('../../test-helper');

describe('Application', () => {
  let app;
  
  beforeEach(() => {
    app = new Application();
  });
  
  afterEach(async () => {
    if (app.server && app.listening) {
      await app.close();
    }
  });
  
  describe('Constructor', () => {
    it('should create instance with default options', () => {
      assert(app instanceof Application);
      assert(app instanceof EventEmitter);
      assert.strictEqual(app.options.port, 3000);
      assert.strictEqual(app.options.host, '127.0.0.1');
      assert.strictEqual(app.options.compression, true);
    });
    
    it('should accept custom options', () => {
      const customApp = new Application({
        port: 8080,
        host: '0.0.0.0',
        compression: false
      });
      
      assert.strictEqual(customApp.options.port, 8080);
      assert.strictEqual(customApp.options.host, '0.0.0.0');
      assert.strictEqual(customApp.options.compression, false);
    });
    
    it('should use environment variables for port and host', () => {
      process.env.PORT = '9000';
      process.env.HOST = '192.168.1.1';
      
      const envApp = new Application();
      assert.strictEqual(envApp.options.port, '9000');
      assert.strictEqual(envApp.options.host, '192.168.1.1');
      
      delete process.env.PORT;
      delete process.env.HOST;
    });
    
    it('should set secure defaults', () => {
      assert.strictEqual(app.options.security.cors.origin, false);
      assert.strictEqual(app.options.security.csrf, true);
      assert.strictEqual(app.options.security.rateLimit.max, 100);
    });
  });
  
  describe('Middleware Management', () => {
    it('should register middleware functions', () => {
      const middleware = async (ctx, next) => { await next(); };
      app.use(middleware);
      assert.strictEqual(app.middlewares.length, 1);
    });
    
    it('should register path-specific middleware', () => {
      const middleware = async (ctx, next) => { await next(); };
      app.use('/api', middleware);
      assert.strictEqual(app.middlewares.length, 1);
    });
    
    it('should execute middleware in order', async () => {
      const order = [];
      
      app.use(async (ctx, next) => {
        order.push(1);
        await next();
        order.push(4);
      });
      
      app.use(async (ctx, next) => {
        order.push(2);
        await next();
        order.push(3);
      });
      
      app.use(async (ctx) => {
        ctx.text('OK');
      });
      
      await TestHelper.request(app);
      assert.deepStrictEqual(order, [1, 2, 3, 4]);
    });
    
    it('should handle middleware errors', async () => {
      app.use(async () => {
        throw new Error('Middleware error');
      });
      
      const errorHandler = new Promise(resolve => {
        app.on('error', (error) => {
          resolve(error.message);
        });
      });
      
      await TestHelper.request(app);
      const errorMessage = await errorHandler;
      assert.strictEqual(errorMessage, 'Middleware error');
    });
    
    it('should skip path middleware for non-matching routes', async () => {
      let apiCalled = false;
      let rootCalled = false;
      
      app.use('/api', async (ctx, next) => {
        apiCalled = true;
        await next();
      });
      
      app.use(async (ctx) => {
        rootCalled = true;
        ctx.text('OK');
      });
      
      await TestHelper.request(app, { path: '/' });
      assert.strictEqual(apiCalled, false);
      assert.strictEqual(rootCalled, true);
    });
  });
  
  describe('Server Lifecycle', () => {
    it('should start server on specified port', async () => {
      const server = await app.listen(0);
      assert(server);
      assert(app.listening);
      assert(server.address().port > 0);
    });
    
    it('should emit listening event', async () => {
      const listeningPromise = new Promise(resolve => {
        app.once('listening', resolve);
      });
      
      await app.listen(0);
      await listeningPromise;
      assert(app.listening);
    });
    
    it('should close server gracefully', async () => {
      await app.listen(0);
      assert(app.listening);
      
      await app.close();
      assert(!app.listening);
    });
    
    it('should emit close event', async () => {
      await app.listen(0);
      
      const closePromise = new Promise(resolve => {
        app.once('close', resolve);
      });
      
      await app.close();
      await closePromise;
    });
    
    it('should handle multiple close calls', async () => {
      await app.listen(0);
      await app.close();
      await app.close(); // Should not throw
    });
  });
  
  describe('Error Handling', () => {
    it('should handle uncaught exceptions based on config', (done) => {
      app.config = { exitOnUncaughtException: false };
      
      app.on('uncaughtException', (error) => {
        assert.strictEqual(error.message, 'Test exception');
        done();
      });
      
      // Simulate uncaught exception
      process.emit('uncaughtException', new Error('Test exception'));
    });
    
    it('should handle unhandled rejections based on config', (done) => {
      app.config = { exitOnUnhandledRejection: false };
      
      app.on('unhandledRejection', (reason) => {
        assert.strictEqual(reason, 'Test rejection');
        done();
      });
      
      // Simulate unhandled rejection
      process.emit('unhandledRejection', 'Test rejection', Promise.reject());
    });
  });
  
  describe('Router Integration', () => {
    it('should support HTTP methods', () => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
      
      methods.forEach(method => {
        assert(typeof app[method] === 'function');
        app[method]('/', async (ctx) => ctx.text('OK'));
      });
    });
    
    it('should handle route parameters', async () => {
      app.get('/users/:id', async (ctx) => {
        ctx.json({ id: ctx.params.id });
      });
      
      const res = await TestHelper.request(app, { path: '/users/123' });
      const data = res.json();
      assert.strictEqual(data.id, '123');
    });
    
    it('should support wildcard routes', async () => {
      app.get('/files/*', async (ctx) => {
        ctx.json({ path: ctx.params[0] });
      });
      
      const res = await TestHelper.request(app, { path: '/files/docs/readme.txt' });
      const data = res.json();
      assert.strictEqual(data.path, 'docs/readme.txt');
    });
  });
  
  describe('Memory Management', () => {
    it('should not leak memory on repeated requests', async function() {
      this.timeout(5000);
      
      const monitor = TestHelper.createMemoryMonitor();
      
      app.use(async (ctx) => {
        ctx.json({ message: 'Hello', timestamp: Date.now() });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      monitor.sample();
      
      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        await new Promise((resolve, reject) => {
          http.get(`http://localhost:${port}/`, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
          }).on('error', reject);
        });
        
        if (i % 100 === 0) {
          if (global.gc) global.gc();
          monitor.sample();
        }
      }
      
      await app.close();
      
      // Check for memory leak (allow 5MB growth for test overhead)
      assert(!monitor.hasLeak(5 * 1024 * 1024), 
        `Memory leak detected: ${(monitor.getGrowth() / 1024 / 1024).toFixed(2)}MB growth`);
    });
  });
  
  describe('Plugin System', () => {
    it('should load plugins via use()', () => {
      const plugin = {
        name: 'test-plugin',
        install(app) {
          app.testPlugin = true;
        }
      };
      
      app.use(plugin);
      assert.strictEqual(app.testPlugin, true);
    });
  });
  
  describe('Graceful Shutdown', () => {
    it('should handle SIGTERM signal', async () => {
      const server = await app.listen(0);
      
      const shutdownPromise = new Promise(resolve => {
        app.on('close', resolve);
      });
      
      process.emit('SIGTERM');
      await shutdownPromise;
      
      assert(!app.listening);
    });
    
    it('should wait for active connections before closing', async () => {
      let requestCompleted = false;
      
      app.use(async (ctx) => {
        await TestHelper.sleep(100);
        requestCompleted = true;
        ctx.text('OK');
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      // Start a request but don't wait for it
      http.get(`http://localhost:${port}/`);
      
      // Give request time to start
      await TestHelper.sleep(10);
      
      // Start graceful shutdown
      await app.gracefulShutdown();
      
      assert(requestCompleted);
    });
  });
});

// Run tests
describe.run = async function() {
  console.log('Running Application tests...\n');
  
  for (const suite of this.suites || []) {
    console.log(`  ${suite.name}`);
    
    for (const test of suite.tests || []) {
      try {
        if (suite.beforeEach) await suite.beforeEach();
        await test.fn();
        if (suite.afterEach) await suite.afterEach();
        console.log(`    ✓ ${test.name}`);
      } catch (error) {
        console.log(`    ✗ ${test.name}`);
        console.log(`      ${error.message}`);
      }
    }
  }
};

module.exports = describe;