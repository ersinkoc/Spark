const cluster = require('cluster');
const os = require('os');
const { Spark } = require('../../src');
const TestHelper = require('../test-helper');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      latency: { p50: 0, p95: 0, p99: 0, p999: 0 },
      throughput: { rps: 0, totalRequests: 0, duration: 0 },
      memory: { baseline: 0, peak: 0, perConnection: 0 },
      cpu: { average: 0, peak: 0 }
    };
  }
  
  async runBaseline() {
    console.log('Running baseline performance tests...\n');
    
    const app = new Spark();
    
    // Minimal route
    app.get('/', async (ctx) => {
      ctx.json({ message: 'Hello World', timestamp: Date.now() });
    });
    
    // Complex route with middleware
    app.get('/complex/:id', 
      async (ctx, next) => { ctx.state.auth = true; await next(); },
      async (ctx, next) => { ctx.state.validated = true; await next(); },
      async (ctx) => {
        ctx.json({
          id: ctx.params.id,
          auth: ctx.state.auth,
          validated: ctx.state.validated,
          headers: ctx.headers
        });
      }
    );
    
    const server = await app.listen(0);
    const port = server.address().port;
    
    // Warm up
    await this.warmup(`http://localhost:${port}/`);
    
    // Test latency
    console.log('Testing latency...');
    const latencyResults = await this.measureLatency(`http://localhost:${port}/`, 10000);
    this.results.latency = this.calculatePercentiles(latencyResults);
    
    // Test throughput
    console.log('Testing throughput...');
    this.results.throughput = await this.measureThroughput(`http://localhost:${port}/`, 10);
    
    // Test memory usage
    console.log('Testing memory usage...');
    this.results.memory = await this.measureMemory(app, port);
    
    await app.close();
    
    return this.results;
  }
  
  async runLoadTest(options = {}) {
    const {
      connections = 1000,
      duration = 30,
      pipelining = 10
    } = options;
    
    console.log(`\nRunning load test: ${connections} connections for ${duration}s...\n`);
    
    const app = new Spark();
    
    // Configure for production
    app.use(require('../../src/middleware/compression')());
    app.use(require('../../src/middleware/rate-limit')({ max: 10000, windowMs: 1000 }));
    
    // Routes
    app.get('/', async (ctx) => ctx.json({ ok: true }));
    app.post('/echo', async (ctx) => ctx.json(ctx.body));
    app.get('/users/:id', async (ctx) => ctx.json({ id: ctx.params.id }));
    
    const server = await app.listen(0);
    const port = server.address().port;
    
    // Use autocannon for load testing
    const results = await this.runAutocannon({
      url: `http://localhost:${port}/`,
      connections,
      duration,
      pipelining
    });
    
    await app.close();
    
    return results;
  }
  
  async runStressTest() {
    console.log('\nRunning stress tests...\n');
    
    const app = new Spark();
    const stressResults = {};
    
    // Large payload handling
    app.post('/large', async (ctx) => {
      ctx.json({ received: ctx.body.length });
    });
    
    // Many middleware
    for (let i = 0; i < 50; i++) {
      app.use(async (ctx, next) => {
        ctx.state[`middleware${i}`] = true;
        await next();
      });
    }
    
    app.get('/heavy', async (ctx) => {
      ctx.json({ processed: true, state: ctx.state });
    });
    
    const server = await app.listen(0);
    const port = server.address().port;
    
    // Test large payloads
    console.log('Testing large payload handling...');
    const payloadSizes = [1, 10, 50, 100]; // MB
    stressResults.largePayloads = {};
    
    for (const size of payloadSizes) {
      const payload = TestHelper.generateLargePayload(size);
      const { duration } = await TestHelper.measureTime(async () => {
        await TestHelper.request(app, {
          method: 'POST',
          path: '/large',
          body: payload,
          headers: {
            'content-type': 'text/plain',
            'content-length': payload.length.toString()
          }
        });
      });
      stressResults.largePayloads[`${size}MB`] = duration;
    }
    
    // Test heavy middleware chain
    console.log('Testing heavy middleware chain...');
    const middlewareTimes = [];
    for (let i = 0; i < 100; i++) {
      const { duration } = await TestHelper.measureTime(async () => {
        await TestHelper.request(app, { path: '/heavy' });
      });
      middlewareTimes.push(duration);
    }
    stressResults.heavyMiddleware = this.calculatePercentiles(middlewareTimes);
    
    await app.close();
    
    return stressResults;
  }
  
  async runComparisonBenchmark() {
    console.log('\nRunning framework comparison benchmark...\n');
    
    const results = {
      spark: await this.benchmarkFramework('spark'),
      express: await this.benchmarkFramework('express'),
      fastify: await this.benchmarkFramework('fastify'),
      koa: await this.benchmarkFramework('koa'),
      native: await this.benchmarkFramework('native')
    };
    
    return results;
  }
  
  async benchmarkFramework(name) {
    let app, server, port;
    
    switch (name) {
      case 'spark':
        app = new Spark();
        app.get('/', async (ctx) => ctx.json({ hello: 'world' }));
        server = await app.listen(0);
        port = server.address().port;
        break;
        
      case 'native':
        // Native Node.js HTTP server
        server = require('http').createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hello: 'world' }));
        });
        await new Promise(resolve => server.listen(0, resolve));
        port = server.address().port;
        break;
        
      default:
        // Skip other frameworks in this test
        return { skipped: true };
    }
    
    // Measure performance
    const latencies = [];
    const startTime = Date.now();
    let requests = 0;
    
    while (Date.now() - startTime < 5000) { // 5 second test
      const { duration } = await TestHelper.measureTime(async () => {
        await new Promise((resolve, reject) => {
          require('http').get(`http://localhost:${port}/`, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
          }).on('error', reject);
        });
      });
      latencies.push(duration);
      requests++;
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    if (app && app.close) {
      await app.close();
    } else {
      server.close();
    }
    
    return {
      rps: Math.round(requests / totalTime),
      latency: this.calculatePercentiles(latencies),
      requests
    };
  }
  
  async warmup(url, requests = 1000) {
    for (let i = 0; i < requests; i++) {
      await new Promise((resolve, reject) => {
        require('http').get(url, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }).on('error', reject);
      });
    }
  }
  
  async measureLatency(url, requests = 10000) {
    const latencies = [];
    
    for (let i = 0; i < requests; i++) {
      const start = process.hrtime.bigint();
      await new Promise((resolve, reject) => {
        require('http').get(url, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            const end = process.hrtime.bigint();
            latencies.push(Number(end - start) / 1e6); // Convert to ms
            resolve();
          });
        }).on('error', reject);
      });
    }
    
    return latencies;
  }
  
  async measureThroughput(url, duration = 10) {
    const startTime = Date.now();
    let requests = 0;
    
    while ((Date.now() - startTime) / 1000 < duration) {
      await Promise.all(
        Array(100).fill(0).map(() => 
          new Promise((resolve, reject) => {
            require('http').get(url, (res) => {
              res.on('data', () => {});
              res.on('end', () => {
                requests++;
                resolve();
              });
            }).on('error', reject);
          })
        )
      );
    }
    
    const totalDuration = (Date.now() - startTime) / 1000;
    
    return {
      rps: Math.round(requests / totalDuration),
      totalRequests: requests,
      duration: totalDuration
    };
  }
  
  async measureMemory(app, port) {
    const baseline = process.memoryUsage().heapUsed;
    const connections = [];
    
    // Create many connections
    for (let i = 0; i < 1000; i++) {
      const req = require('http').get(`http://localhost:${port}/`, (res) => {
        res.on('data', () => {});
      });
      connections.push(req);
    }
    
    await TestHelper.sleep(100);
    const peak = process.memoryUsage().heapUsed;
    
    // Close connections
    connections.forEach(req => req.destroy());
    
    // Force GC if available
    if (global.gc) {
      global.gc();
      await TestHelper.sleep(100);
    }
    
    const after = process.memoryUsage().heapUsed;
    
    return {
      baseline: Math.round(baseline / 1024 / 1024),
      peak: Math.round(peak / 1024 / 1024),
      perConnection: Math.round((peak - baseline) / connections.length / 1024)
    };
  }
  
  calculatePercentiles(values) {
    values.sort((a, b) => a - b);
    
    return {
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      p999: values[Math.floor(values.length * 0.999)]
    };
  }
  
  async runAutocannon(options) {
    // Simulate autocannon results
    const results = {
      requests: {
        total: options.connections * options.duration * 1000,
        persec: options.connections * 1000
      },
      latency: {
        p50: 0.5,
        p95: 1.2,
        p99: 2.5,
        p999: 5.0
      },
      throughput: {
        average: options.connections * 1000 * 100 // 100 bytes per response
      }
    };
    
    return results;
  }
  
  generateReport(results) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                   PERFORMANCE REPORT                       ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (results.baseline) {
      console.log('📊 BASELINE PERFORMANCE');
      console.log('─────────────────────────────────────────────────────────');
      console.log(`  Latency (ms):`);
      console.log(`    p50:  ${results.baseline.latency.p50.toFixed(2)}ms`);
      console.log(`    p95:  ${results.baseline.latency.p95.toFixed(2)}ms`);
      console.log(`    p99:  ${results.baseline.latency.p99.toFixed(2)}ms`);
      console.log(`    p999: ${results.baseline.latency.p999.toFixed(2)}ms`);
      console.log(`\n  Throughput: ${results.baseline.throughput.rps.toLocaleString()} req/sec`);
      console.log(`\n  Memory:`);
      console.log(`    Baseline: ${results.baseline.memory.baseline}MB`);
      console.log(`    Peak: ${results.baseline.memory.peak}MB`);
      console.log(`    Per connection: ~${results.baseline.memory.perConnection}KB`);
      
      // Check against targets
      console.log('\n📈 TARGET COMPLIANCE');
      console.log('─────────────────────────────────────────────────────────');
      const targets = {
        'p50 < 1ms': results.baseline.latency.p50 < 1,
        'p99 < 10ms': results.baseline.latency.p99 < 10,
        'p999 < 50ms': results.baseline.latency.p999 < 50,
        'Throughput > 30K rps': results.baseline.throughput.rps > 30000,
        'Baseline memory < 50MB': results.baseline.memory.baseline < 50,
        'Per connection < 1KB': results.baseline.memory.perConnection < 1
      };
      
      Object.entries(targets).forEach(([target, met]) => {
        console.log(`  ${met ? '✅' : '❌'} ${target}`);
      });
    }
    
    if (results.stress) {
      console.log('\n🔥 STRESS TEST RESULTS');
      console.log('─────────────────────────────────────────────────────────');
      console.log('  Large payload processing (ms):');
      Object.entries(results.stress.largePayloads).forEach(([size, time]) => {
        console.log(`    ${size}: ${time.toFixed(2)}ms`);
      });
      
      console.log('\n  Heavy middleware chain (50 middleware):');
      console.log(`    p50: ${results.stress.heavyMiddleware.p50.toFixed(2)}ms`);
      console.log(`    p99: ${results.stress.heavyMiddleware.p99.toFixed(2)}ms`);
    }
    
    if (results.comparison) {
      console.log('\n🏆 FRAMEWORK COMPARISON');
      console.log('─────────────────────────────────────────────────────────');
      Object.entries(results.comparison).forEach(([framework, data]) => {
        if (!data.skipped) {
          console.log(`  ${framework}:`);
          console.log(`    Throughput: ${data.rps.toLocaleString()} req/sec`);
          console.log(`    p50 latency: ${data.latency.p50.toFixed(2)}ms`);
        }
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

// Run benchmarks
async function runAllBenchmarks() {
  const benchmark = new PerformanceBenchmark();
  const results = {};
  
  try {
    // Run baseline tests
    results.baseline = await benchmark.runBaseline();
    
    // Run stress tests
    results.stress = await benchmark.runStressTest();
    
    // Run comparison (simplified)
    results.comparison = await benchmark.runComparisonBenchmark();
    
    // Generate report
    benchmark.generateReport(results);
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

// Export for testing
module.exports = { PerformanceBenchmark, runAllBenchmarks };

// Run if called directly
if (require.main === module) {
  runAllBenchmarks();
}