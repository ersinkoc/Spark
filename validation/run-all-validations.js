#!/usr/bin/env node

/**
 * Master validation runner for @oxog/spark
 * Orchestrates all validation phases
 */

const path = require('path');
const { execSync } = require('child_process');
const CoreFunctionalityValidator = require('./core-functionality');
const FeatureValidator = require('./features/checklist');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class MasterValidator {
  constructor() {
    this.phases = [];
    this.results = {};
    this.startTime = Date.now();
  }

  async runAllValidations() {
    console.log(`${COLORS.bright}${COLORS.blue}🚀 @oxog/spark Production Validation Pipeline${COLORS.reset}`);
    console.log(`${COLORS.bright}${'='.repeat(60)}${COLORS.reset}\n`);

    // Define all validation phases
    this.phases = [
      {
        name: 'Phase 1: Core Functionality',
        validator: new CoreFunctionalityValidator(),
        critical: true
      },
      {
        name: 'Phase 2: Feature Matrix',
        validator: new FeatureValidator(),
        critical: true
      },
      {
        name: 'Phase 3: Test Coverage',
        runner: () => this.runTestCoverage(),
        critical: true
      },
      {
        name: 'Phase 4: Documentation',
        runner: () => this.validateDocumentation(),
        critical: true
      },
      {
        name: 'Phase 5: Performance Benchmarks',
        runner: () => this.runBenchmarks(),
        critical: true
      },
      {
        name: 'Phase 6: Security Audit',
        runner: () => this.runSecurityAudit(),
        critical: true
      },
      {
        name: 'Phase 7: Package Validation',
        runner: () => this.validatePackage(),
        critical: true
      },
      {
        name: 'Phase 8: Example Applications',
        runner: () => this.validateExamples(),
        critical: false
      },
      {
        name: 'Phase 9: Release Preparation',
        runner: () => this.prepareRelease(),
        critical: true
      },
      {
        name: 'Phase 10: Final Checks',
        runner: () => this.finalChecks(),
        critical: true
      }
    ];

    // Run each phase
    for (const phase of this.phases) {
      console.log(`\n${COLORS.bright}${COLORS.cyan}${phase.name}${COLORS.reset}`);
      console.log(`${'-'.repeat(phase.name.length)}`);

      try {
        let result;
        
        if (phase.validator) {
          result = await phase.validator.validateAll();
        } else if (phase.runner) {
          result = await phase.runner();
        }

        this.results[phase.name] = {
          success: result,
          critical: phase.critical
        };

        if (result) {
          console.log(`${COLORS.green}✅ ${phase.name} completed successfully${COLORS.reset}`);
        } else {
          console.log(`${COLORS.red}❌ ${phase.name} failed${COLORS.reset}`);
          if (phase.critical) {
            console.log(`${COLORS.red}This is a critical failure. Stopping validation.${COLORS.reset}`);
            break;
          }
        }
      } catch (error) {
        console.log(`${COLORS.red}❌ ${phase.name} failed with error: ${error.message}${COLORS.reset}`);
        this.results[phase.name] = {
          success: false,
          critical: phase.critical,
          error: error.message
        };
        
        if (phase.critical) {
          break;
        }
      }
    }

    this.printFinalReport();
  }

  async runTestCoverage() {
    console.log('Analyzing test coverage...');
    
    try {
      // Run tests with coverage
      execSync('npm run test:coverage', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      // Check coverage report
      const coverageFile = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
      if (require('fs').existsSync(coverageFile)) {
        const coverage = require(coverageFile);
        const total = coverage.total;
        
        const metrics = ['statements', 'branches', 'functions', 'lines'];
        let allHundred = true;
        
        console.log('\nCoverage Summary:');
        for (const metric of metrics) {
          const pct = total[metric].pct;
          const status = pct === 100 ? '✅' : '❌';
          console.log(`  ${status} ${metric}: ${pct}%`);
          if (pct < 100) allHundred = false;
        }
        
        return allHundred;
      }
      
      return false;
    } catch (error) {
      console.error('Coverage analysis failed:', error.message);
      return false;
    }
  }

  async validateDocumentation() {
    console.log('Validating documentation...');
    
    const docs = [
      'README.md',
      'docs/getting-started.md',
      'docs/api-reference.md',
      'docs/middleware-guide.md',
      'docs/security-best-practices.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'LICENSE'
    ];
    
    const fs = require('fs');
    let allValid = true;
    
    for (const doc of docs) {
      const docPath = path.join(__dirname, '..', doc);
      if (!fs.existsSync(docPath)) {
        console.log(`  ❌ Missing: ${doc}`);
        allValid = false;
      } else {
        const content = fs.readFileSync(docPath, 'utf8');
        if (content.trim().length < 100) {
          console.log(`  ⚠️  Insufficient content: ${doc}`);
          allValid = false;
        } else {
          console.log(`  ✅ ${doc}`);
        }
      }
    }
    
    return allValid;
  }

  async runBenchmarks() {
    console.log('Running performance benchmarks...');
    
    try {
      const output = execSync('npm run benchmark', {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });
      
      console.log(output);
      
      // Check if Spark is faster than Express
      if (output.includes('Spark') && output.includes('Express')) {
        const sparkMatch = output.match(/Spark.*?([\d,]+)\s*ops\/sec/);
        const expressMatch = output.match(/Express.*?([\d,]+)\s*ops\/sec/);
        
        if (sparkMatch && expressMatch) {
          const sparkOps = parseInt(sparkMatch[1].replace(/,/g, ''));
          const expressOps = parseInt(expressMatch[1].replace(/,/g, ''));
          
          if (sparkOps > expressOps) {
            const improvement = ((sparkOps - expressOps) / expressOps * 100).toFixed(1);
            console.log(`\n✅ Spark is ${improvement}% faster than Express`);
            return true;
          }
        }
      }
      
      console.log('\n❌ Performance benchmarks did not meet requirements');
      return false;
    } catch (error) {
      console.error('Benchmark failed:', error.message);
      return false;
    }
  }

  async runSecurityAudit() {
    console.log('Running security audit...');
    
    try {
      // Check for vulnerabilities
      try {
        execSync('npm audit --production', {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        });
        console.log('  ✅ No vulnerabilities found');
      } catch (auditError) {
        console.log('  ❌ Security vulnerabilities detected');
        return false;
      }
      
      // Check for dangerous patterns
      const fs = require('fs');
      const srcPath = path.join(__dirname, '..', 'src');
      const files = this.getAllFiles(srcPath, '.js');
      
      let issuesFound = 0;
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.match(/\beval\s*\(/)) {
          console.log(`  ⚠️  eval() usage in ${path.basename(file)}`);
          issuesFound++;
        }
        
        if (content.match(/new\s+Function\s*\(/)) {
          console.log(`  ⚠️  Function constructor in ${path.basename(file)}`);
          issuesFound++;
        }
      }
      
      return issuesFound === 0;
    } catch (error) {
      console.error('Security audit failed:', error.message);
      return false;
    }
  }

  async validatePackage() {
    console.log('Validating package configuration...');
    
    try {
      const pkg = require('../package.json');
      let valid = true;
      
      // Check required fields
      const requiredFields = [
        'name', 'version', 'description', 'main', 'types',
        'engines', 'repository', 'keywords', 'author', 'license'
      ];
      
      for (const field of requiredFields) {
        if (!pkg[field]) {
          console.log(`  ❌ Missing package.json field: ${field}`);
          valid = false;
        } else {
          console.log(`  ✅ ${field}: ${JSON.stringify(pkg[field]).substring(0, 50)}...`);
        }
      }
      
      // Check package size
      execSync('npm pack --dry-run', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      // Check build output
      const distPath = path.join(__dirname, '..', 'dist');
      if (!require('fs').existsSync(distPath)) {
        console.log('  ❌ dist directory not found - run npm build');
        valid = false;
      }
      
      return valid;
    } catch (error) {
      console.error('Package validation failed:', error.message);
      return false;
    }
  }

  async validateExamples() {
    console.log('Validating example applications...');
    
    const fs = require('fs');
    const examplesPath = path.join(__dirname, '..', 'examples');
    
    if (!fs.existsSync(examplesPath)) {
      console.log('  ❌ Examples directory not found');
      return false;
    }
    
    const examples = fs.readdirSync(examplesPath).filter(d =>
      fs.statSync(path.join(examplesPath, d)).isDirectory()
    );
    
    let allValid = true;
    
    for (const example of examples) {
      console.log(`\n  Testing ${example}...`);
      const examplePath = path.join(examplesPath, example);
      
      try {
        // Check for package.json
        if (!fs.existsSync(path.join(examplePath, 'package.json'))) {
          console.log(`    ❌ Missing package.json`);
          allValid = false;
          continue;
        }
        
        // Check for README
        if (!fs.existsSync(path.join(examplePath, 'README.md'))) {
          console.log(`    ⚠️  Missing README.md`);
        }
        
        // Install and test
        console.log(`    Installing dependencies...`);
        execSync('npm install', {
          cwd: examplePath,
          stdio: 'pipe'
        });
        
        // Run test if available
        const pkg = require(path.join(examplePath, 'package.json'));
        if (pkg.scripts && pkg.scripts.test) {
          console.log(`    Running tests...`);
          execSync('npm test', {
            cwd: examplePath,
            stdio: 'pipe'
          });
        }
        
        console.log(`    ✅ ${example} validated`);
      } catch (error) {
        console.log(`    ❌ ${example} failed: ${error.message}`);
        allValid = false;
      }
    }
    
    return allValid;
  }

  async prepareRelease() {
    console.log('Preparing for release...');
    
    const fs = require('fs');
    let ready = true;
    
    // Check git status
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('  ⚠️  Uncommitted changes detected');
        console.log(status.trim().split('\n').slice(0, 5).map(l => '    ' + l).join('\n'));
        ready = false;
      } else {
        console.log('  ✅ Git repository clean');
      }
    } catch (e) {
      console.log('  ⚠️  Could not check git status');
    }
    
    // Check version and changelog
    const pkg = require('../package.json');
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    
    if (fs.existsSync(changelogPath)) {
      const changelog = fs.readFileSync(changelogPath, 'utf8');
      if (changelog.includes(pkg.version)) {
        console.log(`  ✅ Version ${pkg.version} documented in CHANGELOG`);
      } else {
        console.log(`  ❌ Version ${pkg.version} not in CHANGELOG`);
        ready = false;
      }
    }
    
    // Check npm credentials
    try {
      execSync('npm whoami', { stdio: 'pipe' });
      console.log('  ✅ npm credentials configured');
    } catch (e) {
      console.log('  ⚠️  npm login required before publishing');
    }
    
    return ready;
  }

  async finalChecks() {
    console.log('Running final checks...');
    
    const checks = {
      'Zero dependencies': await this.checkDependencies(),
      'TypeScript support': await this.checkTypeScript(),
      'Node 14+ support': await this.checkNodeVersion(),
      'License present': await this.checkLicense(),
      'Build output exists': await this.checkBuildOutput()
    };
    
    let allPassed = true;
    
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    return allPassed;
  }

  async checkDependencies() {
    const pkg = require('../package.json');
    return !pkg.dependencies || Object.keys(pkg.dependencies).length === 0;
  }

  async checkTypeScript() {
    const fs = require('fs');
    return fs.existsSync(path.join(__dirname, '..', 'types', 'index.d.ts'));
  }

  async checkNodeVersion() {
    const pkg = require('../package.json');
    return pkg.engines && pkg.engines.node && pkg.engines.node.includes('>=14');
  }

  async checkLicense() {
    const fs = require('fs');
    return fs.existsSync(path.join(__dirname, '..', 'LICENSE'));
  }

  async checkBuildOutput() {
    const fs = require('fs');
    return fs.existsSync(path.join(__dirname, '..', 'dist', 'index.js'));
  }

  getAllFiles(dir, ext) {
    const fs = require('fs');
    const files = [];
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scan(fullPath);
        } else if (stat.isFile() && item.endsWith(ext)) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }

  printFinalReport() {
    const duration = ((Date.now() - this.startTime) / 1000 / 60).toFixed(2);
    const total = Object.keys(this.results).length;
    const passed = Object.values(this.results).filter(r => r.success).length;
    const failed = total - passed;
    const criticalFailures = Object.entries(this.results)
      .filter(([, r]) => !r.success && r.critical)
      .map(([phase]) => phase);
    
    console.log(`\n\n${COLORS.bright}${'='.repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.bright}VALIDATION PIPELINE COMPLETE${COLORS.reset}`);
    console.log(`${COLORS.bright}${'='.repeat(60)}${COLORS.reset}\n`);
    
    console.log(`Duration: ${duration} minutes`);
    console.log(`Total Phases: ${total}`);
    console.log(`${COLORS.green}Passed: ${passed}${COLORS.reset}`);
    console.log(`${COLORS.red}Failed: ${failed}${COLORS.reset}\n`);
    
    // Phase results
    console.log('Phase Results:');
    for (const [phase, result] of Object.entries(this.results)) {
      const status = result.success ? `${COLORS.green}✅${COLORS.reset}` : `${COLORS.red}❌${COLORS.reset}`;
      const critical = result.critical ? ' (CRITICAL)' : '';
      console.log(`  ${status} ${phase}${critical}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }
    
    console.log(`\n${COLORS.bright}${'='.repeat(60)}${COLORS.reset}`);
    
    if (failed === 0) {
      console.log(`\n${COLORS.bright}${COLORS.green}🎉 ALL VALIDATIONS PASSED! 🎉${COLORS.reset}`);
      console.log(`\n${COLORS.bright}${COLORS.cyan}@oxog/spark is ready for production!${COLORS.reset}`);
      console.log(`\n${COLORS.yellow}Next steps:${COLORS.reset}`);
      console.log('1. Review the validation results above');
      console.log('2. Ensure you are logged into npm: npm login');
      console.log('3. Publish the package: npm publish --access public');
      console.log('4. Create a git tag: git tag v1.0.0 && git push --tags');
      console.log('5. Create a GitHub release with release notes');
    } else {
      console.log(`\n${COLORS.bright}${COLORS.red}❌ VALIDATION FAILED${COLORS.reset}`);
      
      if (criticalFailures.length > 0) {
        console.log(`\n${COLORS.red}Critical failures that must be fixed:${COLORS.reset}`);
        criticalFailures.forEach((phase, i) => {
          console.log(`${i + 1}. ${phase}`);
        });
      }
      
      console.log(`\n${COLORS.yellow}Please fix all issues before attempting to publish.${COLORS.reset}`);
    }
    
    console.log(`\n${COLORS.bright}${'='.repeat(60)}${COLORS.reset}\n`);
  }
}

// Run validation pipeline
if (require.main === module) {
  const validator = new MasterValidator();
  
  validator.runAllValidations().catch(error => {
    console.error(`\n${COLORS.red}Fatal error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  });
}

module.exports = MasterValidator;