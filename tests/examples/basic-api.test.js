/**
 * Basic API Example Tests
 * Tests all endpoints and functionality
 */

const http = require('http');
const { Spark } = require('../../src');

class BasicAPITest {
  constructor() {
    this.app = null;
    this.server = null;
    this.port = 0;
    this.testResults = [];
  }

  async setup() {
    // Create new Spark instance
    this.app = new Spark();
    
    // Setup all routes like in the example
    this.setupRoutes();
    
    // Start server and wait for it to be ready
    await new Promise((resolve) => {
      this.app.listen(0, () => {
        this.port = this.app.server.address().port;
        console.log(`🧪 Test server running on port ${this.port}`);
        resolve();
      });
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/_health', (ctx) => {
      const uptime = process.uptime();
      const memory = process.memoryUsage();
      const memoryPercent = (memory.heapUsed / memory.heapTotal) * 100;
      
      ctx.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: [
          { name: 'uptime', status: 'healthy', value: `${Math.floor(uptime)}s` },
          { name: 'memory', status: 'healthy', value: `${memoryPercent.toFixed(1)}%` },
          { name: 'cpu', status: 'healthy', value: '0.0%' }
        ],
        details: {
          uptime: { seconds: uptime, formatted: `${Math.floor(uptime)}s` },
          memory: { usage: memory, system: { percentage: memoryPercent } },
          cpu: { loadAverage: [0, 0, 0], cores: 1, usage: 0 }
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid
        }
      });
    });

    // Users endpoint
    this.app.get('/users', (ctx) => {
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
      ];
      ctx.json(users);
    });

    // User by ID endpoint
    this.app.get('/users/:id', (ctx) => {
      const id = parseInt(ctx.params.id);
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
      ];
      
      const user = users.find(u => u.id === id);
      if (user) {
        ctx.json(user);
      } else {
        ctx.status(404).json({ error: 'User not found' });
      }
    });

    // Echo endpoint
    this.app.use(this.app.middleware.bodyParser());
    this.app.post('/echo', (ctx) => {
      ctx.json({
        method: ctx.method,
        headers: ctx.headers,
        body: ctx.body,
        timestamp: new Date().toISOString()
      });
    });

    // Metrics endpoint
    this.app.get('/_metrics', (ctx) => {
      ctx.json({
        requests: 0,
        errors: 0,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });
  }

  async test(name, testFn) {
    try {
      await testFn();
      this.testResults.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`  ❌ ${name}: ${error.message}`);
    }
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: this.port,
        path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: body ? JSON.parse(body) : null
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: body
            });
          }
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async runTests() {
    console.log('🧪 Running Basic API Tests...\n');

    await this.test('Health check returns 200', async () => {
      const response = await this.makeRequest('/_health');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.status !== 'healthy') {
        throw new Error(`Expected healthy status, got ${response.body.status}`);
      }
    });

    await this.test('Users endpoint returns array', async () => {
      const response = await this.makeRequest('/users');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!Array.isArray(response.body)) {
        throw new Error('Expected array response');
      }
      if (response.body.length !== 3) {
        throw new Error(`Expected 3 users, got ${response.body.length}`);
      }
    });

    await this.test('User by ID returns correct user', async () => {
      const response = await this.makeRequest('/users/1');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.id !== 1) {
        throw new Error(`Expected user ID 1, got ${response.body.id}`);
      }
      if (response.body.name !== 'John Doe') {
        throw new Error(`Expected John Doe, got ${response.body.name}`);
      }
    });

    await this.test('User by invalid ID returns 404', async () => {
      const response = await this.makeRequest('/users/999');
      if (response.statusCode !== 404) {
        throw new Error(`Expected 404, got ${response.statusCode}`);
      }
    });

    await this.test('Echo endpoint works with POST', async () => {
      const testData = { message: 'test data' };
      const response = await this.makeRequest('/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testData
      });
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.method !== 'POST') {
        throw new Error(`Expected POST method, got ${response.body.method}`);
      }
      if (JSON.stringify(response.body.body) !== JSON.stringify(testData)) {
        throw new Error('Echo body does not match sent data');
      }
    });

    await this.test('Metrics endpoint returns metrics', async () => {
      const response = await this.makeRequest('/_metrics');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (typeof response.body.uptime !== 'number') {
        throw new Error('Expected uptime to be a number');
      }
      if (!response.body.memory) {
        throw new Error('Expected memory metrics');
      }
    });

    await this.test('Invalid endpoint returns 404', async () => {
      const response = await this.makeRequest('/invalid-endpoint');
      if (response.statusCode !== 404) {
        throw new Error(`Expected 404, got ${response.statusCode}`);
      }
    });
  }

  async cleanup() {
    if (this.app && this.app.server) {
      await new Promise(resolve => this.app.server.close(resolve));
    }
  }

  generateReport() {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`\n📊 Basic API Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    return { passed, failed, total, success: failed === 0 };
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new BasicAPITest();
  
  (async () => {
    try {
      await test.setup();
      await test.runTests();
      const results = test.generateReport();
      await test.cleanup();
      
      process.exit(results.success ? 0 : 1);
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      await test.cleanup();
      process.exit(1);
    }
  })();
}

module.exports = BasicAPITest;