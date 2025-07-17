#!/usr/bin/env node

const { Spark } = require('../src/index');
const http = require('http');
const cluster = require('cluster');
const os = require('os');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function runBenchmark() {
  console.log(`${colors.blue}🚀 @oxog/spark Benchmark Suite${colors.reset}\n`);
  
  const scenarios = [
    {
      name: 'Basic JSON Response',
      setup: (app) => {
        app.get('/', (ctx) => {
          ctx.json({ message: 'Hello World', timestamp: Date.now() });
        });
      }
    },
    {
      name: 'With Body Parser',
      setup: (app) => {
        app.use(app.middleware.bodyParser());
        app.post('/', (ctx) => {
          ctx.json({ received: ctx.body, timestamp: Date.now() });
        });
      },
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
      headers: { 'Content-Type': 'application/json' }
    },
    {
      name: 'With CORS',
      setup: (app) => {
        app.use(app.middleware.cors());
        app.get('/', (ctx) => {
          ctx.json({ message: 'Hello World', timestamp: Date.now() });
        });
      }
    },
    {
      name: 'With Compression',
      setup: (app) => {
        app.use(app.middleware.compression());
        app.get('/', (ctx) => {
          ctx.json({ 
            message: 'Hello World'.repeat(100), 
            timestamp: Date.now(),
            data: Array(100).fill('test data')
          });
        });
      }
    },
    {
      name: 'With Security Headers',
      setup: (app) => {
        app.use(app.middleware.security());
        app.get('/', (ctx) => {
          ctx.json({ message: 'Hello World', timestamp: Date.now() });
        });
      }
    },
    {
      name: 'Full Middleware Stack',
      setup: (app) => {
        app.use(app.middleware.cors());
        app.use(app.middleware.bodyParser());
        app.use(app.middleware.compression());
        app.use(app.middleware.security());
        app.get('/', (ctx) => {
          ctx.json({ message: 'Hello World', timestamp: Date.now() });
        });
      }
    }
  ];

  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`${colors.cyan}📊 Testing: ${scenario.name}${colors.reset}`);
    
    const app = new Spark();
    scenario.setup(app);
    
    await new Promise((resolve) => {
      app.listen(0, resolve);
    });
    const port = app.server.address().port;
    
    try {
      const result = await benchmarkScenario(port, scenario);
      results.push({ name: scenario.name, ...result });
      
      console.log(`  ${colors.green}✅ ${result.requestsPerSecond.toFixed(0)} req/sec${colors.reset}`);
      console.log(`  ${colors.yellow}📈 ${result.averageLatency.toFixed(2)}ms avg latency${colors.reset}`);
      console.log(`  ${colors.blue}💾 ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB memory${colors.reset}\n`);
    } catch (error) {
      console.log(`  ${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
    } finally {
      await new Promise((resolve) => app.server.close(resolve));
    }
  }
  
  console.log(`${colors.blue}📊 Benchmark Results Summary${colors.reset}`);
  console.log('─'.repeat(60));
  
  results.forEach(result => {
    console.log(`${colors.cyan}${result.name}${colors.reset}`);
    console.log(`  Requests/sec: ${colors.green}${result.requestsPerSecond.toFixed(0)}${colors.reset}`);
    console.log(`  Avg Latency: ${colors.yellow}${result.averageLatency.toFixed(2)}ms${colors.reset}`);
    console.log(`  Memory Usage: ${colors.blue}${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB${colors.reset}`);
    console.log(`  Success Rate: ${colors.green}${result.successRate.toFixed(2)}%${colors.reset}\n`);
  });
  
  const best = results.reduce((best, current) => 
    current.requestsPerSecond > best.requestsPerSecond ? current : best
  );
  
  console.log(`${colors.green}🏆 Best Performance: ${best.name} (${best.requestsPerSecond.toFixed(0)} req/sec)${colors.reset}`);
}

async function benchmarkScenario(port, scenario) {
  const duration = 2000; // 2 seconds for faster validation
  const concurrency = 100;
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  let completedRequests = 0;
  let totalLatency = 0;
  let errors = 0;
  
  const workers = [];
  
  for (let i = 0; i < concurrency; i++) {
    workers.push(benchmarkWorker(port, scenario, duration));
  }
  
  const results = await Promise.all(workers);
  
  const endMemory = process.memoryUsage().heapUsed;
  const totalDuration = Date.now() - startTime;
  
  results.forEach(result => {
    completedRequests += result.requests;
    totalLatency += result.totalLatency;
    errors += result.errors;
  });
  
  return {
    requestsPerSecond: (completedRequests / totalDuration) * 1000,
    averageLatency: totalLatency / completedRequests,
    totalRequests: completedRequests,
    errors,
    successRate: ((completedRequests - errors) / completedRequests) * 100,
    memoryUsage: endMemory - startMemory
  };
}

async function benchmarkWorker(port, scenario, duration) {
  const endTime = Date.now() + duration;
  let requests = 0;
  let totalLatency = 0;
  let errors = 0;
  
  while (Date.now() < endTime) {
    const startTime = Date.now();
    
    try {
      await makeRequest(port, scenario);
      totalLatency += Date.now() - startTime;
      requests++;
    } catch (error) {
      errors++;
    }
  }
  
  return { requests, totalLatency, errors };
}

function makeRequest(port, scenario) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/',
      method: scenario.method || 'GET',
      headers: scenario.headers || {}
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (scenario.body) {
      req.write(scenario.body);
    }
    
    req.end();
  });
}

if (require.main === module) {
  runBenchmark().catch(error => {
    console.error(`${colors.red}❌ Benchmark error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { runBenchmark };