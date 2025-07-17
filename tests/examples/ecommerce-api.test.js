/**
 * E-commerce API Example Tests
 * Tests the real ecommerce-api example endpoints
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class EcommerceAPITest {
  constructor() {
    this.process = null;
    this.port = 0; // Use dynamic port
    this.testResults = [];
    this.authToken = null;
    this.cookies = new Map(); // Store cookies for session management
  }

  async setup() {
    // Start the actual ecommerce-api server
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', '..', 'examples', 'ecommerce-api', 'index.js');
      // Use dynamic port by removing PORT env var
      const env = { ...process.env };
      delete env.PORT;
      
      this.process = spawn('node', [serverPath], { 
        stdio: 'pipe',
        env: env
      });

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('E-commerce API running')) {
          // Extract port from server output
          const portMatch = output.match(/port (\d+)/);
          if (portMatch) {
            this.port = parseInt(portMatch[1]);
          }
          console.log(`🧪 Ecommerce test server started on port ${this.port}`);
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
      const headers = { ...options.headers };
      
      // Add stored cookies to the request
      if (this.cookies.size > 0) {
        const cookieHeader = Array.from(this.cookies.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
        headers['Cookie'] = cookieHeader;
      }
      
      const req = http.request({
        hostname: 'localhost',
        port: this.port,
        path,
        method: options.method || 'GET',
        headers: headers
      }, (res) => {
        // Store cookies from response
        const setCookieHeader = res.headers['set-cookie'];
        if (setCookieHeader) {
          setCookieHeader.forEach(cookie => {
            const [nameValue] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) {
              this.cookies.set(name.trim(), value.trim());
            }
          });
        }
        
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
    console.log('🧪 Running E-commerce API Tests...\n');

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.test('Homepage returns API info', async () => {
      const response = await this.makeRequest('/');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.message || !response.body.message.includes('E-commerce')) {
        throw new Error('Expected E-commerce API message');
      }
    });

    await this.test('Register new user', async () => {
      const response = await this.makeRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { 
          email: 'test@example.com', 
          password: 'test123456',
          name: 'Test User'
        }
      });
      
      if (response.statusCode !== 201) {
        throw new Error(`Expected 201, got ${response.statusCode}`);
      }
      if (!response.body.user) {
        throw new Error('Expected user in response');
      }
    });

    await this.test('Login with valid credentials', async () => {
      // Clear cookies to test fresh login
      this.cookies.clear();
      
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'admin@example.com', password: 'admin123' }
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.user) {
        throw new Error('Expected user in response');
      }
    });

    await this.test('Login with invalid credentials returns 401', async () => {
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'invalid@example.com', password: 'wrong' }
      });
      
      if (response.statusCode !== 401) {
        throw new Error(`Expected 401, got ${response.statusCode}`);
      }
    });

    await this.test('Get products returns array', async () => {
      const response = await this.makeRequest('/api/products');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!Array.isArray(response.body.products)) {
        throw new Error('Expected products array');
      }
    });

    await this.test('Get product by ID returns product', async () => {
      // First get all products to get a valid ID
      const productsResponse = await this.makeRequest('/api/products');
      if (productsResponse.body.products.length === 0) {
        throw new Error('No products available for testing');
      }
      
      const productId = productsResponse.body.products[0].id;
      const response = await this.makeRequest(`/api/products/${productId}`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (response.body.product.id !== productId) {
        throw new Error(`Expected product ID ${productId}, got ${response.body.product.id}`);
      }
    });

    await this.test('Get invalid product returns 404', async () => {
      const response = await this.makeRequest('/api/products/invalid-id');
      if (response.statusCode !== 404) {
        throw new Error(`Expected 404, got ${response.statusCode}`);
      }
    });

    await this.test('Protected route requires authentication', async () => {
      // Clear cookies to test unauthenticated access
      this.cookies.clear();
      
      const response = await this.makeRequest('/api/orders');
      if (response.statusCode !== 401) {
        throw new Error(`Expected 401, got ${response.statusCode}`);
      }
    });

    await this.test('Get orders with authentication', async () => {
      // Login again with admin credentials for authenticated tests
      const loginResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'admin@example.com', password: 'admin123' }
      });
      
      if (loginResponse.statusCode !== 200) {
        throw new Error(`Login failed: ${loginResponse.statusCode}`);
      }
      
      
      const response = await this.makeRequest('/api/orders');
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}. Response: ${JSON.stringify(response.body)}`);
      }
      if (!Array.isArray(response.body.orders)) {
        throw new Error('Expected orders array');
      }
    });

    await this.test('Create order with authentication', async () => {
      // First add items to cart
      const productsResponse = await this.makeRequest('/api/products');
      const productId = productsResponse.body.products[0].id;
      
      // Add item to cart
      const cartResponse = await this.makeRequest('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { productId, quantity: 1 }
      });
      
      if (cartResponse.statusCode !== 201) {
        throw new Error(`Failed to add item to cart: ${cartResponse.statusCode}`);
      }
      
      // Create order
      const response = await this.makeRequest('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { 
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zip: '12345'
          },
          paymentMethod: 'card'
        }
      });
      
      if (response.statusCode !== 201) {
        throw new Error(`Expected 201, got ${response.statusCode}`);
      }
      if (!response.body.order) {
        throw new Error('Expected order in response');
      }
    });

    await this.test('Get user profile with authentication', async () => {
      // Ensure we're still logged in
      const response = await this.makeRequest('/api/auth/me');
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.user) {
        throw new Error('Expected user in response');
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

    console.log(`\n📊 E-commerce API Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    return { passed, failed, total, success: failed === 0 };
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new EcommerceAPITest();
  
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

module.exports = EcommerceAPITest;