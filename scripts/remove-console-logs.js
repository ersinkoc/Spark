#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const directories = [
  'src',
  'src/core',
  'src/middleware', 
  'src/router',
  'src/utils'
];

let filesFixed = 0;
let logsRemoved = 0;

directories.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }
  
  const files = fs.readdirSync(fullPath).filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(fullPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove console.log statements but keep console.error for error handling
    // Match console.log(...) including multi-line ones
    const consoleLogRegex = /console\.log\([^)]*\);?/g;
    const matches = content.match(consoleLogRegex);
    
    if (matches) {
      content = content.replace(consoleLogRegex, '// Console.log removed for production');
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Fixed: ${path.relative(process.cwd(), filePath)} (${matches.length} console.log statements removed)`);
        filesFixed++;
        logsRemoved += matches.length;
      }
    }
  });
});

console.log(`\n✅ Removed ${logsRemoved} console.log statements from ${filesFixed} files`);