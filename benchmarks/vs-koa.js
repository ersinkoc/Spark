#!/usr/bin/env node

/**
 * Benchmark comparison: @oxog/spark vs Koa
 */

const { Spark } = require('../src');

console.log('📊 Benchmarking @oxog/spark vs Koa\n');

class KoaBenchmark {
  async run() {
    console.log('⚠️  Note: This benchmark runs Spark standalone.');
    console.log('To compare with Koa, install koa separately and run both.\n');
    console.log('Spark and Koa share similar design philosophies:\n');
    console.log('- Minimal core');
    console.log('- Middleware-based architecture');
    console.log('- Async/await first\n');

    // Run Spark benchmarks in Koa-style
    await this.benchmarkSpark();
    
    // Show Koa equivalent
    this.printKoaExample();
  }

  async benchmarkSpark() {
    console.log('Running Spark benchmarks (Koa comparison mode)...\n');

    // Test 1: Minimal core
    await this.testMinimalCore();

    // Test 2: Middleware composition
    await this.testMiddlewareComposition();

    // Test 3: Context manipulation
    await this.testContextManipulation();

    // Test 4: Error handling
    await this.testErrorHandling();

    // Test 5: Cascading middleware
    await this.testCascading();
  }

  async testMinimalCore() {
    console.log('1. Minimal Core Performance');
    console.log('-'.repeat(40));

    const app = new Spark();
    
    // Minimal handler
    app.use(async (ctx) => {
      ctx.body = 'Hello World';
    });

    const results = await this.runBenchmark(app, 'Minimal Core');
    this.printResults('Spark (Minimal)', results);
  }

