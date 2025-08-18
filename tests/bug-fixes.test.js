#!/usr/bin/env node

'use strict';

const { Spark } = require('../src');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Bug Fixes...\n');

let testsPassed = 0;
let testsFailed = 0;

// Test 1: Verify 'use strict' is present in all source files
function testUseStrict() {
  console.log('Test 1: Checking for "use strict" directives...');
  
  const directories = [
    'src',
    'src/core',
    'src/middleware',
    'src/router',
    'src/utils'
  ];
  
  let allHaveUseStrict = true;
  
  directories.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) return;
    
    const files = fs.readdirSync(fullPath).filter(file => file.endsWith('.js'));
    
    files.forEach(file => {
      const filePath = path.join(fullPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (!content.startsWith("'use strict';") && !content.startsWith('"use strict";')) {
        console.error(`  ❌ Missing 'use strict' in ${path.relative(process.cwd(), filePath)}`);
        allHaveUseStrict = false;
      }
    });
  });
  
  if (allHaveUseStrict) {
    console.log('  ✅ All source files have "use strict" directive');
    testsPassed++;
  } else {
    testsFailed++;
  }
}

// Test 2: Verify no trailing whitespace in memory-leak-test.js
function testNoTrailingWhitespace() {
  console.log('\nTest 2: Checking for trailing whitespace...');
  
  const filePath = path.join(__dirname, 'memory-leak-test.js');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let hasTrailingWhitespace = false;
  lines.forEach((line, index) => {
    if (line !== line.trimRight()) {
      console.error(`  ❌ Trailing whitespace at line ${index + 1}`);
      hasTrailingWhitespace = true;
    }
  });
  
  if (!hasTrailingWhitespace) {
    console.log('  ✅ No trailing whitespace found');
    testsPassed++;
  } else {
    testsFailed++;
  }
}

// Test 3: Verify async handler improvement
function testAsyncHandler() {
  console.log('\nTest 3: Testing async handler error handling...');
  
  const { asyncHandler } = require('../src/utils/async-handler');
  
  // Create a mock context
  const mockCtx = {
    app: {
      emit: (event, error) => {
        if (event === 'error') {
          // Error was properly emitted
          return true;
        }
      }
    }
  };
  
  // Test async function that throws
  const failingAsync = async () => {
    throw new Error('Test error');
  };
  
  const wrapped = asyncHandler(failingAsync);
  
  try {
    const result = wrapped(mockCtx, () => {});
    
    // Check if it returns a promise
    if (result && typeof result.then === 'function') {
      result.catch(err => {
        if (err.message === 'Test error') {
          console.log('  ✅ Async handler properly handles errors');
          testsPassed++;
        } else {
          console.error('  ❌ Unexpected error:', err.message);
          testsFailed++;
        }
      });
    } else {
      console.error('  ❌ Async handler did not return a promise');
      testsFailed++;
    }
  } catch (err) {
    console.error('  ❌ Async handler threw synchronously:', err.message);
    testsFailed++;
  }
}

// Test 4: Verify regex validator fix
function testRegexValidator() {
  console.log('\nTest 4: Testing regex validator performance check...');
  
  const { RegexValidator } = require('../src/utils/regex-validator');
  
  // Test with a simple pattern
  const result = RegexValidator.testPerformance(/test/, 'test string');
  
  if (result && result.safe !== undefined && result.duration !== undefined) {
    console.log('  ✅ Regex validator returns proper performance metrics');
    testsPassed++;
  } else {
    console.error('  ❌ Regex validator does not return expected structure');
    testsFailed++;
  }
}

// Test 5: Verify Context pool methods exist
function testContextPool() {
  console.log('\nTest 5: Testing Context pool methods...');
  
  const Context = require('../src/core/context');
  const mockReq = { headers: {}, url: '/', method: 'GET', connection: {} };
  const mockRes = { setHeader: () => {}, end: () => {} };
  const mockApp = {};
  
  const ctx = new Context(mockReq, mockRes, mockApp);
  
  if (typeof ctx.init === 'function' && typeof ctx.reset === 'function') {
    console.log('  ✅ Context has init() and reset() methods for pooling');
    testsPassed++;
  } else {
    console.error('  ❌ Context missing pooling methods');
    testsFailed++;
  }
}

// Run all tests
function runTests() {
  testUseStrict();
  testNoTrailingWhitespace();
  testAsyncHandler();
  testRegexValidator();
  testContextPool();
  
  // Wait a bit for async tests to complete
  setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log('='.repeat(50));
    
    if (testsFailed === 0) {
      console.log('\n🎉 All bug fixes verified successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the fixes.');
      process.exit(1);
    }
  }, 1000);
}

runTests();