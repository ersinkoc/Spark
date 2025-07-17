#!/usr/bin/env node

/**
 * Build validator for @oxog/spark
 * Ensures the built package is correct and functional
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.distDir = path.join(__dirname, '..', 'dist');
  }

  validate() {
    console.log('🏗️  Validating build output for @oxog/spark\n');

    // Check if dist directory exists
    if (!fs.existsSync(this.distDir)) {
      console.error('❌ Build directory (dist/) not found. Run npm build first.');
      process.exit(1);
    }

    // Run validation checks
    this.checkRequiredFiles();
    this.checkFileStructure();
    this.checkMinification();
    this.checkSourceMaps();
    this.testBuiltPackage();
    this.checkBundleSize();
    this.validateExports();

    // Print report
    this.printReport();

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  checkRequiredFiles() {
    console.log('Checking required files...');
    
    const requiredFiles = [
      'index.js',
      'core/application.js',
      'core/router.js',
      'core/context.js',
      'core/request.js',
      'core/response.js',
      'core/middleware.js',
      'middleware/index.js',
      'utils/index.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(this.distDir, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Missing required file: dist/${file}`);
      } else {
        // Check if file is not empty
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          this.errors.push(`Empty file: dist/${file}`);
        }
      }
    });
  }

  checkFileStructure() {
    console.log('Checking file structure...');
    
    const expectedDirs = ['core', 'middleware', 'utils'];
    
    expectedDirs.forEach(dir => {
      const dirPath = path.join(this.distDir, dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.push(`Missing directory: dist/${dir}`);
      }
    });

    // Check that no test files are included
    this.checkNoTestFiles(this.distDir);
    
    // Check that no source maps are in production build
    this.checkNoDevFiles(this.distDir);
  }

  checkNoTestFiles(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.checkNoTestFiles(fullPath);
      } else if (file.includes('.test.') || file.includes('.spec.') || file.includes('test-')) {
        this.errors.push(`Test file found in build: ${path.relative(this.distDir, fullPath)}`);
      }
    });
  }

  checkNoDevFiles(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.checkNoDevFiles(fullPath);
      } else if (file.endsWith('.map') || file.includes('.dev.') || file === '.DS_Store') {
        this.warnings.push(`Development file found: ${path.relative(this.distDir, fullPath)}`);
      }
    });
  }

  checkMinification() {
    console.log('Checking minification...');
    
    // Check if files are minified
    const mainFile = path.join(this.distDir, 'index.js');
    if (fs.existsSync(mainFile)) {
      const content = fs.readFileSync(mainFile, 'utf8');
      const lines = content.split('\n');
      
      // Simple check: minified files typically have very long lines
      const avgLineLength = content.length / lines.length;
      
      if (avgLineLength < 100) {
        this.warnings.push('Files may not be properly minified');
      }
      
      // Check for comments (should be removed in production)
      if (content.includes('//') || content.includes('/*')) {
        this.warnings.push('Comments found in production build');
      }
    }
  }

  checkSourceMaps() {
    console.log('Checking source maps...');
    
    // Count .map files
    let mapFiles = 0;
    const countMaps = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          countMaps(fullPath);
        } else if (file.endsWith('.map')) {
          mapFiles++;
        }
      });
    };
    
    countMaps(this.distDir);
    
    if (mapFiles > 0) {
      console.log(`  Found ${mapFiles} source map files (good for debugging)`);
    }
  }

  testBuiltPackage() {
    console.log('Testing built package...');
    
    try {
      // Try to require the built package
      const builtPackage = require(path.join(this.distDir, 'index.js'));
      
      // Check main exports
      const expectedExports = ['Spark', 'Router', 'middleware'];
      expectedExports.forEach(exp => {
        if (!builtPackage[exp]) {
          this.errors.push(`Missing export: ${exp}`);
        }
      });
      
      // Test basic functionality
      const { Spark } = builtPackage;
      const app = new Spark();
      
      if (typeof app.use !== 'function') {
        this.errors.push('Spark instance missing use() method');
      }
      
      if (typeof app.listen !== 'function') {
        this.errors.push('Spark instance missing listen() method');
      }
      
      console.log('  ✅ Built package loads and exports correctly');
      
    } catch (error) {
      this.errors.push(`Failed to load built package: ${error.message}`);
    }
  }

  checkBundleSize() {
    console.log('Checking bundle size...');
    
    const maxSize = 100 * 1024; // 100KB
    let totalSize = 0;
    
    const calculateSize = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          calculateSize(fullPath);
        } else if (file.endsWith('.js')) {
          totalSize += stat.size;
        }
      });
    };
    
    calculateSize(this.distDir);
    
    const sizeKB = Math.round(totalSize / 1024);
    console.log(`  Total size: ${sizeKB}KB`);
    
    if (totalSize > maxSize) {
      this.errors.push(`Bundle size (${sizeKB}KB) exceeds limit (100KB)`);
    } else {
      console.log('  ✅ Bundle size within limits');
    }
    
    // Check individual file sizes
    this.checkLargeFiles(this.distDir);
  }

  checkLargeFiles(dir) {
    const files = fs.readdirSync(dir);
    const largeFileThreshold = 50 * 1024; // 50KB
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.checkLargeFiles(fullPath);
      } else if (stat.isFile() && stat.size > largeFileThreshold) {
        const sizeKB = Math.round(stat.size / 1024);
        this.warnings.push(`Large file: ${path.relative(this.distDir, fullPath)} (${sizeKB}KB)`);
      }
    });
  }

  validateExports() {
    console.log('Validating module exports...');
    
    // Check package.json main field
    const pkg = require('../package.json');
    if (!pkg.main || !pkg.main.includes('dist')) {
      this.warnings.push('package.json main field should point to dist/');
    }
    
    // Check that TypeScript definitions reference built files
    if (pkg.types) {
      const typesPath = path.join(__dirname, '..', pkg.types);
      if (fs.existsSync(typesPath)) {
        const typesContent = fs.readFileSync(typesPath, 'utf8');
        if (typesContent.includes('/src/')) {
          this.warnings.push('TypeScript definitions should reference dist/ not src/');
        }
      }
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('BUILD VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nErrors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must fix):');
      this.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (should fix):');
      this.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }
    
    if (this.errors.length === 0) {
      console.log('\n✅ Build validation passed!');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run validation
if (require.main === module) {
  const validator = new BuildValidator();
  validator.validate();
}

module.exports = BuildValidator;