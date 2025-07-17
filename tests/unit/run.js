#!/usr/bin/env node

/**
 * Unit test runner for @oxog/spark
 * Runs all unit tests and reports results
 */

const fs = require('fs');
const path = require('path');

class UnitTestRunner {
  constructor() {
    this.testFiles = [];
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    this.startTime = Date.now();
  }

  async run() {
    console.log('🧪 Running unit tests for @oxog/spark\n');

    // Discover test files
    this.discoverTests();

    if (this.testFiles.length === 0) {
      console.log('No unit test files found');
      return;
    }

    console.log(`Found ${this.testFiles.length} test files\n`);

    // Run each test file
    for (const testFile of this.testFiles) {
      await this.runTestFile(testFile);
    }

    // Print summary
    this.printSummary();

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }

  discoverTests() {
    const testDir = __dirname;
    
    const scanDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          scanDir(fullPath);
        } else if (file.endsWith('.test.js') || file.endsWith('-test.js')) {
          this.testFiles.push(fullPath);
        }
      });
    };

    scanDir(testDir);
  }

  async runTestFile(testFile) {
    const relativePath = path.relative(process.cwd(), testFile);
    console.log(`\n📄 ${relativePath}`);
    console.log('-'.repeat(50));

    try {
      // Clear require cache to ensure fresh test run
      delete require.cache[require.resolve(testFile)];
      
      // Set up test context
      global.describe = this.createDescribe.bind(this);
      global.it = this.createIt.bind(this);
      global.test = global.it;
      global.beforeEach = this.createBeforeEach.bind(this);
      global.afterEach = this.createAfterEach.bind(this);
      global.assert = this.createAssert();

      // Track current suite
      this.currentSuite = {
        name: relativePath,
        tests: [],
        beforeEach: null,
        afterEach: null
      };

      // Run the test file
      require(testFile);

      // Execute tests in current suite
      await this.executeSuite(this.currentSuite);

    } catch (error) {
      console.error(`❌ Failed to load test file: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        file: relativePath,
        error: error.message
      });
    }
  }

  createDescribe() {
    return (name, fn) => {
      const previousSuite = this.currentSuite;
      this.currentSuite = {
        name,
        tests: [],
        beforeEach: null,
        afterEach: null,
        parent: previousSuite
      };

      fn();

      if (previousSuite) {
        previousSuite.tests.push(this.currentSuite);
        this.currentSuite = previousSuite;
      }
    };
  }

  createIt() {
    return (name, fn) => {
      this.currentSuite.tests.push({
        name,
        fn,
        type: 'test'
      });
    };
  }

  createBeforeEach() {
    return (fn) => {
      this.currentSuite.beforeEach = fn;
    };
  }

  createAfterEach() {
    return (fn) => {
      this.currentSuite.afterEach = fn;
    };
  }

  createAssert() {
    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message || 'Assertion failed');
      }
    };

    assert.equal = (actual, expected, message) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${expected} but got ${actual}`);
      }
    };

    assert.deepEqual = (actual, expected, message) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message || `Objects are not equal`);
      }
    };

    assert.throws = (fn, message) => {
      let thrown = false;
      try {
        fn();
      } catch (e) {
        thrown = true;
      }
      if (!thrown) {
        throw new Error(message || 'Expected function to throw');
      }
    };

    assert.ok = (value, message) => {
      if (!value) {
        throw new Error(message || `Expected truthy value but got ${value}`);
      }
    };

    return assert;
  }

  async executeSuite(suite, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (depth > 0) {
      console.log(`${indent}${suite.name}`);
    }

    for (const item of suite.tests) {
      if (item.type === 'test') {
        await this.executeTest(item, suite, depth + 1);
      } else {
        // Nested suite
        await this.executeSuite(item, depth + 1);
      }
    }
  }

  async executeTest(test, suite, depth) {
    const indent = '  '.repeat(depth);
    this.results.total++;

    try {
      // Run beforeEach if exists
      if (suite.beforeEach) {
        await suite.beforeEach();
      }

      // Run the test
      const result = test.fn();
      if (result && typeof result.then === 'function') {
        await result;
      }

      // Run afterEach if exists
      if (suite.afterEach) {
        await suite.afterEach();
      }

      console.log(`${indent}✅ ${test.name}`);
      this.results.passed++;

    } catch (error) {
      console.log(`${indent}❌ ${test.name}`);
      console.log(`${indent}   ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        suite: suite.name,
        test: test.name,
        error: error.message
      });
    }
  }

  printSummary() {
    const duration = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nTotal Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️  Skipped: ${this.results.skipped}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    if (this.results.failed > 0) {
      console.log('\nFailed Tests:');
      this.results.errors.forEach(error => {
        if (error.test) {
          console.log(`  - ${error.suite} > ${error.test}: ${error.error}`);
        } else {
          console.log(`  - ${error.file}: ${error.error}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new UnitTestRunner();
  runner.run().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = UnitTestRunner;