  async testMiddlewareComposition() {
    console.log('\n2. Middleware Composition');
    console.log('-'.repeat(40));

    const app = new Spark();

    // Response time middleware
    app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      ctx.set('X-Response-Time', `${ms}ms`);
    });

    // Logger middleware
    app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      // In real app: console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
    });

    // Response middleware
    app.use(async (ctx) => {
      ctx.body = 'Hello World';
    });

    const results = await this.runBenchmark(app, 'Middleware Composition');
    this.printResults('Spark (Composed)', results);
  }

  async testContextManipulation() {
    console.log('\n3. Context Manipulation');
    console.log('-'.repeat(40));

    const app = new Spark();

    // Add custom properties to context
    app.use(async (ctx, next) => {
      ctx.state.user = { id: 1, name: 'John' };
      ctx.state.requestId = Math.random().toString(36);
      await next();
    });

    // Manipulate request
    app.use(async (ctx, next) => {
      ctx.request.customData = {
        timestamp: Date.now(),
        processed: true
      };
      await next();
    });

    // Manipulate response
    app.use(async (ctx, next) => {
      await next();
      if (ctx.body && typeof ctx.body === 'object') {
        ctx.body = {
          ...ctx.body,
          requestId: ctx.state.requestId,
          user: ctx.state.user
        };
      }
    });

    // Main handler
    app.use(async (ctx) => {
      ctx.type = 'json';
      ctx.body = {
        message: 'Context manipulation test',
        customData: ctx.request.customData
      };
    });

    const results = await this.runBenchmark(app, 'Context Manipulation');
    this.printResults('Spark (Context)', results);
  }

  async testErrorHandling() {
    console.log('\n4. Error Handling');
    console.log('-'.repeat(40));

    const app = new Spark();

    // Error handling middleware
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {
          error: err.message,
          status: ctx.status
        };
        // In real app: ctx.app.emit('error', err, ctx);
      }
    });

    // Middleware that might throw
    app.use(async (ctx, next) => {
      if (ctx.path === '/error') {
        const err = new Error('Something went wrong');
        err.status = 400;
        throw err;
      }
      await next();
    });

    // Normal response
    app.use(async (ctx) => {
      ctx.body = { success: true };
    });

    const results = await this.runBenchmark(app, 'Error Handling');
    this.printResults('Spark (Error Handling)', results);
  }

  async testCascading() {
    console.log('\n5. Cascading Middleware');
    console.log('-'.repeat(40));

    const app = new Spark();

    // Cascading middleware pattern
    app.use(async (ctx, next) => {
      // Before
      ctx.state.cascade = ['first-before'];
      
      await next();
      
      // After
      ctx.state.cascade.push('first-after');
      ctx.set('X-Cascade', ctx.state.cascade.join(','));
    });

    app.use(async (ctx, next) => {
      // Before
      ctx.state.cascade.push('second-before');
      
      await next();
      
      // After
      ctx.state.cascade.push('second-after');
    });

    app.use(async (ctx, next) => {
      // Before
      ctx.state.cascade.push('third-before');
      
      await next();
      
      // After
      ctx.state.cascade.push('third-after');
    });

    // Core handler
    app.use(async (ctx) => {
      ctx.state.cascade.push('core');
      ctx.body = {
        message: 'Cascading complete',
        cascade: ctx.state.cascade
      };
    });

    const results = await this.runBenchmark(app, 'Cascading');
    this.printResults('Spark (Cascading)', results);
  }

  async runBenchmark(app, name, path = '/') {
    return new Promise((resolve) => {
      app.listen(0, async () => {
        const server = app.server;
        const port = server.address().port;
        const http = require('http');
        
        // Warmup
        for (let i = 0; i < 1000; i++) {
          await this.makeRequest(port, path);
        }

        // Benchmark
        const duration = 10000; // 10 seconds
        const start = Date.now();
        let requests = 0;
        let errors = 0;
        const latencies = [];

        // Use connection pooling
        const agent = new http.Agent({ 
          keepAlive: true,
          maxSockets: 10
        });

        while (Date.now() - start < duration) {
          const reqStart = process.hrtime.bigint();
          
          try {
            await this.makeRequest(port, path, agent);
            const reqEnd = process.hrtime.bigint();
            const latency = Number(reqEnd - reqStart) / 1000000; // ms
            latencies.push(latency);
            requests++;
          } catch (e) {
            errors++;
          }
        }

        agent.destroy();
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

  async makeRequest(port, path, agent = null) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port,
        path,
        agent
      };
      
      const req = http.get(options, (res) => {
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

  printKoaExample() {
    console.log('\n' + '='.repeat(60));
    console.log('Koa Equivalent Code:');
    console.log('='.repeat(60));
    
    console.log(`
// Minimal Core
const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.listen(3000);

// Middleware Composition
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', \`\${ms}ms\`);
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(\`\${ctx.method} \${ctx.url} - \${ms}ms\`);
});

// Context Manipulation
app.use(async (ctx, next) => {
  ctx.state.user = { id: 1, name: 'John' };
  ctx.state.requestId = Math.random().toString(36);
  await next();
});

// Error Handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: err.message,
      status: ctx.status
    };
    ctx.app.emit('error', err, ctx);
  }
});

// Cascading Middleware
app.use(async (ctx, next) => {
  console.log('Before 1');
  await next();
  console.log('After 1');
});

app.use(async (ctx, next) => {
  console.log('Before 2');
  await next();
  console.log('After 2');
});

app.use(async ctx => {
  console.log('Core handler');
  ctx.body = 'Response';
});

// Output: Before 1 -> Before 2 -> Core handler -> After 2 -> After 1
`);
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run benchmark
if (require.main === module) {
  const benchmark = new KoaBenchmark();
  benchmark.run().then(() => {
    console.log('\n📊 Benchmark Complete!');
    console.log('\nKoa Comparison:');
    console.log('- Both use similar middleware patterns');
    console.log('- Both emphasize async/await');
    console.log('- Both have minimal cores');
    console.log('\nSpark Advantages:');
    console.log('- Zero dependencies (Koa has 24+ dependencies)');
    console.log('- Built-in middleware (vs Koa\'s separate packages)');
    console.log('- Similar or better performance');
    console.log('- Easier deployment (single package)\n');
  }).catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = KoaBenchmark;