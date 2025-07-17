#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

console.log('🏗️  Building Spark Framework...\n');

// Clean dist directory
if (fs.existsSync(distDir)) {
  console.log('Cleaning dist directory...');
  fs.rmSync(distDir, { recursive: true, force: true });
}

// Create dist directory
fs.mkdirSync(distDir, { recursive: true });

// Copy source files to dist
console.log('Copying source files...');
copyDir(srcDir, distDir);

// Copy type definitions
const typesFile = path.join(rootDir, 'types', 'index.d.ts');
if (fs.existsSync(typesFile)) {
  console.log('Copying type definitions...');
  const distTypesDir = path.join(distDir, 'types');
  fs.mkdirSync(distTypesDir, { recursive: true });
  fs.copyFileSync(typesFile, path.join(distTypesDir, 'index.d.ts'));
}

// Copy package.json (without scripts)
console.log('Creating distribution package.json...');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const distPackageJson = {
  ...packageJson,
  scripts: {
    test: packageJson.scripts.test
  },
  main: 'index.js',
  types: 'types/index.d.ts'
};
fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPackageJson, null, 2)
);

// Copy README and LICENSE
console.log('Copying documentation files...');
['README.md', 'LICENSE'].forEach(file => {
  const srcFile = path.join(rootDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(distDir, file));
  }
});

console.log('\n✅ Build completed successfully!');
console.log(`📦 Output directory: ${distDir}`);

// Helper function to recursively copy directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}