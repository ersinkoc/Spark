#!/usr/bin/env node

/**
 * Master test runner for all example tests
 * Runs all example tests and ensures 100% success rate
 */

const BasicAPITest = require('./basic-api.test');
const EcommerceAPITest = require('./ecommerce-api.test');
const FileUploadTest = require('./file-upload.test');
const RestCrudTest = require('./rest-crud.test');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class ExampleTestRunner {
  constructor() {
    this.allResults = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
  }

  async runAllTests() {
    console.log(`${COLORS.bold}${COLORS.blue}🧪 Running All Example Tests${COLORS.reset}\n`);
    
    const testSuites = [
      { name: 'Basic API', test: BasicAPITest },
      { name: 'E-commerce API', test: EcommerceAPITest },
      { name: 'File Upload', test: FileUploadTest },
      { name: 'REST CRUD', test: RestCrudTest }
    ];

    for (const { name, test: TestClass } of testSuites) {
      console.log(`${COLORS.cyan}📋 Running ${name} Tests...${COLORS.reset}`);
      
      const testInstance = new TestClass();
      let results;
      
      try {
        await testInstance.setup();
        await testInstance.runTests();
        results = testInstance.generateReport();
        await testInstance.cleanup();
        
        // Track results
        this.allResults.push({
          name,
          ...results
        });
        
        this.totalTests += results.total;
        this.totalPassed += results.passed;
        this.totalFailed += results.failed;
        
        if (results.success) {
          console.log(`${COLORS.green}✅ ${name} Tests: ALL PASSED${COLORS.reset}\n`);
        } else {
          console.log(`${COLORS.red}❌ ${name} Tests: ${results.failed} FAILED${COLORS.reset}\n`);
        }
        
      } catch (error) {
        console.error(`${COLORS.red}❌ ${name} Test Suite Failed: ${error.message}${COLORS.reset}\n`);
        this.allResults.push({
          name,
          passed: 0,
          failed: 1,
          total: 1,
          success: false,
          error: error.message
        });
        this.totalTests += 1;
        this.totalFailed += 1;
        
        // Cleanup on error
        try {
          await testInstance.cleanup();
        } catch (cleanupError) {
          console.error(`Cleanup error for ${name}:`, cleanupError.message);
        }
      }
    }
    
    this.generateFinalReport();
    return this.totalFailed === 0;
  }

  generateFinalReport() {
    console.log(`${COLORS.bold}${COLORS.blue}📊 FINAL EXAMPLE TEST RESULTS${COLORS.reset}`);
    console.log('='.repeat(60));
    
    // Individual suite results
    this.allResults.forEach(result => {
      const status = result.success ? 
        `${COLORS.green}✅ PASSED` : 
        `${COLORS.red}❌ FAILED`;
      
      console.log(`${result.name.padEnd(20)} ${status}${COLORS.reset} (${result.passed}/${result.total})`);
    });
    
    console.log('='.repeat(60));
    
    // Overall statistics
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests * 100) : 0;
    
    console.log(`${COLORS.bold}Overall Results:${COLORS.reset}`);
    console.log(`✅ Total Passed: ${COLORS.green}${this.totalPassed}${COLORS.reset}`);
    console.log(`❌ Total Failed: ${COLORS.red}${this.totalFailed}${COLORS.reset}`);
    console.log(`📊 Total Tests: ${this.totalTests}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    console.log('\n' + '='.repeat(60));
    
    // Final status
    if (this.totalFailed === 0) {
      console.log(`${COLORS.bold}${COLORS.green}🎉 ALL EXAMPLE TESTS PASSED - 100% SUCCESS RATE!${COLORS.reset}`);
      console.log(`${COLORS.green}All ${this.allResults.length} example applications are working perfectly!${COLORS.reset}`);
    } else {
      console.log(`${COLORS.bold}${COLORS.red}❌ SOME TESTS FAILED${COLORS.reset}`);
      console.log(`${COLORS.red}${this.totalFailed} out of ${this.totalTests} tests failed${COLORS.reset}`);
      
      // Show failed suites
      const failedSuites = this.allResults.filter(r => !r.success);
      if (failedSuites.length > 0) {
        console.log(`\n${COLORS.red}Failed test suites:${COLORS.reset}`);
        failedSuites.forEach(suite => {
          console.log(`  • ${suite.name}: ${suite.error || 'Unknown error'}`);
        });
      }
    }
    
    console.log('='.repeat(60));
  }
}

// Run all tests if called directly
if (require.main === module) {
  const runner = new ExampleTestRunner();
  
  (async () => {
    try {
      const success = await runner.runAllTests();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error(`${COLORS.red}❌ Test runner failed: ${error.message}${COLORS.reset}`);
      process.exit(1);
    }
  })();
}

module.exports = ExampleTestRunner;