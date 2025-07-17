#!/usr/bin/env node

/**
 * Example applications tester for @oxog/spark
 * Tests all example applications to ensure they work correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ExamplesTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async test() {
    console.log('🧪 Testing example applications for @oxog/spark\n');

    const examplesDir = path.join(__dirname, '..', 'examples');
    
    if (!fs.existsSync(examplesDir)) {
      console.error('❌ Examples directory not found');
      process.exit(1);
    }

    const examples = fs.readdirSync(examplesDir).filter(d =>
      fs.statSync(path.join(examplesDir, d)).isDirectory()
    );

    console.log(`Found ${examples.length} examples to test\n`);

    for (const example of examples) {
      await this.testExample(example);
    }

    this.printReport();
    
    const failed = this.results.filter(r => !r.success).length;
    if (failed > 0) {
      process.exit(1);
    }
  }

  async testExample(exampleName) {
    console.log(`\n📁 Testing: ${exampleName}`);
    console.log('-'.repeat(40));

    const examplePath = path.join(__dirname, '..', 'examples', exampleName);
    const result = {
      name: exampleName,
      success: true,
      errors: [],
      warnings: []
    };

    try {
      // Check for required files
      const requiredFiles = ['package.json', 'README.md'];
      for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(examplePath, file))) {
          result.warnings.push(`Missing ${file}`);
        }
      }

      // Check for main file
      const pkg = this.getPackageJson(examplePath);
      const mainFile = pkg.main || 'index.js';
      
      if (!fs.existsSync(path.join(examplePath, mainFile))) {
        result.errors.push(`Main file ${mainFile} not found`);
        result.success = false;
        this.results.push(result);
        return;
      }

      // Install dependencies
      console.log('  Installing dependencies...');
      execSync('npm install', {
        cwd: examplePath,
        stdio: 'pipe'
      });

      // Run tests if available
      if (pkg.scripts && pkg.scripts.test) {
        console.log('  Running tests...');
        try {
          execSync('npm test', {
            cwd: examplePath,
            stdio: 'pipe'
          });
          console.log('  ✅ Tests passed');
        } catch (error) {
          result.errors.push('Tests failed');
          result.success = false;
        }
      }

      // Start the example and test basic functionality
      console.log('  Starting application...');
      const appTest = await this.testApplication(examplePath, mainFile);
      
      if (!appTest.success) {
        result.errors.push(...appTest.errors);
        result.success = false;
      } else {
        console.log('  ✅ Application starts successfully');
      }

      // Check code quality
      const codeIssues = this.checkCodeQuality(examplePath);
      if (codeIssues.length > 0) {
        result.warnings.push(...codeIssues);
      }

    } catch (error) {
      result.errors.push(error.message);
      result.success = false;
    }

    this.results.push(result);
    
    if (result.success) {
      console.log(`✅ ${exampleName} passed all tests`);
    } else {
      console.log(`❌ ${exampleName} failed`);
    }
  }

  getPackageJson(examplePath) {
    const pkgPath = path.join(examplePath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  }

  async testApplication(examplePath, mainFile) {
    return new Promise((resolve) => {
      const result = {
        success: true,
        errors: []
      };

      // Start the application
      const child = spawn('node', [mainFile], {
        cwd: examplePath,
        env: { ...process.env, PORT: 0 } // Use random port
      });

      let stdout = '';
      let stderr = '';
      let started = false;
      let port = null;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Check if server started
        if (!started) {
          const portMatch = stdout.match(/listening on port (\d+)/i) ||
                           stdout.match(/server started on (\d+)/i) ||
                           stdout.match(/:(\d+)/);
          
          if (portMatch) {
            port = portMatch[1];
            started = true;
            
            // Test the server
            this.testServerEndpoint(port)
              .then(() => {
                child.kill();
                resolve(result);
              })
              .catch(error => {
                result.success = false;
                result.errors.push(`Server test failed: ${error.message}`);
                child.kill();
                resolve(result);
              });
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        result.success = false;
        result.errors.push(`Failed to start: ${error.message}`);
        resolve(result);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!started) {
          child.kill();
          result.success = false;
          result.errors.push('Application failed to start within 5 seconds');
          
          if (stderr) {
            result.errors.push(`Stderr: ${stderr.substring(0, 200)}`);
          }
          
          resolve(result);
        }
      }, 5000);
    });
  }

  async testServerEndpoint(port) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      
      const req = http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          reject(new Error(`Server returned status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.setTimeout(2000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  checkCodeQuality(examplePath) {
    const issues = [];
    const jsFiles = this.getAllJsFiles(examplePath);

    jsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(examplePath, file);

      // Check for console.log statements
      const consoleLogs = (content.match(/console\.log/g) || []).length;
      if (consoleLogs > 5) {
        issues.push(`${relativePath}: Too many console.log statements (${consoleLogs})`);
      }

      // Check for error handling
      if (!content.includes('try') && !content.includes('.catch')) {
        issues.push(`${relativePath}: No error handling found`);
      }

      // Check for TODO comments
      if (content.includes('TODO') || content.includes('FIXME')) {
        issues.push(`${relativePath}: Contains TODO/FIXME comments`);
      }

      // Check imports
      if (content.includes("require('../src")|| content.includes("require('../../src")) {
        // Make sure it's using the package name instead
        if (!content.includes("require('@oxog/spark')")) {
          issues.push(`${relativePath}: Should use '@oxog/spark' instead of relative imports`);
        }
      }
    });

    return issues;
  }

  getAllJsFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.getAllJsFiles(fullPath));
      } else if (stat.isFile() && item.endsWith('.js')) {
        files.push(fullPath);
      }
    });

    return files;
  }

  printReport() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const warnings = this.results.reduce((sum, r) => sum + r.warnings.length, 0);

    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLES TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nTotal Examples: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

    if (failed > 0) {
      console.log('\n❌ Failed Examples:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`\n  ${result.name}:`);
        result.errors.forEach(error => {
          console.log(`    - ${error}`);
        });
      });
    }

    if (warnings > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.filter(r => r.warnings.length > 0).forEach(result => {
        console.log(`\n  ${result.name}:`);
        result.warnings.forEach(warning => {
          console.log(`    - ${warning}`);
        });
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests
if (require.main === module) {
  const tester = new ExamplesTester();
  tester.test().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ExamplesTester;