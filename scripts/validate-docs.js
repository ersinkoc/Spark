#!/usr/bin/env node

/**
 * Documentation validator for @oxog/spark
 * Ensures all documentation is complete and accurate
 */

const fs = require('fs');
const path = require('path');

class DocsValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.docsChecked = 0;
  }

  validate() {
    console.log('📚 Validating documentation for @oxog/spark\n');

    // Check required documentation files
    const requiredDocs = [
      { file: 'README.md', minSize: 2000 },
      { file: 'CHANGELOG.md', minSize: 500 },
      { file: 'CONTRIBUTING.md', minSize: 1000 },
      { file: 'LICENSE', minSize: 1000 },
      { file: 'docs/getting-started.md', minSize: 1500 },
      { file: 'docs/api-reference.md', minSize: 3000 },
      { file: 'docs/middleware-guide.md', minSize: 2000 },
      { file: 'docs/security-best-practices.md', minSize: 2000 }
    ];

    // Check each required doc
    requiredDocs.forEach(doc => {
      this.checkDocument(doc);
    });

    // Check for broken links
    this.checkBrokenLinks();

    // Check code examples
    this.checkCodeExamples();

    // Check API documentation completeness
    this.checkAPIDocumentation();

    // Print report
    this.printReport();

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  checkDocument({ file, minSize }) {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
      this.errors.push(`Missing required documentation: ${file}`);
      return;
    }

    this.docsChecked++;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check minimum size
    if (content.length < minSize) {
      this.warnings.push(`${file} is too short (${content.length} chars, minimum ${minSize})`);
    }

    // Check for required sections based on file type
    if (file === 'README.md') {
      this.checkReadme(content);
    } else if (file === 'CHANGELOG.md') {
      this.checkChangelog(content);
    } else if (file === 'CONTRIBUTING.md') {
      this.checkContributing(content);
    } else if (file.includes('api-reference')) {
      this.checkAPIReference(content);
    }

    // Check for TODO or FIXME comments
    const todos = content.match(/TODO|FIXME/gi) || [];
    if (todos.length > 0) {
      this.warnings.push(`${file} contains ${todos.length} TODO/FIXME comments`);
    }
  }

  checkReadme(content) {
    const requiredSections = [
      'Installation',
      'Quick Start',
      'Features',
      'Documentation',
      'Examples',
      'License'
    ];

    requiredSections.forEach(section => {
      if (!content.includes(`# ${section}`) && !content.includes(`## ${section}`)) {
        this.errors.push(`README.md missing section: ${section}`);
      }
    });

    // Check for badges
    if (!content.includes('![') && !content.includes('[![')) {
      this.warnings.push('README.md should include status badges');
    }

    // Check for code examples
    const codeBlocks = content.match(/```javascript[\s\S]*?```/g) || [];
    if (codeBlocks.length < 2) {
      this.warnings.push('README.md should include more code examples');
    }
  }

  checkChangelog(content) {
    // Check format
    if (!content.includes('# Changelog') && !content.includes('# Change Log')) {
      this.errors.push('CHANGELOG.md missing proper header');
    }

    // Check for version entries
    const versionPattern = /## \[?\d+\.\d+\.\d+\]?/g;
    const versions = content.match(versionPattern) || [];
    
    if (versions.length === 0) {
      this.errors.push('CHANGELOG.md missing version entries');
    }

    // Check for current version
    const pkg = require('../package.json');
    if (!content.includes(pkg.version)) {
      this.errors.push(`CHANGELOG.md missing current version ${pkg.version}`);
    }
  }

  checkContributing(content) {
    const requiredSections = [
      'Code of Conduct',
      'How to Contribute',
      'Pull Request',
      'Code Style',
      'Testing'
    ];

    requiredSections.forEach(section => {
      if (!content.toLowerCase().includes(section.toLowerCase())) {
        this.warnings.push(`CONTRIBUTING.md should include section: ${section}`);
      }
    });
  }

  checkAPIReference(content) {
    // Check for main API classes
    const mainAPIs = ['Spark', 'Router', 'Context', 'Request', 'Response'];
    
    mainAPIs.forEach(api => {
      if (!content.includes(`## ${api}`) && !content.includes(`### ${api}`)) {
        this.errors.push(`API Reference missing documentation for: ${api}`);
      }
    });

    // Check for method documentation
    const methods = ['use', 'listen', 'get', 'post', 'put', 'delete'];
    methods.forEach(method => {
      if (!content.includes(`.${method}(`)) {
        this.warnings.push(`API Reference should document method: ${method}`);
      }
    });
  }

  checkBrokenLinks() {
    console.log('Checking for broken links...');
    
    const docsDir = path.join(__dirname, '..', 'docs');
    const allDocs = this.getAllMarkdownFiles(path.join(__dirname, '..'));
    
    allDocs.forEach(docPath => {
      const content = fs.readFileSync(docPath, 'utf8');
      const relativePath = path.relative(process.cwd(), docPath);
      
      // Find all markdown links
      const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      
      links.forEach(link => {
        const url = link.match(/\]\(([^)]+)\)/)[1];
        
        // Check relative links
        if (url.startsWith('./') || url.startsWith('../')) {
          const linkPath = path.resolve(path.dirname(docPath), url);
          
          // Remove anchor if present
          const filePath = linkPath.split('#')[0];
          
          if (!fs.existsSync(filePath)) {
            this.errors.push(`Broken link in ${relativePath}: ${url}`);
          }
        }
      });
    });
  }

  checkCodeExamples() {
    console.log('Validating code examples...');
    
    const allDocs = this.getAllMarkdownFiles(path.join(__dirname, '..'));
    
    allDocs.forEach(docPath => {
      const content = fs.readFileSync(docPath, 'utf8');
      const relativePath = path.relative(process.cwd(), docPath);
      
      // Extract code blocks
      const codeBlocks = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/g) || [];
      
      codeBlocks.forEach((block, index) => {
        const code = block.replace(/```(?:javascript|js)?\n/, '').replace(/```$/, '');
        
        // Basic syntax check
        try {
          // Check for basic syntax errors using Function constructor
          new Function(code);
        } catch (error) {
          // Some code examples might be fragments, so only warn
          if (error.message.includes('Unexpected token')) {
            this.warnings.push(`${relativePath}: Code example ${index + 1} may have syntax error`);
          }
        }
        
        // Check for common issues
        if (code.includes('Spark') && !code.includes('require') && !code.includes('import')) {
          this.warnings.push(`${relativePath}: Code example ${index + 1} uses Spark without importing`);
        }
      });
    });
  }

  checkAPIDocumentation() {
    console.log('Checking API documentation completeness...');
    
    // Load actual exports from source
    const srcIndex = path.join(__dirname, '..', 'src', 'index.js');
    const srcContent = fs.readFileSync(srcIndex, 'utf8');
    
    // Extract exports
    const exports = [];
    const exportMatches = srcContent.match(/module\.exports\s*=\s*{([^}]+)}/);
    if (exportMatches) {
      const exportContent = exportMatches[1];
      const items = exportContent.match(/\w+/g) || [];
      exports.push(...items);
    }
    
    // Check if all exports are documented
    const apiDocPath = path.join(__dirname, '..', 'docs', 'api-reference.md');
    if (fs.existsSync(apiDocPath)) {
      const apiDoc = fs.readFileSync(apiDocPath, 'utf8');
      
      exports.forEach(exportName => {
        if (!apiDoc.includes(exportName)) {
          this.warnings.push(`API documentation missing for exported: ${exportName}`);
        }
      });
    }
  }

  getAllMarkdownFiles(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.getAllMarkdownFiles(fullPath));
      } else if (stat.isFile() && (item.endsWith('.md') || item === 'LICENSE')) {
        files.push(fullPath);
      }
    });
    
    return files;
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('DOCUMENTATION VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nDocuments checked: ${this.docsChecked}`);
    console.log(`Errors: ${this.errors.length}`);
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
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ All documentation checks passed!');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run validation
if (require.main === module) {
  const validator = new DocsValidator();
  validator.validate();
}

module.exports = DocsValidator;