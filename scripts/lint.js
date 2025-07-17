#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const eslintConfig = path.join(rootDir, '.eslintrc.js');

console.log('🔍 Linting Spark Framework...\n');

// Check if ESLint config exists
if (!fs.existsSync(eslintConfig)) {
  console.error('❌ Error: .eslintrc.js not found');
  process.exit(1);
}

// Since we're running without dependencies, provide a basic linter
const errors = [];
const warnings = [];

// Define directories to lint
const dirsToLint = ['src', 'tests', 'examples'].map(dir => path.join(rootDir, dir));

dirsToLint.forEach(dir => {
  if (fs.existsSync(dir)) {
    lintDirectory(dir);
  }
});

// Report results
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ No linting errors found!');
} else {
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`);
    warnings.forEach(w => console.log(`   ${w}`));
  }
  
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   ${e}`));
    process.exit(1);
  }
}

function lintDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      lintDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      lintFile(fullPath);
    }
  }
}

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(rootDir, filePath);
  const lines = content.split('\n');
  
  // Basic linting rules
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for console.log statements (warning)
    if (line.includes('console.log(') && !filePath.includes('scripts')) {
      warnings.push(`${relativePath}:${lineNum} - console.log statement found`);
    }
    
    // Check for TODO comments
    if (line.includes('TODO')) {
      warnings.push(`${relativePath}:${lineNum} - TODO comment found`);
    }
    
    // Check for very long lines
    if (line.length > 120) {
      warnings.push(`${relativePath}:${lineNum} - Line exceeds 120 characters`);
    }
    
    // Check for tabs (should use spaces)
    if (line.includes('\t')) {
      errors.push(`${relativePath}:${lineNum} - Tab character found (use spaces)`);
    }
    
    // Check for trailing whitespace
    if (line.endsWith(' ') || line.endsWith('\t')) {
      errors.push(`${relativePath}:${lineNum} - Trailing whitespace`);
    }
    
    // Check for == or != (should use === or !==)
    if (/[^=!]==[^=]/.test(line) || /[^!]!=[^=]/.test(line)) {
      if (!line.includes('typeof') && !line.includes('null')) {
        warnings.push(`${relativePath}:${lineNum} - Use === or !== instead of == or !=`);
      }
    }
  });
  
  // Check for missing 'use strict' in Node.js files
  if (!content.includes("'use strict'") && !content.includes('"use strict"')) {
    warnings.push(`${relativePath} - Missing 'use strict' directive`);
  }
}