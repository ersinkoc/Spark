#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testDirs = ['unit', 'integration', 'performance', 'security'];
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function runTests() {
  console.log(`${colors.blue}🧪 Running @oxog/spark test suite${colors.reset}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testDir of testDirs) {
    const testPath = path.join(__dirname, testDir);
    
    if (!fs.existsSync(testPath)) {
      console.log(`${colors.yellow}⚠️  ${testDir} tests directory not found${colors.reset}`);
      continue;
    }
    
    console.log(`${colors.blue}📁 Running ${testDir} tests...${colors.reset}`);
    
    try {
      const result = await runTestDirectory(testPath);
      totalTests += result.total;
      passedTests += result.passed;
      failedTests += result.failed;
      
      if (result.failed === 0) {
        console.log(`${colors.green}✅ ${testDir} tests passed (${result.passed}/${result.total})${colors.reset}\n`);
      } else {
        console.log(`${colors.red}❌ ${testDir} tests failed (${result.failed}/${result.total})${colors.reset}\n`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error running ${testDir} tests: ${error.message}${colors.reset}\n`);
      failedTests++;
    }
  }
  
  console.log(`${colors.blue}📊 Test Summary:${colors.reset}`);
  console.log(`Total: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);
  
  if (failedTests > 0) {
    console.log(`${colors.red}Some tests failed. Please review the output above.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}🎉 All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

async function runTestDirectory(testPath) {
  const testFiles = fs.readdirSync(testPath).filter(file => 
    file.endsWith('.test.js') || file.endsWith('.spec.js')
  );
  
  if (testFiles.length === 0) {
    return { total: 0, passed: 0, failed: 0 };
  }
  
  let total = 0;
  let passed = 0;
  let failed = 0;
  
  for (const testFile of testFiles) {
    const testFilePath = path.join(testPath, testFile);
    console.log(`  Running ${testFile}...`);
    
    try {
      const result = await runTestFile(testFilePath);
      total += result.total;
      passed += result.passed;
      failed += result.failed;
      
      if (result.failed === 0) {
        console.log(`    ${colors.green}✅ ${result.passed}/${result.total} tests passed${colors.reset}`);
      } else {
        console.log(`    ${colors.red}❌ ${result.failed}/${result.total} tests failed${colors.reset}`);
      }
    } catch (error) {
      console.log(`    ${colors.red}❌ Error: ${error.message}${colors.reset}`);
      failed++;
    }
  }
  
  return { total, passed, failed };
}

async function runTestFile(testFilePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [testFilePath], { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'Test failed'));
      } else {
        const result = parseTestOutput(stdout);
        resolve(result);
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function parseTestOutput(output) {
  const lines = output.split('\n');
  let passed = 0;
  let failed = 0;
  
  for (const line of lines) {
    if (line.includes('✅') || line.includes('PASS')) {
      passed++;
    } else if (line.includes('❌') || line.includes('FAIL')) {
      failed++;
    }
  }
  
  return { total: passed + failed, passed, failed };
}

if (require.main === module) {
  runTests().catch(error => {
    console.error(`${colors.red}❌ Test runner error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { runTests };