#!/usr/bin/env node

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');

console.log('🚀 Building Spark Framework with esbuild...\n');

// Clean dist directory
if (fs.existsSync(distDir)) {
  console.log('Cleaning dist directory...');
  fs.rmSync(distDir, { recursive: true, force: true });
}

fs.mkdirSync(distDir, { recursive: true });

async function build() {
  try {
    // Build CommonJS version
    console.log('Building CommonJS version...');
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'index.js')],
      bundle: false,
      platform: 'node',
      target: 'node14',
      format: 'cjs',
      outdir: path.join(distDir, 'cjs'),
      sourcemap: true,
      minify: false,
      keepNames: true,
      external: ['fs', 'path', 'http', 'https', 'url', 'querystring', 'crypto', 'zlib', 'stream', 'events', 'util', 'cluster', 'os']
    });

    // Build ES Modules version
    console.log('Building ES Modules version...');
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'index.js')],
      bundle: false,
      platform: 'node',
      target: 'node14',
      format: 'esm',
      outdir: path.join(distDir, 'esm'),
      sourcemap: true,
      minify: false,
      keepNames: true,
      external: ['fs', 'path', 'http', 'https', 'url', 'querystring', 'crypto', 'zlib', 'stream', 'events', 'util', 'cluster', 'os'],
      outExtension: { '.js': '.mjs' }
    });

    // Build minified bundle
    console.log('Building minified bundle...');
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'index.js')],
      bundle: true,
      platform: 'node',
      target: 'node14',
      format: 'cjs',
      outfile: path.join(distDir, 'spark.min.js'),
      sourcemap: true,
      minify: true,
      keepNames: false,
      external: ['fs', 'path', 'http', 'https', 'url', 'querystring', 'crypto', 'zlib', 'stream', 'events', 'util', 'cluster', 'os'],
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    // Copy individual files for CJS
    console.log('Copying source files...');
    await copySourceFiles(srcDir, path.join(distDir, 'cjs'));

    // Convert and copy for ESM
    console.log('Converting files for ESM...');
    await convertToESM(srcDir, path.join(distDir, 'esm'));

    // Copy type definitions
    const typesDir = path.join(rootDir, 'types');
    if (fs.existsSync(typesDir)) {
      console.log('Copying type definitions...');
      const distTypesDir = path.join(distDir, 'types');
      fs.mkdirSync(distTypesDir, { recursive: true });
      copyDir(typesDir, distTypesDir);
    }

    // Create package.json for each format
    await createPackageFiles();

    console.log('\n✅ Build completed successfully!');
    console.log(`📦 Output directory: ${distDir}`);
    console.log('📁 Available formats:');
    console.log('  - CommonJS: dist/cjs/');
    console.log('  - ES Modules: dist/esm/');
    console.log('  - Minified Bundle: dist/spark.min.js');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function copySourceFiles(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copySourceFiles(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function convertToESM(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name.replace(/\.js$/, '.mjs'));

    if (entry.isDirectory()) {
      await convertToESM(srcPath, path.join(dest, entry.name));
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Convert require() to import
      content = content.replace(/const\s+(\w+)\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g, 'import $1 from \'$2\';');
      content = content.replace(/const\s+\{([^}]+)\}\s+=\s+require\(['"`]([^'"`]+)['"`]\);?/g, 'import { $1 } from \'$2\';');
      
      // Convert module.exports to export
      content = content.replace(/module\.exports\s*=\s*(\w+);?/g, 'export default $1;');
      content = content.replace(/module\.exports\.(\w+)\s*=\s*([^;]+);?/g, 'export const $1 = $2;');
      
      // Update require paths to use .mjs extension for local files
      content = content.replace(/from\s+['"`](\.[^'"`]+)['"`]/g, (match, p1) => {
        if (!p1.includes('.')) {
          return `from '${p1}.mjs'`;
        }
        return match;
      });
      
      fs.writeFileSync(destPath, content);
    }
  }
}

async function createPackageFiles() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  
  // Main package.json with dual package support
  const mainPackage = {
    ...packageJson,
    main: './cjs/index.js',
    module: './esm/index.mjs',
    types: './types/index.d.ts',
    exports: {
      '.': {
        import: './esm/index.mjs',
        require: './cjs/index.js',
        types: './types/index.d.ts'
      },
      './package.json': './package.json'
    },
    scripts: {
      test: packageJson.scripts.test
    }
  };
  
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(mainPackage, null, 2)
  );

  // CJS package.json
  const cjsPackage = {
    type: 'commonjs'
  };
  
  fs.writeFileSync(
    path.join(distDir, 'cjs', 'package.json'),
    JSON.stringify(cjsPackage, null, 2)
  );

  // ESM package.json
  const esmPackage = {
    type: 'module'
  };
  
  fs.writeFileSync(
    path.join(distDir, 'esm', 'package.json'),
    JSON.stringify(esmPackage, null, 2)
  );
}

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

// Check if esbuild is available
try {
  require.resolve('esbuild');
  build();
} catch (error) {
  console.warn('⚠️  esbuild not found. Install it with: npm install -D esbuild');
  console.log('Falling back to basic build...');
  require('./build.js');
}