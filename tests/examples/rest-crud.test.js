/**
 * REST CRUD Example Tests
 * Tests the real rest-crud example endpoints
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class RestCrudTest {
  constructor() {
    this.process = null;
    this.port = 0; // Use dynamic port
    this.testResults = [];
  }

  async setup() {
    // Start the actual rest-crud server
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', '..', 'examples', 'rest-crud', 'server.js');
      // Use dynamic port by removing PORT env var
      const env = { ...process.env };
      delete env.PORT;
      
      this.process = spawn('node', [serverPath], { 
        stdio: 'pipe',
        env: env
      });

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('CRUD API Server running')) {
          // Extract port from server output
          const portMatch = output.match(/localhost:(\d+)/);
          if (portMatch) {
            this.port = parseInt(portMatch[1]);
          }
          console.log(`🧪 REST CRUD test server started on port ${this.port}`);
          resolve();
        }
      });

      this.process.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.process.on('error', reject);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);
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
              body: body ? JSON.parse(body) : body
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
    console.log('🧪 Running REST CRUD Tests...\n');

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.test('API documentation homepage', async () => {
      const response = await this.makeRequest('/');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.includes('CRUD API Documentation')) {
        throw new Error('Expected API documentation');
      }
    });

    await this.test('Get all users returns array', async () => {
      const response = await this.makeRequest('/api/v1/users');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!Array.isArray(response.body.data)) {
        throw new Error('Expected users data array');
      }
    });

    await this.test('Create new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        age: 25
      };
      
      const response = await this.makeRequest('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: userData
      });
      
      if (response.statusCode !== 201) {
        throw new Error(`Expected 201, got ${response.statusCode}`);
      }
      if (!response.body.data) {
        throw new Error('Expected user data in response');
      }
      if (response.body.data.name !== userData.name) {
        throw new Error('User not created correctly');
      }
    });

    await this.test('Get user by ID', async () => {
      // First create a user to get
      const userData = { name: 'Get Test User', email: 'get@example.com', age: 30 };
      const createResponse = await this.makeRequest('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: userData
      });
      
      const userId = createResponse.body.data.id;
      
      const response = await this.makeRequest(`/api/v1/users/${userId}`);
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.data.id !== userId) {
        throw new Error(`Expected user ID ${userId}, got ${response.body.data.id}`);
      }
    });

    await this.test('Update user', async () => {
      // First create a user to update
      const userData = { name: 'Update Test User', email: 'update@example.com', age: 35 };
      const createResponse = await this.makeRequest('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: userData
      });
      
      const userId = createResponse.body.data.id;
      const updateData = { name: 'Updated User', email: 'updated@example.com' };
      
      const response = await this.makeRequest(`/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: updateData
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.data.name !== updateData.name) {
        throw new Error('User not updated correctly');
      }
    });

    await this.test('Delete user', async () => {
      // First create a user to delete
      const userData = { name: 'Delete Test User', email: 'delete@example.com', age: 40 };
      const createResponse = await this.makeRequest('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: userData
      });
      
      const userId = createResponse.body.data.id;
      
      const response = await this.makeRequest(`/api/v1/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.statusCode !== 204) {
        throw new Error(`Expected 204, got ${response.statusCode}`);
      }
      
      // Verify user is deleted
      const getResponse = await this.makeRequest(`/api/v1/users/${userId}`);
      if (getResponse.statusCode !== 404) {
        throw new Error(`Expected 404 after deletion, got ${getResponse.statusCode}`);
      }
    });

    await this.test('Get non-existent user returns 404', async () => {
      const response = await this.makeRequest('/api/v1/users/non-existent-id');
      if (response.statusCode !== 404) {
        throw new Error(`Expected 404, got ${response.statusCode}`);
      }
    });

    await this.test('Invalid endpoint returns 404', async () => {
      const response = await this.makeRequest('/api/v1/invalid');
      if (response.statusCode !== 404) {
        throw new Error(`Expected 404, got ${response.statusCode}`);
      }
    });
  }

  async cleanup() {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  generateReport() {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`\n📊 REST CRUD Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    return { passed, failed, total, success: failed === 0 };
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new RestCrudTest();
  
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

module.exports = RestCrudTest;