#!/usr/bin/env node

/**
 * Run all documentation example tests to ensure code samples work correctly
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  { name: 'Beginner Examples', file: 'test-beginner-examples.js' },
  { name: 'Intermediate Examples', file: 'test-intermediate-examples.js' },
  { name: 'Expert Examples', file: 'test-expert-examples.js' }
];

let testsPassed = 0;
let testsFailed = 0;

async function runTest(testName, testFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${testName}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve) => {
    const proc = spawn('node', [testFile], {
      stdio: 'inherit',
      cwd: __dirname
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${testName} - PASSED`);
        testsPassed++;
      } else {
        console.log(`\n❌ ${testName} - FAILED (exit code: ${code})`);
        testsFailed++;
      }
      resolve();
    });

    proc.on('error', (error) => {
      console.error(`\n❌ ${testName} - ERROR: ${error.message}`);
      testsFailed++;
      resolve();
    });
  });
}

async function runAllTests() {
  console.log('🧪 Documentation Examples Test Suite');
  console.log('=====================================\n');
  console.log('This test suite validates that all code examples in the documentation');
  console.log('are functional and work as expected.\n');

  const startTime = Date.now();

  for (const test of tests) {
    await runTest(test.name, test.file);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST RESULTS SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total tests run: ${tests.length}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Duration: ${duration}s`);
  console.log(`${'='.repeat(60)}\n`);

  if (testsFailed === 0) {
    console.log('✅ All documentation examples are working correctly!');
    process.exit(0);
  } else {
    console.log('❌ Some documentation examples failed. Please fix them before release.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});