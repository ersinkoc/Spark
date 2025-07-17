#!/usr/bin/env node

/**
 * Integration test for the refactored Spark framework
 * Tests all major components and new features
 */

const { Spark, Router, bodyParser, cors, healthCheck, metrics, errorHandling } = require('./src/index');
const http = require('http');

console.log('🧪 Testing refactored Spark Framework...\n');

// Set test mode to suppress error logging
process.env.TEST_MODE = 'true';

async function testFramework() {
  const app = new Spark({
    port: 0, // Random port for testing
    host: '127.0.0.1',
    security: {
      cors: { origin: true },
      rateLimit: { max: 1000, window: 60000 }
    }
  });

  // Test middleware
  app.use(bodyParser.json());
  app.use(cors({ origin: true }));
  app.use(healthCheck());
  app.use(metrics());

  // Test direct routes on app
  app.get('/test', (ctx) => {
    ctx.json({ message: 'Router test successful' });
  });

  app.post('/echo', (ctx) => {
    ctx.json({ received: ctx.body });
  });

  // Test error handling
  app.get('/error', errorHandling.asyncHandler(async (ctx) => {
    throw errorHandling.errors.badRequest('Test error');
  }));

  // Test path parameters
  app.get('/users/:id', (ctx) => {
    ctx.json({ userId: ctx.params.id });
  });

  // Test route groups with router
  const apiRouter = new Router();
  apiRouter.get('/status', (ctx) => {
    ctx.json({ status: 'ok', version: 'v1' });
  });

  app.use('/api/v1', apiRouter);

  // Test basic routes
  app.get('/', (ctx) => {
    ctx.json({ 
      message: 'Spark Framework Test Server',
      features: [
        'Security hardening',
        'Memory leak protection',
        'ReDoS protection',
        'Enhanced error handling',
        'TypeScript support',
        'Health monitoring',
        'Metrics collection'
      ]
    });
  });

  // Note: Error handler will be automatically invoked when errors occur

  return new Promise((resolve, reject) => {
    app.listen(0, '127.0.0.1', () => {
      const port = app.server.address().port;
      console.log(`✅ Server started on port ${port}`);
      
      runTests(port)
        .then(() => {
          app.close();
          resolve();
        })
        .catch((error) => {
          app.close();
          reject(error);
        });
    });

    app.on('error', reject);
  });
}

async function runTests(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  
  console.log('🔍 Running integration tests...\n');

  // Test 1: Basic GET request
  console.log('Test 1: Basic GET request');
  const response1 = await makeRequest(`${baseUrl}/`);
  console.log('Response status:', response1.statusCode);
  console.log('Response data:', response1.data);
  assert(response1.statusCode === 200, `Status should be 200, got ${response1.statusCode}`);
  assert(response1.data.message && response1.data.message.includes('Spark Framework'), 'Should contain framework name');
  console.log('✅ Basic GET test passed\n');

  // Test 2: Router test
  console.log('Test 2: Router functionality');
  const response2 = await makeRequest(`${baseUrl}/test`);
  console.log('Router test response status:', response2.statusCode);
  console.log('Router test response data:', response2.data);
  assert(response2.statusCode === 200, `Router status should be 200, got ${response2.statusCode}`);
  assert(response2.data.message === 'Router test successful', 'Router message should match');
  console.log('✅ Router test passed\n');

  // Test 3: POST with body parser
  console.log('Test 3: POST with body parser');
  const testData = { test: 'data', number: 123 };
  const response3 = await makeRequest(`${baseUrl}/echo`, 'POST', testData);
  assert(response3.statusCode === 200, 'POST status should be 200');
  assert(JSON.stringify(response3.data.received) === JSON.stringify(testData), 'Body should be parsed correctly');
  console.log('✅ Body parser test passed\n');

  // Test 4: Path parameters
  console.log('Test 4: Path parameters');
  const response4 = await makeRequest(`${baseUrl}/users/12345`);
  assert(response4.statusCode === 200, 'Path param status should be 200');
  assert(response4.data.userId === '12345', 'Path parameter should be extracted');
  console.log('✅ Path parameters test passed\n');

  // Test 5: Route groups
  console.log('Test 5: Route groups');
  const response5 = await makeRequest(`${baseUrl}/api/v1/status`);
  console.log('Route group response status:', response5.statusCode);
  console.log('Route group response data:', response5.data);
  assert(response5.statusCode === 200, 'Route group status should be 200');
  assert(response5.data.status === 'ok', 'Route group should work');
  console.log('✅ Route groups test passed\n');

  // Test 6: Health check
  console.log('Test 6: Health check endpoint');
  const response6 = await makeRequest(`${baseUrl}/_health`);
  assert(response6.statusCode === 200, 'Health check status should be 200');
  assert(response6.data.status === 'healthy', 'Health status should be healthy');
  assert(Array.isArray(response6.data.checks), 'Should have checks array');
  console.log('✅ Health check test passed\n');

  // Test 7: Metrics endpoint
  console.log('Test 7: Metrics collection');
  const response7 = await makeRequest(`${baseUrl}/_metrics`);
  assert(response7.statusCode === 200, 'Metrics status should be 200');
  assert(typeof response7.data.requests === 'object', 'Should have requests metrics');
  assert(response7.data.requests.total > 0, 'Should have recorded requests');
  console.log('✅ Metrics test passed\n');

  // Test 8: Error handling
  console.log('Test 8: Error handling');
  const response8 = await makeRequest(`${baseUrl}/error`);
  assert(response8.statusCode === 400, `Error status should be 400, got ${response8.statusCode}`);
  assert(response8.data.error === 'Test error', 'Error message should match');
  assert(response8.data.status === 400, 'Error status should be in response');
  console.log('✅ Error handling test passed\n');

  // Test 9: CORS headers
  console.log('Test 9: CORS headers');
  const response9 = await makeRequestWithOrigin(`${baseUrl}/`, 'GET', null, 'http://localhost:3000');
  console.log('CORS headers:', response9.headers);
  assert(response9.headers['access-control-allow-origin'], 'Should have CORS headers');
  console.log('✅ CORS test passed\n');

  console.log('🎉 All integration tests passed!');
}

function makeRequestWithOrigin(url, method = 'GET', data = null, origin = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Spark-Test/1.0'
      }
    };

    if (origin) {
      options.headers['Origin'] = origin;
    }

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: { raw: body }
          });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Spark-Test/1.0'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: { raw: body }
          });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Run the test
testFramework()
  .then(() => {
    console.log('\n✅ Framework integration test completed successfully!');
    console.log('🚀 All refactored features are working correctly.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });