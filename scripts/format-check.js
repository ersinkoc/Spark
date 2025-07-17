#!/usr/bin/env node

/**
 * Code formatting checker for @oxog/spark
 * Ensures consistent code style across the project
 */

const fs = require('fs');
const path = require('path');

class FormatChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.filesChecked = 0;
  }

  check() {
    console.log('🎨 Checking code formatting for @oxog/spark\n');

    const directories = [
      path.join(__dirname, '..', 'src'),
      path.join(__dirname, '..', 'tests'),
      path.join(__dirname, '..', 'examples'),
      path.join(__dirname, '..', 'benchmarks'),
      path.join(__dirname, '..', 'scripts')
    ];

    directories.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.checkDirectory(dir);
      }
    });

    this.printReport();
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  checkDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        this.checkDirectory(fullPath);
      } else if (stat.isFile() && file.endsWith('.js')) {
        this.checkFile(fullPath);
      }
    });
  }

  checkFile(filePath) {
    this.filesChecked++;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check various formatting rules
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check line length
      if (line.length > 100) {
        this.warnings.push({
          file: relativePath,
          line: lineNum,
          message: `Line exceeds 100 characters (${line.length} chars)`
        });
      }
      
      // Check trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        this.errors.push({
          file: relativePath,
          line: lineNum,
          message: 'Trailing whitespace'
        });
      }
      
      // Check tabs vs spaces (enforce 2 spaces)
      if (line.includes('\t')) {
        this.errors.push({
          file: relativePath,
          line: lineNum,
          message: 'Tab character found (use 2 spaces)'
        });
      }
      
      // Check console.log statements (should not be in production code)
      if (line.includes('console.log') && !filePath.includes('test') && !filePath.includes('example')) {
        this.warnings.push({
          file: relativePath,
          line: lineNum,
          message: 'console.log found in production code'
        });
      }
      
      // Check for proper spacing around operators
      const operatorIssues = this.checkOperatorSpacing(line);
      operatorIssues.forEach(issue => {
        this.errors.push({
          file: relativePath,
          line: lineNum,
          message: issue
        });
      });
    });
    
    // Check file-level issues
    
    // Check for missing newline at end of file
    if (content.length > 0 && !content.endsWith('\n')) {
      this.errors.push({
        file: relativePath,
        line: lines.length,
        message: 'Missing newline at end of file'
      });
    }
    
    // Check for consistent quotes (prefer single quotes)
    const doubleQuotes = content.match(/"/g) || [];
    const singleQuotes = content.match(/'/g) || [];
    if (doubleQuotes.length > singleQuotes.length * 2) {
      this.warnings.push({
        file: relativePath,
        line: 0,
        message: 'Inconsistent quotes (prefer single quotes)'
      });
    }
    
    // Check semicolon usage
    const missingSemicolons = this.checkSemicolons(lines);
    missingSemicolons.forEach(({ line, lineNum }) => {
      this.errors.push({
        file: relativePath,
        line: lineNum,
        message: 'Missing semicolon'
      });
    });
  }

  checkOperatorSpacing(line) {
    const issues = [];
    
    // Check for operators that should have spaces around them
    const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<', '&&', '||', '=>'];
    
    operators.forEach(op => {
      const regex = new RegExp(`\\S${op}|${op}\\S`);
      if (regex.test(line)) {
        // Make sure it's not within a string
        if (!this.isInString(line, line.indexOf(op))) {
          issues.push(`Missing space around '${op}' operator`);
        }
      }
    });
    
    return issues;
  }

  checkSemicolons(lines) {
    const missing = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip empty lines, comments, and block statements
      if (!trimmed || 
          trimmed.startsWith('//') || 
          trimmed.startsWith('*') ||
          trimmed.endsWith('{') ||
          trimmed.endsWith(',') ||
          trimmed.startsWith('}') ||
          trimmed.includes('else') ||
          trimmed.includes('catch')) {
        return;
      }
      
      // Check if line should end with semicolon
      if (trimmed.match(/^(const|let|var|return|throw|break|continue)\s/) ||
          trimmed.match(/^\w+\s*=/) ||
          trimmed.match(/^\w+\.\w+/) ||
          trimmed.match(/^\w+\(.*\)$/)) {
        
        if (!trimmed.endsWith(';')) {
          missing.push({ line: trimmed, lineNum: index + 1 });
        }
      }
    });
    
    return missing;
  }

  isInString(line, position) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;
    
    for (let i = 0; i < position; i++) {
      const char = line[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
    }
    
    return inSingleQuote || inDoubleQuote;
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('FORMAT CHECK REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nFiles checked: ${this.filesChecked}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must fix):');
      this.errors.forEach(error => {
        console.log(`  ${error.file}:${error.line} - ${error.message}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (should fix):');
      this.warnings.forEach(warning => {
        console.log(`  ${warning.file}:${warning.line} - ${warning.message}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ All formatting checks passed!');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run format check
if (require.main === module) {
  const checker = new FormatChecker();
  checker.check();
}

module.exports = FormatChecker;