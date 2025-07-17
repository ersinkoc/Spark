#!/usr/bin/env node

/**
 * Benchmark comparison: @oxog/spark vs Express.js
 */

const { Spark } = require('../src');

console.log('📊 Benchmarking @oxog/spark vs Express.js\n');

class ExpressBenchmark {
  async run() {
    console.log('⚠️  Note: This benchmark runs Spark standalone.');
    console.log('To compare with Express, install express separately and run both.\n');

    // Run Spark benchmarks
    await this.benchmarkSpark();
    
    // Note about Express
    console.log('\nTo benchmark Express:');
    console.log('1. npm install express');
    console.log('2. Run equivalent Express server');
    console.log('3. Use tools like autocannon or wrk for comparison\n');
    
    console.log('Example autocannon command:');
    console.log('autocannon -c 100 -d 30 http://localhost:3000\n');
  }

  async benchmarkSpark() {
    console.log('Running Spark benchmarks...\n');

    // Test 1: Hello World
    await this.testHelloWorld();

    // Test 2: JSON Response
    await this.testJSON();

    // Test 3: Routing
    await this.testRouting();

    // Test 4: Middleware Chain
    await this.testMiddleware();

    // Test 5: Static Files
    await this.testStatic();
  }

  async testHelloWorld() {
    console.log('1. Hello World Benchmark');
    console.log('-'.repeat(40));

    const app = new Spark();
    app.use((ctx) => {
      ctx.body = 'Hello World';
    });

    const results = await this.runBenchmark(app, 'Hello World');
    this.printResults('Spark (Hello World)', results);
  }

  async testJSON() {
    console.log('\n2. JSON Response Benchmark');
    console.log('-'.repeat(40));

    const app = new Spark();
    app.use((ctx) => {
      ctx.body = {
        message: 'Hello World',
        timestamp: Date.now(),
        data: { id: 1, name: 'Test' }
      };
    });

    const results = await this.runBenchmark(app, 'JSON Response');
    this.printResults('Spark (JSON)', results);
  }

  async testRouting() {
    console.log('\n3. Routing Benchmark');
    console.log('-'.repeat(40));

    const app = new Spark();
    const { Router } = require('../src');
    const router = new Router();

    // Add 100 routes
    for (let i = 0; i < 100; i++) {
      router.get(`/route${i}`, (ctx) => {
        ctx.body = `Route ${i}`;
      });
    }

    app.use(router.routes());

    const results = await this.runBenchmark(app, 'Routing', '/route50');
    this.printResults('Spark (100 routes)', results);
  }

  async testMiddleware() {
    console.log('\n4. Middleware Chain Benchmark');
    console.log('-'.repeat(40));

    const app = new Spark();

    // Add 10 middleware
    for (let i = 0; i < 10; i++) {
      app.use(async (ctx, next) => {
        ctx.state[`mw${i}`] = true;
        await next();
      });
    }

    app.use((ctx) => {
      ctx.body = 'OK';
    });

    const results = await this.runBenchmark(app, 'Middleware');
    this.printResults('Spark (10 middleware)', results);
  }

  async testStatic() {
    console.log('\n5. Static File Benchmark');
    console.log('-'.repeat(40));

    const app = new Spark();
    const { static: staticMiddleware } = require('../src/middleware');
    const fs = require('fs');
    const path = require('path');

    // Create test file
    const testDir = path.join(__dirname, 'test-static');
    const testFile = path.join(testDir, 'test.txt');
    
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, 'x'.repeat(1024)); // 1KB file

    app.use(staticMiddleware(testDir));

    const results = await this.runBenchmark(app, 'Static Files', '/test.txt');
    this.printResults('Spark (Static)', results);

    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);
  }

  async runBenchmark(app, name, path = '/') {
    return new Promise((resolve) => {
      app.listen(0, async () => {
        const server = app.server;
        const port = server.address().port;
        const http = require('http');
        
        // Warmup
        for (let i = 0; i < 100; i++) {
          await this.makeRequest(port, path);
        }

        // Benchmark
        const duration = 10000; // 10 seconds
        const start = Date.now();
        let requests = 0;
        let errors = 0;
        const latencies = [];

        while (Date.now() - start < duration) {
          const reqStart = process.hrtime.bigint();
          
          try {
            await this.makeRequest(port, path);
            const reqEnd = process.hrtime.bigint();
            const latency = Number(reqEnd - reqStart) / 1000000; // ms
            latencies.push(latency);
            requests++;
          } catch (e) {
            errors++;
          }
        }

        const actualDuration = Date.now() - start;
        
        // Calculate stats
        latencies.sort((a, b) => a - b);
        const results = {
          requests,
          duration: actualDuration,
          rps: Math.round(requests / (actualDuration / 1000)),
          errors,
          latency: {
            min: latencies[0] || 0,
            max: latencies[latencies.length - 1] || 0,
            mean: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
            p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
            p90: latencies[Math.floor(latencies.length * 0.9)] || 0,
            p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
            p99: latencies[Math.floor(latencies.length * 0.99)] || 0
          }
        };

        server.close();
        resolve(results);
      });
    });
  }

  async makeRequest(port, path) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const req = http.get(`http://localhost:${port}${path}`, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.setTimeout(1000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  printResults(name, results) {
    console.log(`\n${name} Results:`);
    console.log(`Requests/sec: ${results.rps}`);
    console.log(`Total requests: ${results.requests}`);
    console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`Errors: ${results.errors}`);
    console.log('\nLatency (ms):');
    console.log(`  Min: ${results.latency.min.toFixed(2)}`);
    console.log(`  Mean: ${results.latency.mean.toFixed(2)}`);
    console.log(`  P50: ${results.latency.p50.toFixed(2)}`);
    console.log(`  P90: ${results.latency.p90.toFixed(2)}`);
    console.log(`  P95: ${results.latency.p95.toFixed(2)}`);
    console.log(`  P99: ${results.latency.p99.toFixed(2)}`);
    console.log(`  Max: ${results.latency.max.toFixed(2)}`);
  }

  printExpressExample() {
    console.log('\n' + '='.repeat(60));
    console.log('Express.js Equivalent Code:');
    console.log('='.repeat(60));
    
    console.log(`
// Hello World
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(3000);

// JSON Response
app.get('/json', (req, res) => {
  res.json({
    message: 'Hello World',
    timestamp: Date.now(),
    data: { id: 1, name: 'Test' }
  });
});

// Routing (100 routes)
for (let i = 0; i < 100; i++) {
  app.get(\`/route\${i}\`, (req, res) => {
    res.send(\`Route \${i}\`);
  });
}

// Middleware Chain (10 middleware)
for (let i = 0; i < 10; i++) {
  app.use((req, res, next) => {
    req[\`mw\${i}\`] = true;
    next();
  });
}

// Static Files
app.use(express.static('public'));
`);
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run benchmark
if (require.main === module) {
  const benchmark = new ExpressBenchmark();
  benchmark.run().then(() => {
    benchmark.printExpressExample();
    
    console.log('\n📊 Benchmark Complete!');
    console.log('\nTo compare with Express:');
    console.log('1. Run the Express equivalent with the same benchmarking tool');
    console.log('2. Compare the requests/sec and latency metrics');
    console.log('3. Spark should show better performance due to zero dependencies\n');
  }).catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = ExpressBenchmark;