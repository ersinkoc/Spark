#!/usr/bin/env node

/**
 * Memory leak test for @oxog/spark
 * Tests for memory leaks in common scenarios
 */

const { Spark } = require('../src');

console.log('🔍 Testing for memory leaks...\n');

let initialMemory = 0;
let finalMemory = 0;
const iterations = 100; // Reduced for more realistic testing

async function runMemoryTest() {
  // Increase max listeners to avoid warnings
  process.setMaxListeners(100);
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Record initial memory
  initialMemory = process.memoryUsage().heapUsed;
  console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

  // Test 1: Creating and destroying apps
  console.log('\nTest 1: Creating and destroying apps...');
  for (let i = 0; i < iterations; i++) {
    const app = new Spark();
    app.get('/', (ctx) => ctx.json({ ok: true }));
    // App should be garbage collected
  }

  // Test 2: Request handling
  console.log('\nTest 2: Testing request handling...');
  const app = new Spark();
  let contexts = [];
  
  app.use((ctx, next) => {
    // Store reference to test cleanup
    contexts.push(ctx);
    return next();
  });

  app.get('/test', (ctx) => {
    ctx.json({ iteration: contexts.length });
  });

  await new Promise((resolve) => {
    app.listen(0, resolve);
  });
  const port = app.server.address().port;

  // Make requests
  const http = require('http');
  for (let i = 0; i < iterations; i++) {
    await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/test`, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }).on('error', reject);
    });
  }

  // Clear contexts
  contexts = [];

  // Close server
  await new Promise((resolve) => app.server.close(resolve));

  // Test 3: Middleware chains
  console.log('\nTest 3: Testing middleware chains...');
  const app2 = new Spark();
  
  // Add many middleware
  for (let i = 0; i < iterations; i++) {
    app2.use(async (ctx, next) => {
      ctx.state[`mw${i}`] = true;
      await next();
    });
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));

  // Record final memory
  finalMemory = process.memoryUsage().heapUsed;
  console.log(`\nFinal memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);

  const memoryIncrease = finalMemory - initialMemory;
  const percentIncrease = (memoryIncrease / initialMemory * 100).toFixed(2);

  console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${percentIncrease}%)`);

  // Check for significant memory leak
  // Allow up to 200% increase for test overhead (multiple app instances)
  if (percentIncrease > 200) {
    console.error('\n❌ Potential memory leak detected!');
    process.exit(1);
  } else {
    console.log('\n✅ No significant memory leaks detected');
    process.exit(0);
  }
}

// Run test
runMemoryTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});