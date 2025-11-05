'use strict';

/**
 * Additional bugs found in comprehensive review
 */

const assert = require('assert');
const { createMiddleware } = require('../src/core/middleware');
const session = require('../src/middleware/session');
const Context = require('../src/core/context');

console.log('\n🐛 Additional Bug Tests\n');

// =============================================================================
// Bug #4: skipIf middleware blocks requests when condition is false
// =============================================================================
console.log('Testing Bug #4: skipIf blocks requests...');

async function testSkipIfMiddleware() {
  const middleware = createMiddleware(null);
  const skipIfMiddleware = middleware.skipIf((ctx) => false);

  // Create mock context
  const mockReq = {
    headers: {},
    url: '/test',
    method: 'GET',
    connection: {}
  };
  const mockRes = {
    setHeader: () => {},
    end: () => {}
  };
  const ctx = new Context(mockReq, mockRes, {});

  let nextCalled = false;
  const next = async () => {
    nextCalled = true;
  };

  try {
    await skipIfMiddleware(ctx, next);

    // Bug: when condition is false, next() is never called, blocking the request
    if (nextCalled) {
      console.log('  ✅ Bug #4: FIXED - skipIf calls next() when condition is false');
      return true;
    } else {
      console.log('  ❌ Bug #4: FAILED - skipIf blocks request when condition is false');
      return false;
    }
  } catch (err) {
    console.log(`  ❌ Bug #4: ERROR - ${err.message}`);
    return false;
  }
}

// =============================================================================
// Bug #5: session.regenerate() fails because genid is not passed to proxy options
// =============================================================================
console.log('\nTesting Bug #5: session.regenerate() missing genid...');

async function testSessionRegenerate() {
  const MemoryStore = session.MemoryStore;
  const store = new MemoryStore();

  // Create session middleware
  const sessionMiddleware = session({
    secret: 'test-secret',
    store: store
  });

  // Create mock context
  const mockReq = {
    headers: {},
    url: '/test',
    method: 'GET',
    connection: {}
  };
  const mockRes = {
    setHeader: () => {},
    end: () => {}
  };
  const ctx = new Context(mockReq, mockRes, {});

  // Add required methods that session middleware expects
  ctx.cookies = {};
  ctx.setCookie = () => {};
  ctx.clearCookie = () => {};

  // Call middleware to initialize session
  await sessionMiddleware(ctx, async () => {
    // Session is now initialized
  });

  try {
    // Try to regenerate session - this should fail with bug
    await ctx.session.regenerate();

    // If we get here without error, the bug is fixed
    console.log('  ✅ Bug #5: FIXED - session.regenerate() works correctly');
    return true;
  } catch (err) {
    // Bug: options.genid is not a function
    if (err.message.includes('genid') || err.message.includes('not a function')) {
      console.log(`  ❌ Bug #5: FAILED - ${err.message}`);
      return false;
    } else {
      // Some other error
      console.log(`  ❌ Bug #5: ERROR - ${err.message}`);
      return false;
    }
  }
}

// Run all tests
(async () => {
  const results = [];

  try {
    results.push(await testSkipIfMiddleware());
  } catch (err) {
    console.log(`  ❌ Bug #4: ERROR - ${err.message}`);
    results.push(false);
  }

  try {
    results.push(await testSessionRegenerate());
  } catch (err) {
    console.log(`  ❌ Bug #5: ERROR - ${err.message}`);
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
