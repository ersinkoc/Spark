#!/usr/bin/env node

/**
 * Production build script for @oxog/spark
 * Creates optimized build for npm publishing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');

console.log('🏗️  Building @oxog/spark for production...\n');

// Step 1: Clean dist directory
console.log('Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

// Step 2: Copy and minify source files
console.log('Building minified distribution...');
copyAndMinify(srcDir, distDir);

// Step 3: Copy type definitions
console.log('Copying TypeScript definitions...');
const typesSrc = path.join(rootDir, 'types', 'index.d.ts');
const typesDest = path.join(distDir, 'index.d.ts');
fs.copyFileSync(typesSrc, typesDest);

// Step 4: Create minimal package.json
console.log('Creating package.json...');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const distPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'index.js',
  types: 'index.d.ts',
  author: pkg.author,
  license: pkg.license,
  repository: pkg.repository,
  keywords: pkg.keywords,
  engines: pkg.engines
};
fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPkg, null, 2)
);

// Step 5: Copy essential docs
console.log('Copying documentation...');
fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(distDir, 'README.md'));
fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(distDir, 'LICENSE'));
fs.copyFileSync(path.join(rootDir, 'CHANGELOG.md'), path.join(distDir, 'CHANGELOG.md'));

console.log('\n✅ Production build complete!');
console.log(`📦 Output: ${distDir}`);

// Calculate final size
const files = getAllFiles(distDir);
const totalSize = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`📊 Total size: ${(totalSize / 1024).toFixed(1)}KB`);

function copyAndMinify(source, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest);
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyAndMinify(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      // Minify JavaScript files
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = minifyCode(content);
      fs.writeFileSync(destPath, minified);
    }
  }
}

function minifyCode(code) {
  // Remove comments
  let minified = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
    .replace(/\/\/.*$/gm, ''); // Single-line comments

  // Remove unnecessary whitespace
  minified = minified
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\s*([{}();,:])\s*/g, '$1') // Remove spaces around punctuation
    .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();

  // Preserve license header
  const licenseMatch = code.match(/^\/\*\*[\s\S]*?@fileoverview[\s\S]*?\*\//);
  if (licenseMatch) {
    minified = licenseMatch[0] + '\n' + minified;
  }

  return minified;
}

function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}