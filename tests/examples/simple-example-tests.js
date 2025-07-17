#!/usr/bin/env node

/**
 * Simple Example Tests - Just verify examples can be loaded and have no syntax errors
 */

const path = require('path');
const fs = require('fs');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class SimpleExampleTests {
  constructor() {
    this.testResults = [];
    this.examples = [
      { name: 'Basic API', path: 'basic-api/server.js' },
      { name: 'E-commerce API', path: 'ecommerce-api/index.js' },
      { name: 'File Upload', path: 'file-upload/server.js' },
      { name: 'REST CRUD', path: 'rest-crud/server.js' }
    ];
  }

  async test(name, testFn) {
    try {
      await testFn();
      this.testResults.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`  ❌ ${name}: ${error.message}`);
    }
  }

  async runTests() {
    console.log(`${COLORS.bold}${COLORS.blue}🧪 Simple Example Tests${COLORS.reset}\n`);

    for (const example of this.examples) {
      console.log(`${COLORS.cyan}📋 Testing ${example.name}...${COLORS.reset}`);
      
      await this.test('File exists', async () => {
        const filePath = path.join(__dirname, '..', '..', 'examples', example.path);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${example.path}`);
        }
      });

      await this.test('No syntax errors', async () => {
        const filePath = path.join(__dirname, '..', '..', 'examples', example.path);
        try {
          // Clear require cache
          delete require.cache[require.resolve(filePath)];
          
          // Try to require the file
          const originalListen = require('../../src/core/application').prototype.listen;
          
          // Mock listen to prevent server start
          require('../../src/core/application').prototype.listen = function() {
            return { close: () => {} };
          };
          
          require(filePath);
          
          // Restore original listen
          require('../../src/core/application').prototype.listen = originalListen;
          
        } catch (error) {
          // Ignore "listen" related errors as we're just checking syntax
          if (!error.message.includes('listen') && 
              !error.message.includes('EADDRINUSE') && 
              !error.message.includes('port')) {
            throw error;
          }
        }
      });

      await this.test('Contains required imports', async () => {
        const filePath = path.join(__dirname, '..', '..', 'examples', example.path);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (!content.includes('require') && !content.includes('import')) {
          throw new Error('No imports found');
        }
        
        if (!content.includes('Spark')) {
          throw new Error('Spark import not found');
        }
      });

      await this.test('Has basic structure', async () => {
        const filePath = path.join(__dirname, '..', '..', 'examples', example.path);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (!content.includes('new Spark')) {
          throw new Error('Spark instance creation not found');
        }
        
        if (!content.includes('listen')) {
          throw new Error('Server listen call not found');
        }
      });

      console.log('');
    }
  }

  generateReport() {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;
    const successRate = total > 0 ? (passed / total * 100) : 0;

    console.log(`${COLORS.bold}📊 Simple Example Test Results${COLORS.reset}`);
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${COLORS.green}${passed}${COLORS.reset}`);
    console.log(`❌ Failed: ${COLORS.red}${failed}${COLORS.reset}`);
    console.log(`📊 Total: ${total}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (failed === 0) {
      console.log(`\n${COLORS.bold}${COLORS.green}🎉 ALL EXAMPLE TESTS PASSED - 100% SUCCESS RATE!${COLORS.reset}`);
      console.log(`${COLORS.green}All ${this.examples.length} examples are syntactically correct and properly structured!${COLORS.reset}`);
    } else {
      console.log(`\n${COLORS.bold}${COLORS.red}❌ SOME TESTS FAILED${COLORS.reset}`);
      
      // Show failed tests
      const failedTests = this.testResults.filter(r => r.status === 'FAIL');
      console.log(`\n${COLORS.red}Failed tests:${COLORS.reset}`);
      failedTests.forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
    }
    
    console.log('='.repeat(50));
    
    return { passed, failed, total, success: failed === 0 };
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new SimpleExampleTests();
  
  (async () => {
    try {
      await test.runTests();
      const results = test.generateReport();
      process.exit(results.success ? 0 : 1);
    } catch (error) {
      console.error(`${COLORS.red}❌ Test failed: ${error.message}${COLORS.reset}`);
      process.exit(1);
    }
  })();
}

module.exports = SimpleExampleTests;