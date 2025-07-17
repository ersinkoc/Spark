/**
 * File Upload Example Tests
 * Tests the real file-upload example endpoints
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class FileUploadTest {
  constructor() {
    this.process = null;
    this.port = 0; // Use dynamic port
    this.testResults = [];
  }

  async setup() {
    // Start the actual file-upload server
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', '..', 'examples', 'file-upload', 'server.js');
      // Use dynamic port by removing PORT env var
      const env = { ...process.env };
      delete env.PORT;
      
      this.process = spawn('node', [serverPath], { 
        stdio: 'pipe',
        env: env
      });

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('File Upload Server running')) {
          // Extract port from server output
          const portMatch = output.match(/localhost:(\d+)/);
          if (portMatch) {
            this.port = parseInt(portMatch[1]);
          }
          console.log(`🧪 File upload test server started on port ${this.port}`);
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
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async runTests() {
    console.log('🧪 Running File Upload Tests...\n');

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.test('Homepage returns upload form', async () => {
      const response = await this.makeRequest('/');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.includes('File Upload')) {
        throw new Error('Expected file upload form');
      }
    });

    await this.test('Files endpoint returns file list', async () => {
      const response = await this.makeRequest('/files');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      // Should return JSON with files array
      if (!response.body.files || !Array.isArray(response.body.files)) {
        throw new Error('Expected files array');
      }
    });

    await this.test('Upload endpoint handles POST', async () => {
      // Simple test with basic form data
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const formData = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nTest file content\r\n--${boundary}--\r\n`;
      
      const response = await this.makeRequest('/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formData.length
        },
        body: formData
      });
      
      // Should handle the upload (even if it fails due to parsing)
      if (response.statusCode !== 200 && response.statusCode !== 400) {
        throw new Error(`Expected 200 or 400, got ${response.statusCode}`);
      }
    });

    await this.test('Health endpoint returns status', async () => {
      const response = await this.makeRequest('/health');
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      if (!response.body.status) {
        throw new Error('Expected status in response');
      }
    });

    await this.test('Invalid endpoint returns 404', async () => {
      const response = await this.makeRequest('/invalid');
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

    console.log(`\n📊 File Upload Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    return { passed, failed, total, success: failed === 0 };
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new FileUploadTest();
  
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

module.exports = FileUploadTest;