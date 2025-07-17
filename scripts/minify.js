#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('🗜️  Minifying Spark Framework...\n');

if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

let totalSizeBefore = 0;
let totalSizeAfter = 0;

// Process all JavaScript files in dist
processDirectory(distDir);

const reduction = ((totalSizeBefore - totalSizeAfter) / totalSizeBefore * 100).toFixed(1);
console.log(`\n✅ Minification complete!`);
console.log(`📊 Size reduction: ${formatBytes(totalSizeBefore)} → ${formatBytes(totalSizeAfter)} (${reduction}% smaller)`);

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      minifyFile(fullPath);
    }
  }
}

function minifyFile(filePath) {
  const relativePath = path.relative(distDir, filePath);
  console.log(`Minifying ${relativePath}...`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const sizeBefore = Buffer.byteLength(content);
  totalSizeBefore += sizeBefore;
  
  // Basic minification (production build would use a proper minifier)
  let minified = content
    // Remove comments (basic - doesn't handle all cases)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    // Remove unnecessary whitespace
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}();,:])\s*/g, '$1')
    .replace(/;\s*}/g, '}')
    // Remove trailing semicolons before closing braces
    .replace(/;}/g, '}')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  const sizeAfter = Buffer.byteLength(minified);
  totalSizeAfter += sizeAfter;
  
  // Create minified version
  const minPath = filePath.replace(/\.js$/, '.min.js');
  fs.writeFileSync(minPath, minified);
  
  // Create source map reference
  const mapComment = `\n//# sourceMappingURL=${path.basename(filePath)}.map`;
  fs.appendFileSync(minPath, mapComment);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}