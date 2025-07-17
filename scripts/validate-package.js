#!/usr/bin/env node

/**
 * Package validator for @oxog/spark
 * Ensures package.json and npm package are correctly configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PackageValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.pkg = null;
  }

  validate() {
    console.log('📦 Validating package configuration for @oxog/spark\n');

    // Load package.json
    try {
      this.pkg = require('../package.json');
    } catch (error) {
      console.error('❌ Failed to load package.json');
      process.exit(1);
    }

    // Run validation checks
    this.checkRequiredFields();
    this.checkPackageName();
    this.checkVersion();
    this.checkDependencies();
    this.checkScripts();
    this.checkFiles();
    this.checkEngines();
    this.checkRepository();
    this.checkKeywords();
    this.checkLicense();
    this.testPackaging();
    this.checkPublishConfig();

    // Print report
    this.printReport();

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  checkRequiredFields() {
    console.log('Checking required fields...');
    
    const requiredFields = [
      'name',
      'version',
      'description',
      'main',
      'author',
      'license',
      'repository',
      'keywords',
      'engines'
    ];

    requiredFields.forEach(field => {
      if (!this.pkg[field]) {
        this.errors.push(`Missing required field: ${field}`);
      }
    });

    // Check author format
    if (this.pkg.author && typeof this.pkg.author === 'string') {
      if (!this.pkg.author.includes('<') || !this.pkg.author.includes('>')) {
        this.warnings.push('Author field should include email in format: Name <email>');
      }
    }
  }

  checkPackageName() {
    console.log('Checking package name...');
    
    const name = this.pkg.name;
    
    if (!name) {
      this.errors.push('Package name is missing');
      return;
    }

    // Check scoped package format
    if (name.startsWith('@')) {
      if (!name.match(/^@[a-z0-9-]+\/[a-z0-9-]+$/)) {
        this.errors.push('Invalid scoped package name format');
      }
      
      if (name !== '@oxog/spark') {
        this.warnings.push(`Package name should be @oxog/spark, not ${name}`);
      }
    }

    // Check naming conventions
    if (name.includes('_')) {
      this.warnings.push('Package name should use hyphens, not underscores');
    }

    if (name !== name.toLowerCase()) {
      this.errors.push('Package name must be lowercase');
    }
  }

  checkVersion() {
    console.log('Checking version...');
    
    const version = this.pkg.version;
    
    if (!version) {
      this.errors.push('Version is missing');
      return;
    }

    // Check semver format
    if (!version.match(/^\d+\.\d+\.\d+(-[\w.]+)?$/)) {
      this.errors.push('Version must follow semver format (x.y.z)');
    }

    // Check if version is tagged in git
    try {
      const tags = execSync('git tag', { encoding: 'utf8' });
      if (!tags.includes(`v${version}`)) {
        this.warnings.push(`Version ${version} is not tagged in git (expected tag: v${version})`);
      }
    } catch (e) {
      // Git not available
    }
  }

  checkDependencies() {
    console.log('Checking dependencies...');
    
    // Check for zero dependencies
    if (this.pkg.dependencies && Object.keys(this.pkg.dependencies).length > 0) {
      this.errors.push(`Found ${Object.keys(this.pkg.dependencies).length} dependencies - Spark should have zero dependencies`);
      Object.keys(this.pkg.dependencies).forEach(dep => {
        this.errors.push(`  - ${dep}`);
      });
    }

    // Check devDependencies are not included in package
    if (this.pkg.devDependencies) {
      // This is ok, just make sure they're not bundled
      const filesList = this.pkg.files || [];
      if (filesList.includes('node_modules')) {
        this.errors.push('node_modules should not be included in package files');
      }
    }
  }

  checkScripts() {
    console.log('Checking scripts...');
    
    if (!this.pkg.scripts) {
      this.errors.push('No scripts defined');
      return;
    }

    // Check for essential scripts
    const essentialScripts = ['test', 'build', 'lint'];
    essentialScripts.forEach(script => {
      if (!this.pkg.scripts[script]) {
        this.warnings.push(`Missing script: ${script}`);
      }
    });

    // Check prepublishOnly hook
    if (!this.pkg.scripts.prepublishOnly) {
      this.errors.push('Missing prepublishOnly script to validate before publish');
    }

    // Verify script files exist
    Object.entries(this.pkg.scripts).forEach(([name, command]) => {
      if (command.includes('node ')) {
        const scriptMatch = command.match(/node\s+([^\s]+)/);
        if (scriptMatch) {
          const scriptPath = path.join(__dirname, '..', scriptMatch[1]);
          if (!fs.existsSync(scriptPath)) {
            this.errors.push(`Script file not found for '${name}': ${scriptMatch[1]}`);
          }
        }
      }
    });
  }

  checkFiles() {
    console.log('Checking files configuration...');
    
    if (!this.pkg.files) {
      this.warnings.push('No files array specified - all files will be included');
      return;
    }

    // Check that essential files are included
    const essentialFiles = ['dist/', 'types/', 'README.md', 'LICENSE'];
    essentialFiles.forEach(file => {
      if (!this.pkg.files.some(f => f === file || f === file.replace('/', ''))) {
        this.errors.push(`Essential file/directory not in files array: ${file}`);
      }
    });

    // Check that dev files are excluded
    const excludePatterns = ['test', 'tests', 'examples', 'docs', '.git', 'node_modules'];
    excludePatterns.forEach(pattern => {
      if (this.pkg.files.includes(pattern)) {
        this.warnings.push(`Development files should not be included: ${pattern}`);
      }
    });
  }

  checkEngines() {
    console.log('Checking engines...');
    
    if (!this.pkg.engines) {
      this.errors.push('Missing engines field');
      return;
    }

    if (!this.pkg.engines.node) {
      this.errors.push('Missing node engine requirement');
    } else {
      // Check node version requirement
      if (!this.pkg.engines.node.includes('>=14')) {
        this.warnings.push('Node engine should support >=14.0.0');
      }
    }
  }

  checkRepository() {
    console.log('Checking repository...');
    
    if (!this.pkg.repository) {
      this.errors.push('Missing repository field');
      return;
    }

    if (typeof this.pkg.repository === 'string') {
      this.warnings.push('Repository should be an object with type and url');
    } else {
      if (!this.pkg.repository.type) {
        this.errors.push('Repository missing type field');
      }
      if (!this.pkg.repository.url) {
        this.errors.push('Repository missing url field');
      }
    }

    // Check bugs URL
    if (!this.pkg.bugs) {
      this.warnings.push('Missing bugs field for issue reporting');
    }

    // Check homepage
    if (!this.pkg.homepage) {
      this.warnings.push('Missing homepage field');
    }
  }

  checkKeywords() {
    console.log('Checking keywords...');
    
    if (!this.pkg.keywords || !Array.isArray(this.pkg.keywords)) {
      this.errors.push('Missing or invalid keywords array');
      return;
    }

    if (this.pkg.keywords.length < 5) {
      this.warnings.push(`Only ${this.pkg.keywords.length} keywords - consider adding more for discoverability`);
    }

    // Check for relevant keywords
    const recommendedKeywords = ['api', 'framework', 'server', 'http', 'web'];
    const missingKeywords = recommendedKeywords.filter(k => !this.pkg.keywords.includes(k));
    
    if (missingKeywords.length > 0) {
      this.warnings.push(`Consider adding keywords: ${missingKeywords.join(', ')}`);
    }
  }

  checkLicense() {
    console.log('Checking license...');
    
    if (!this.pkg.license) {
      this.errors.push('Missing license field');
      return;
    }

    // Check LICENSE file exists
    const licensePath = path.join(__dirname, '..', 'LICENSE');
    if (!fs.existsSync(licensePath)) {
      this.errors.push('LICENSE file not found');
    } else {
      const licenseContent = fs.readFileSync(licensePath, 'utf8');
      
      // Check if license matches package.json
      if (this.pkg.license === 'MIT' && !licenseContent.includes('MIT License')) {
        this.errors.push('LICENSE file does not match package.json license type');
      }
      
      // Check for copyright
      if (!licenseContent.includes('Copyright')) {
        this.warnings.push('LICENSE file missing Copyright notice');
      }
    }
  }

  testPackaging() {
    console.log('Testing package creation...');
    
    try {
      // Run npm pack dry-run
      const output = execSync('npm pack --dry-run', { encoding: 'utf8' });
      
      // Parse included files
      const files = output.split('\n').filter(line => line.includes('npm notice'));
      console.log(`  Package will include ${files.length} files`);
      
      // Check for unexpected files
      const unexpectedPatterns = ['.test.js', '.spec.js', 'node_modules', '.git'];
      unexpectedPatterns.forEach(pattern => {
        if (files.some(file => file.includes(pattern))) {
          this.warnings.push(`Unexpected files matching '${pattern}' will be included in package`);
        }
      });
      
      // Extract package size
      const sizeMatch = output.match(/package size:\s*([\d.]+\s*[KM]B)/);
      if (sizeMatch) {
        console.log(`  Package size: ${sizeMatch[1]}`);
        
        // Check if size is reasonable
        const sizeKB = parseFloat(sizeMatch[1]);
        if (sizeKB > 100) {
          this.warnings.push(`Package size (${sizeMatch[1]}) exceeds 100KB`);
        }
      }
      
    } catch (error) {
      this.errors.push(`npm pack failed: ${error.message}`);
    }
  }

  checkPublishConfig() {
    console.log('Checking publish configuration...');
    
    // Check if publishConfig is set for scoped packages
    if (this.pkg.name && this.pkg.name.startsWith('@')) {
      if (!this.pkg.publishConfig || this.pkg.publishConfig.access !== 'public') {
        this.warnings.push('Scoped packages should have publishConfig.access = "public"');
      }
    }

    // Check if package is private
    if (this.pkg.private === true) {
      this.errors.push('Package is marked as private and cannot be published');
    }

    // Check registry configuration
    try {
      const registry = execSync('npm config get registry', { encoding: 'utf8' }).trim();
      if (!registry.includes('registry.npmjs.org')) {
        this.warnings.push(`Non-standard npm registry configured: ${registry}`);
      }
    } catch (e) {
      // npm not configured
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('PACKAGE VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nPackage: ${this.pkg.name || 'unknown'}`);
    console.log(`Version: ${this.pkg.version || 'unknown'}`);
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
      console.log('\n✅ Package validation passed!');
      console.log('\nReady to publish with: npm publish --access public');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run validation
if (require.main === module) {
  const validator = new PackageValidator();
  validator.validate();
}

module.exports = PackageValidator;