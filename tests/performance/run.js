#!/usr/bin/env node

/**
 * Performance test runner for @oxog/spark
 * Runs performance benchmarks and stress tests
 */

const { Spark, Router } = require('../../src');
const http = require('http');

class PerformanceTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('⚡ Running performance tests for @oxog/spark\n');

    const tests = [
      this.testStartupTime(),
      this.testRequestThroughput(),
      this.testRoutingPerformance(),
      this.testMiddlewareOverhead(),
      this.testMemoryUsage(),
      this.testConcurrentConnections(),
      this.testResponseTime(),
      this.testStaticFileServing(),
      this.testBodyParsing(),
      this.testStreamingPerformance()
    ];

    for (const test of tests) {
      await test;
    }

    this.printReport();
    
    const failed = this.results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  }

  async testStartupTime() {
    const name = 'Application Startup Time';
    console.log(`Testing ${name}...`);

    const startTime = Date.now();
    const app = new Spark();
    
    await new Promise((resolve) => {
      app.listen(0, resolve);
    });
    
    const duration = Date.now() - startTime;
    app.close();

    const passed = duration < 100; // Should start in less than 100ms
    
    this.results.push({
      name,
      passed,
      metric: `${duration}ms`,
      threshold: '< 100ms'
    });

    return { name, duration, passed };
  }

  async testRequestThroughput() {
    const name = 'Request Throughput';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    app.use((ctx) => {
      ctx.body = 'OK';
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    const requests = 10000;
    const startTime = Date.now();

    // Make requests
    const promises = [];
    for (let i = 0; i < requests; i++) {
      promises.push(this.makeRequest(port, '/'));
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    server.close();

    const rps = Math.round(requests / (duration / 1000));
    const passed = rps > 5000; // Should handle at least 5000 req/s

    this.results.push({
      name,
      passed,
      metric: `${rps} req/s`,
      threshold: '> 5000 req/s'
    });

    return { name, rps, passed };
  }

  async testRoutingPerformance() {
    const name = 'Routing Performance';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    const router = new Router();

    // Add many routes
    for (let i = 0; i < 1000; i++) {
      router.get(`/route${i}`, (ctx) => {
        ctx.body = `Route ${i}`;
      });
    }

    app.use(router.routes());

    const server = await this.startServer(app);
    const port = server.address().port;

    // Test routing to different routes
    const testRoutes = ['/route0', '/route500', '/route999'];
    const times = [];

    for (const route of testRoutes) {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        await this.makeRequest(port, route);
      }
      
      times.push(Date.now() - startTime);
    }

    server.close();

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const avgPerRequest = avgTime / 1000;
    const passed = avgPerRequest < 1; // Less than 1ms per request

    this.results.push({
      name,
      passed,
      metric: `${avgPerRequest.toFixed(2)}ms per request`,
      threshold: '< 1ms',
      details: `Tested with 1000 routes`
    });

    return { name, avgPerRequest, passed };
  }

  async testMiddlewareOverhead() {
    const name = 'Middleware Overhead';
    console.log(`Testing ${name}...`);

    // Test with no middleware
    const app1 = new Spark();
    app1.use((ctx) => {
      ctx.body = 'OK';
    });

    const server1 = await this.startServer(app1);
    const port1 = server1.address().port;

    const baselineStart = Date.now();
    for (let i = 0; i < 5000; i++) {
      await this.makeRequest(port1, '/');
    }
    const baselineTime = Date.now() - baselineStart;
    server1.close();

    // Test with 10 middleware
    const app2 = new Spark();
    for (let i = 0; i < 10; i++) {
      app2.use(async (ctx, next) => {
        ctx.state[`mw${i}`] = true;
        await next();
      });
    }
    app2.use((ctx) => {
      ctx.body = 'OK';
    });

    const server2 = await this.startServer(app2);
    const port2 = server2.address().port;

    const middlewareStart = Date.now();
    for (let i = 0; i < 5000; i++) {
      await this.makeRequest(port2, '/');
    }
    const middlewareTime = Date.now() - middlewareStart;
    server2.close();

    const overhead = ((middlewareTime - baselineTime) / baselineTime) * 100;
    const passed = overhead < 20; // Less than 20% overhead

    this.results.push({
      name,
      passed,
      metric: `${overhead.toFixed(1)}% overhead`,
      threshold: '< 20%',
      details: `10 middleware layers`
    });

    return { name, overhead, passed };
  }

  async testMemoryUsage() {
    const name = 'Memory Usage';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    app.use((ctx) => {
      ctx.body = { data: 'x'.repeat(1000) };
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    // Force GC if available
    if (global.gc) global.gc();
    
    const initialMemory = process.memoryUsage().heapUsed;

    // Make many requests
    for (let i = 0; i < 10000; i++) {
      await this.makeRequest(port, '/');
    }

    // Force GC again
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    server.close();

    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    const passed = memoryIncrease < 50; // Less than 50MB increase

    this.results.push({
      name,
      passed,
      metric: `${memoryIncrease.toFixed(2)}MB increase`,
      threshold: '< 50MB',
      details: `After 10,000 requests`
    });

    return { name, memoryIncrease, passed };
  }

  async testConcurrentConnections() {
    const name = 'Concurrent Connections';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    let activeConnections = 0;
    let maxConnections = 0;

    app.use(async (ctx) => {
      activeConnections++;
      maxConnections = Math.max(maxConnections, activeConnections);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      ctx.body = 'OK';
      activeConnections--;
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    // Make concurrent requests
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(this.makeRequest(port, '/'));
    }

    await Promise.all(promises);
    server.close();

    const passed = maxConnections > 100; // Should handle at least 100 concurrent

    this.results.push({
      name,
      passed,
      metric: `${maxConnections} concurrent`,
      threshold: '> 100',
      details: `Peak concurrent connections`
    });

    return { name, maxConnections, passed };
  }

  async testResponseTime() {
    const name = 'Response Time';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    app.use((ctx) => {
      ctx.body = 'Hello World';
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    const times = [];
    
    // Warm up
    for (let i = 0; i < 100; i++) {
      await this.makeRequest(port, '/');
    }

    // Measure
    for (let i = 0; i < 1000; i++) {
      const start = process.hrtime.bigint();
      await this.makeRequest(port, '/');
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to ms
    }

    server.close();

    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];

    const passed = p95 < 10; // 95th percentile under 10ms

    this.results.push({
      name,
      passed,
      metric: `p95: ${p95.toFixed(2)}ms`,
      threshold: 'p95 < 10ms',
      details: `p50: ${p50.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`
    });

    return { name, p50, p95, p99, passed };
  }

  async testStaticFileServing() {
    const name = 'Static File Serving';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    const { static: staticMiddleware } = require('../../src/middleware');
    
    // Create test file
    const fs = require('fs');
    const path = require('path');
    const testDir = path.join(__dirname, 'test-static');
    const testFile = path.join(testDir, 'test.txt');
    
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, 'x'.repeat(10 * 1024)); // 10KB file

    app.use(staticMiddleware(testDir));

    const server = await this.startServer(app);
    const port = server.address().port;

    const start = Date.now();
    const requests = 1000;

    for (let i = 0; i < requests; i++) {
      await this.makeRequest(port, '/test.txt');
    }

    const duration = Date.now() - start;
    const throughput = (10 * requests) / (duration / 1000) / 1024; // MB/s

    server.close();
    
    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);

    const passed = throughput > 100; // At least 100 MB/s

    this.results.push({
      name,
      passed,
      metric: `${throughput.toFixed(2)} MB/s`,
      threshold: '> 100 MB/s',
      details: `10KB file, 1000 requests`
    });

    return { name, throughput, passed };
  }

  async testBodyParsing() {
    const name = 'Body Parsing Performance';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    const { bodyParser } = require('../../src/middleware');
    
    app.use(bodyParser());
    app.use((ctx) => {
      ctx.body = { received: Object.keys(ctx.request.body).length };
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    // Test with different payload sizes
    const sizes = [1, 10, 100]; // KB
    const results = {};

    for (const size of sizes) {
      const payload = JSON.stringify({
        data: 'x'.repeat(size * 1024)
      });

      const start = Date.now();
      const requests = 100;

      for (let i = 0; i < requests; i++) {
        await this.makePostRequest(port, '/', payload);
      }

      const duration = Date.now() - start;
      const rps = Math.round(requests / (duration / 1000));
      results[`${size}KB`] = rps;
    }

    server.close();

    const passed = results['100KB'] > 100; // At least 100 req/s for 100KB payloads

    this.results.push({
      name,
      passed,
      metric: `${results['100KB']} req/s (100KB)`,
      threshold: '> 100 req/s',
      details: `1KB: ${results['1KB']}, 10KB: ${results['10KB']}, 100KB: ${results['100KB']} req/s`
    });

    return { name, results, passed };
  }

  async testStreamingPerformance() {
    const name = 'Streaming Performance';
    console.log(`Testing ${name}...`);

    const app = new Spark();
    const { Readable } = require('stream');

    app.use((ctx) => {
      if (ctx.path === '/stream') {
        const stream = new Readable({
          read() {
            // Push 1MB of data in chunks
            for (let i = 0; i < 100; i++) {
              this.push('x'.repeat(10 * 1024)); // 10KB chunks
            }
            this.push(null);
          }
        });
        ctx.body = stream;
      }
    });

    const server = await this.startServer(app);
    const port = server.address().port;

    const start = Date.now();
    const requests = 100;
    let totalBytes = 0;

    for (let i = 0; i < requests; i++) {
      const bytes = await this.measureStreamDownload(port, '/stream');
      totalBytes += bytes;
    }

    const duration = Date.now() - start;
    const throughput = (totalBytes / (duration / 1000)) / (1024 * 1024); // MB/s

    server.close();

    const passed = throughput > 500; // At least 500 MB/s

    this.results.push({
      name,
      passed,
      metric: `${throughput.toFixed(2)} MB/s`,
      threshold: '> 500 MB/s',
      details: `1MB streams, 100 requests`
    });

    return { name, throughput, passed };
  }

  // Helper methods

  async startServer(app) {
    return new Promise((resolve) => {
      const server = app.listen(0, () => resolve(server));
    });
  }

  async makeRequest(port, path) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}${path}`, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
    });
  }

  async makePostRequest(port, path, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async measureStreamDownload(port, path) {
    return new Promise((resolve, reject) => {
      let bytes = 0;
      
      const req = http.get(`http://localhost:${port}${path}`, (res) => {
        res.on('data', (chunk) => {
          bytes += chunk.length;
        });
        res.on('end', () => resolve(bytes));
      });
      
      req.on('error', reject);
    });
  }

  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE TEST REPORT');
    console.log('='.repeat(80));
    
    console.log('\nResults:');
    console.log('-'.repeat(80));
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name.padEnd(30)} ${result.metric.padEnd(20)} (threshold: ${result.threshold})`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '-'.repeat(80));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(80));
    
    if (failed === 0) {
      console.log('\n✅ All performance tests passed!');
    } else {
      console.log('\n❌ Some performance tests failed.');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run().catch(error => {
    console.error('Performance test runner failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTestRunner;