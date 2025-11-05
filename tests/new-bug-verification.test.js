'use strict';

/**
 * Test suite to verify newly discovered bugs
 * These tests should FAIL with the current buggy code and PASS after fixes
 */

const assert = require('assert');
const Layer = require('../src/router/layer');
const cache = require('../src/middleware/cache');
const Context = require('../src/core/context');
const http = require('http');

console.log('\n🐛 New Bug Verification Test Suite\n');

// =============================================================================
// Bug #1: Missing return statement in layer.js handle() method
// =============================================================================
console.log('Testing Bug #1: Missing return in layer.js handle()...');

async function testLayerHandleReturn() {
  // Create a mock handler that returns a value
  const handler = async (ctx, next) => {
    return 'test-value';
  };

  // Create a layer with this handler (length = 2, so goes to else branch)
  const layer = new Layer('/test', {}, handler);

  // Mock context
  const mockReq = { headers: {}, url: '/test', method: 'GET', connection: {} };
  const mockRes = { setHeader: () => {}, end: () => {} };
  const mockApp = {};
  const ctx = new Context(mockReq, mockRes, mockApp);

  // Call handle and check if it returns the value
  const result = await layer.handle(ctx, () => {});

  // This should return 'test-value' but with the bug it returns undefined
  if (result === 'test-value') {
    console.log('  ✅ Bug #1: FIXED - handle() returns the handler result');
    return true;
  } else {
    console.log(`  ❌ Bug #1: FAILED - handle() returned ${result} instead of 'test-value'`);
    return false;
  }
}

// =============================================================================
// Bug #2: Cache middleware stores request headers instead of response headers
// =============================================================================
console.log('\nTesting Bug #2: Cache stores wrong headers...');

async function testCacheHeaders() {
  // Create cache middleware
  const cacheMiddleware = cache({ maxAge: 60 });

  // Create mock context for first request
  const mockReq = {
    headers: {
      'host': 'example.com',
      'user-agent': 'test-agent',
      'accept': 'application/json'
    },
    url: '/test',
    method: 'GET',
    connection: {}
  };
  const mockRes = {
    setHeader: () => {},
    end: () => {},
    statusCode: 200
  };
  const mockApp = {};
  const ctx = new Context(mockReq, mockRes, mockApp);

  // Call middleware with handler that sets response
  await cacheMiddleware(ctx, async () => {
    // Set response headers in the handler (simulating normal route handler)
    ctx.set('Content-Type', 'application/json');
    ctx.statusCode = 200;
    ctx.body = { test: 'data' };
  });

  // Now make a second request to get cached response
  const mockReq2 = {
    headers: {},
    url: '/test',
    method: 'GET',
    connection: {}
  };
  const mockRes2 = {
    setHeader: () => {},
    end: () => {},
    statusCode: 200
  };
  const ctx2 = new Context(mockReq2, mockRes2, mockApp);

  await cacheMiddleware(ctx2, async () => {
    // This should not be called because response should come from cache
    throw new Error('This handler should not be called when serving from cache!');
  });

  // Check if response headers were properly cached
  const cachedContentType = ctx2.getHeader('content-type');
  const cachedBody = ctx2.body;

  // With the bug, request headers would be cached instead of response headers
  if (cachedContentType === 'application/json' && cachedBody && cachedBody.test === 'data') {
    console.log('  ✅ Bug #2: FIXED - Cache stores response headers correctly');
    return true;
  } else {
    console.log('  ❌ Bug #2: FAILED - Cache did not restore correct response headers');
    console.log(`     Expected Content-Type: application/json, got: ${cachedContentType}`);
    console.log(`     Expected body: {test:'data'}, got: ${JSON.stringify(cachedBody)}`);
    return false;
  }
}

// Run all tests
(async () => {
  const results = [];

  try {
    results.push(await testLayerHandleReturn());
  } catch (err) {
    console.log(`  ❌ Bug #1: ERROR - ${err.message}`);
    results.push(false);
  }

  try {
    results.push(await testCacheHeaders());
  } catch (err) {
    console.log(`  ❌ Bug #2: ERROR - ${err.message}`);
    results.push(false);
  }

  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  console.log(`✅ Tests Passed: ${passed}`);
  console.log(`❌ Tests Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some bugs are not yet fixed!\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All bugs have been fixed!\n');
    process.exit(0);
  }
})();
