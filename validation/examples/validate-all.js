#!/usr/bin/env node

/**
 * Example validation script for @oxog/spark
 * Tests all example applications to ensure they work correctly
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

console.log('🔍 Starting Example Applications Validation...\n');

class ExampleValidator {
  constructor() {
    this.examples = [
      {
        name: 'Basic API',
        dir: 'basic-api',
        file: 'server.js',
        tests: [
          { method: 'GET', path: '/', expectedStatus: 200, expectedBody: /welcome/i },
          { method: 'GET', path: '/users', expectedStatus: 200, expectedBody: /users|array|\[/ },
          { method: 'GET', path: '/users/1', expectedStatus: 200, expectedBody: /id|user/ },
          { method: 'POST', path: '/users', body: { name: 'Test' }, expectedStatus: 201 },
          { method: 'GET', path: '/health', expectedStatus: 200, expectedBody: /ok|healthy/ }
        ]
      },
      {
        name: 'E-commerce API',
        dir: 'ecommerce-api',
        file: 'index.js',
        tests: [
          { method: 'GET', path: '/api/products', expectedStatus: 200, expectedBody: /products|array|\[/ },
          { method: 'GET', path: '/api/products/1', expectedStatus: 200, expectedBody: /id|product/ },
          { method: 'POST', path: '/api/cart', body: { productId: 1, quantity: 2 }, expectedStatus: 200 },
          { method: 'GET', path: '/api/cart', expectedStatus: 200 },
          { method: 'POST', path: '/api/orders', body: { items: [] }, expectedStatus: 201 }
        ]
      },
      {
        name: 'File Upload',
        dir: 'file-upload',
        file: 'server.js',
        tests: [
          { method: 'GET', path: '/', expectedStatus: 200, expectedBody: /upload|form/ },
          { method: 'GET', path: '/uploads', expectedStatus: 200 },
          { 
            method: 'POST', 
            path: '/upload', 
            formData: { 
              file: { 
                filename: 'test.txt', 
                content: 'Hello World' 
              } 
            },
            expectedStatus: 200,
            expectedBody: /success|uploaded/
          }
        ]
      },
      {
        name: 'REST CRUD',
        dir: 'rest-crud',
        file: 'server.js',
        tests: [
          { method: 'GET', path: '/api/v1/items', expectedStatus: 200, expectedBody: /array|\[/ },
          { method: 'POST', path: '/api/v1/items', body: { name: 'Test Item' }, expectedStatus: 201 },
          { method: 'GET', path: '/api/v1/items/1', expectedStatus: 200 },
          { method: 'PUT', path: '/api/v1/items/1', body: { name: 'Updated' }, expectedStatus: 200 },
          { method: 'DELETE', path: '/api/v1/items/1', expectedStatus: 204 }
        ]
      }
    ];
    
    this.results = [];
  }

  async validateAll() {
    console.log(`Found ${this.examples.length} examples to validate\n`);
    
    for (const example of this.examples) {
      await this.validateExample(example);
    }
    
    this.printSummary();
    
    const hasFailures = this.results.some(r => !r.success);
    return !hasFailures;
  }

  async validateExample(example) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${example.name}`);
    console.log(`Directory: examples/${example.dir}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const examplePath = path.join(__dirname, '../../examples', example.dir, example.file);
    
    // Check if example exists
    if (!fs.existsSync(examplePath)) {
      this.results.push({
        name: example.name,
        success: false,
        error: `Example file not found: ${examplePath}`
      });
      console.error(`❌ Example file not found: ${examplePath}`);
      return;
    }
    
    let server = null;
    let port = null;
    
    try {
      // Start the example server
      console.log('Starting server...');
      const { server: startedServer, port: assignedPort } = await this.startServer(examplePath);
      server = startedServer;
      port = assignedPort;
      
      console.log(`✅ Server started on port ${port}\n`);
      
      // Run tests
      let passed = 0;
      let failed = 0;
      
      for (const test of example.tests) {
        try {
          await this.runTest(port, test);
          passed++;
          console.log(`✅ ${test.method} ${test.path} - Passed`);
        } catch (error) {
          failed++;
          console.error(`❌ ${test.method} ${test.path} - Failed: ${error.message}`);
        }
      }
      
      this.results.push({
        name: example.name,
        success: failed === 0,
        passed,
        failed,
        total: example.tests.length
      });
      
    } catch (error) {
      this.results.push({
        name: example.name,
        success: false,
        error: error.message
      });
      console.error(`❌ Failed to validate example: ${error.message}`);
    } finally {
      // Stop the server
      if (server) {
        await this.stopServer(server);
        console.log('\n✅ Server stopped');
      }
    }
  }

  async startServer(scriptPath) {
    return new Promise((resolve, reject) => {
      // Use spawn to run the example in a separate process
      const proc = spawn('node', [scriptPath], {
        env: { ...process.env, PORT: '0' }, // Use port 0 for random port
        cwd: path.dirname(scriptPath)
      });
      
      let output = '';
      let errorOutput = '';
      let resolved = false;
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
        
        // Look for port information in output
        const portMatch = output.match(/(?:listening|started|running).*?(\d{4,5})/i);
        if (portMatch && !resolved) {
          resolved = true;
          const port = parseInt(portMatch[1]);
          resolve({ server: proc, port });
        }
      });
      
      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('Server stderr:', data.toString());
      });
      
      proc.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
      
      proc.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Server exited with code ${code}: ${errorOutput || output}`));
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          
          // If no port found, try to detect from network connections
          // For now, assume it started on default port
          resolve({ server: proc, port: 3000 });
        }
      }, 5000);
    });
  }

  async stopServer(server) {
    return new Promise((resolve) => {
      if (server.killed) {
        resolve();
        return;
      }
      
      server.on('exit', () => {
        resolve();
      });
      
      server.kill('SIGTERM');
      
      // Force kill after 2 seconds
      setTimeout(() => {
        if (!server.killed) {
          server.kill('SIGKILL');
        }
        resolve();
      }, 2000);
    });
  }

  async runTest(port, test) {
    const options = {
      hostname: 'localhost',
      port,
      path: test.path,
      method: test.method,
      headers: {}
    };
    
    let body = null;
    
    if (test.body) {
      body = JSON.stringify(test.body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    } else if (test.formData) {
      // Simple multipart form data
      const boundary = '----FormBoundary' + Math.random().toString(36);
      const file = test.formData.file;
      
      body = `------${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n`;
      body += `Content-Type: text/plain\r\n\r\n`;
      body += `${file.content}\r\n`;
      body += `------${boundary}--\r\n`;
      
      options.headers['Content-Type'] = `multipart/form-data; boundary=----${boundary}`;
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        
        res.on('end', () => {
          // Check status code
          if (test.expectedStatus && res.statusCode !== test.expectedStatus) {
            reject(new Error(`Expected status ${test.expectedStatus} but got ${res.statusCode}. Body: ${responseBody}`));
            return;
          }
          
          // Check body content
          if (test.expectedBody && !test.expectedBody.test(responseBody)) {
            reject(new Error(`Body does not match expected pattern. Got: ${responseBody.substring(0, 100)}...`));
            return;
          }
          
          resolve();
        });
      });
      
      req.on('error', reject);
      
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  printSummary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('VALIDATION SUMMARY');
    console.log(`${'='.repeat(60)}\n`);
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const result of this.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      } else {
        console.log(`     Tests: ${result.passed}/${result.total} passed`);
        totalPassed += result.passed || 0;
        totalFailed += result.failed || 0;
      }
    }
    
    console.log(`\nOverall: ${totalPassed} passed, ${totalFailed} failed`);
    
    const successRate = totalPassed / (totalPassed + totalFailed) * 100;
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    if (totalFailed === 0) {
      console.log('\n✅ All examples validated successfully!');
    } else {
      console.log('\n❌ Some examples failed validation');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ExampleValidator();
  
  validator.validateAll().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ExampleValidator;