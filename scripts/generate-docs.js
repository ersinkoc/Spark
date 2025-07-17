#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const docsDir = path.join(rootDir, 'docs');
const apiDocPath = path.join(docsDir, 'api-reference.md');

console.log('📚 Generating API documentation...\n');

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Start building the API reference
let apiDoc = '# API Reference\n\n';
apiDoc += 'This document provides a comprehensive reference for the Spark Framework.\n\n';
apiDoc += '## Table of Contents\n\n';

const sections = [];

// Process core modules
console.log('Processing core modules...');
const coreModules = processDirectory(path.join(srcDir, 'core'), 'Core');
sections.push(coreModules);

// Process middleware
console.log('Processing middleware...');
const middlewareModules = processDirectory(path.join(srcDir, 'middleware'), 'Middleware');
sections.push(middlewareModules);

// Process router
console.log('Processing router...');
const routerModules = processDirectory(path.join(srcDir, 'router'), 'Router');
sections.push(routerModules);

// Process utilities
console.log('Processing utilities...');
const utilModules = processDirectory(path.join(srcDir, 'utils'), 'Utilities');
sections.push(utilModules);

// Build table of contents
sections.forEach(section => {
  if (section.modules.length > 0) {
    apiDoc += `- [${section.name}](#${section.name.toLowerCase().replace(/\s+/g, '-')})\n`;
    section.modules.forEach(module => {
      apiDoc += `  - [${module.name}](#${module.name.toLowerCase().replace(/\s+/g, '-')})\n`;
    });
  }
});

apiDoc += '\n---\n\n';

// Add detailed documentation for each section
sections.forEach(section => {
  if (section.modules.length > 0) {
    apiDoc += `## ${section.name}\n\n`;
    
    section.modules.forEach(module => {
      apiDoc += `### ${module.name}\n\n`;
      apiDoc += `**File:** \`${module.file}\`\n\n`;
      
      if (module.exports.length > 0) {
        apiDoc += '**Exports:**\n\n';
        module.exports.forEach(exp => {
          apiDoc += `- \`${exp.name}\`${exp.type ? ` (${exp.type})` : ''}\n`;
        });
        apiDoc += '\n';
      }
      
      if (module.functions.length > 0) {
        apiDoc += '**Functions:**\n\n';
        module.functions.forEach(func => {
          apiDoc += `#### \`${func}\`\n\n`;
          apiDoc += 'Description pending...\n\n';
        });
      }
      
      apiDoc += '---\n\n';
    });
  }
});

// Write the API documentation
fs.writeFileSync(apiDocPath, apiDoc);
console.log(`✅ Generated: ${path.relative(rootDir, apiDocPath)}`);

// Generate other documentation files
generateMiddlewareGuide();
generateSecurityGuide();
generateDeploymentGuide();

console.log('\n✅ Documentation generation complete!');

function processDirectory(dirPath, sectionName) {
  const modules = [];
  
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const moduleName = path.basename(file, '.js');
        
        const moduleInfo = {
          name: moduleName.charAt(0).toUpperCase() + moduleName.slice(1),
          file: path.relative(rootDir, filePath),
          exports: extractExports(content),
          functions: extractFunctions(content)
        };
        
        modules.push(moduleInfo);
      }
    });
  }
  
  return { name: sectionName, modules };
}

function extractExports(content) {
  const exports = [];
  const exportRegex = /module\.exports\.(\w+)\s*=\s*(\w+)/g;
  const defaultExportRegex = /module\.exports\s*=\s*(\w+)/;
  
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }
  
  match = defaultExportRegex.exec(content);
  if (match && exports.length === 0) {
    exports.push({ name: match[1], type: 'default' });
  }
  
  return exports;
}

function extractFunctions(content) {
  const functions = [];
  const functionRegex = /function\s+(\w+)\s*\([^)]*\)/g;
  const arrowFunctionRegex = /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  
  while ((match = arrowFunctionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  
  return functions;
}

function generateMiddlewareGuide() {
  const guidePath = path.join(docsDir, 'middleware-guide.md');
  const content = `# Middleware Guide

This guide explains how to use and create middleware in the Spark Framework.

## Built-in Middleware

### Body Parser
Parses incoming request bodies in various formats.

\`\`\`javascript
const { bodyParser } = require('@oxog/spark');

app.use(bodyParser({
  limit: '10mb',
  type: 'json' // or 'urlencoded', 'text', 'raw'
}));
\`\`\`

### CORS
Enables Cross-Origin Resource Sharing.

\`\`\`javascript
const { cors } = require('@oxog/spark');

app.use(cors({
  origin: 'https://example.com',
  credentials: true
}));
\`\`\`

### Rate Limiting
Protects against abuse by limiting requests.

\`\`\`javascript
const { rateLimit } = require('@oxog/spark');

app.use(rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000 // 15 minutes
}));
\`\`\`

## Creating Custom Middleware

Middleware functions have access to the context object and a next function.

\`\`\`javascript
async function myMiddleware(ctx, next) {
  // Do something before
  console.log('Request:', ctx.method, ctx.path);
  
  await next(); // Call next middleware
  
  // Do something after
  console.log('Response:', ctx.statusCode);
}

app.use(myMiddleware);
\`\`\`
`;
  
  fs.writeFileSync(guidePath, content);
  console.log(`✅ Generated: ${path.relative(rootDir, guidePath)}`);
}

function generateSecurityGuide() {
  const guidePath = path.join(docsDir, 'security-best-practices.md');
  const content = `# Security Best Practices

This guide covers security best practices when using the Spark Framework.

## Default Security Settings

The framework comes with secure defaults:

- CORS is disabled by default
- CSRF protection is enabled
- Session secrets must be provided
- Rate limiting is configured
- Security headers are set

## Essential Security Measures

### 1. Always Use HTTPS
\`\`\`javascript
// Redirect HTTP to HTTPS
app.use(async (ctx, next) => {
  if (!ctx.secure() && process.env.NODE_ENV === 'production') {
    return ctx.redirect(\`https://\${ctx.host()}\${ctx.originalUrl}\`);
  }
  await next();
});
\`\`\`

### 2. Set Strong Session Secrets
\`\`\`javascript
app.use(session({
  secret: process.env.SESSION_SECRET, // Use environment variable
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    sameSite: 'strict'
  }
}));
\`\`\`

### 3. Validate All Input
\`\`\`javascript
app.post('/api/users', async (ctx) => {
  const { email, password } = ctx.body;
  
  // Validate email format
  if (!isValidEmail(email)) {
    return ctx.status(400).json({ error: 'Invalid email' });
  }
  
  // Validate password strength
  if (password.length < 8) {
    return ctx.status(400).json({ error: 'Password too short' });
  }
});
\`\`\`

### 4. Enable Security Headers
\`\`\`javascript
app.use(security({
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"]
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
\`\`\`

### 5. Implement Rate Limiting
\`\`\`javascript
// Different limits for different endpoints
const strictLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const normalLimit = rateLimit({ max: 100, windowMs: 15 * 60 * 1000 });

app.use('/api/auth', strictLimit);
app.use('/api', normalLimit);
\`\`\`

## Environment Variables

Never hardcode sensitive information:

\`\`\`javascript
// .env file
SESSION_SECRET=your-secret-here
DATABASE_URL=postgresql://...
API_KEY=your-api-key

// Usage
require('dotenv').config();

const app = new App({
  port: process.env.PORT || 3000
});
\`\`\`
`;
  
  fs.writeFileSync(guidePath, content);
  console.log(`✅ Generated: ${path.relative(rootDir, guidePath)}`);
}

function generateDeploymentGuide() {
  const guidePath = path.join(docsDir, 'deployment.md');
  const content = `# Deployment Guide

This guide covers how to deploy Spark Framework applications.

## Prerequisites

- Node.js 14.x or higher
- SSL certificate for HTTPS
- Process manager (PM2 recommended)

## Basic Deployment

### 1. Prepare Your Application

\`\`\`bash
# Install dependencies (if any)
npm install

# Build the application
npm run build

# Run tests
npm test
\`\`\`

### 2. Environment Configuration

Create a \`.env\` file for production:

\`\`\`env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=your-production-secret
\`\`\`

### 3. Process Management with PM2

\`\`\`bash
# Install PM2 globally
npm install -g pm2

# Start your application
pm2 start dist/index.js --name "my-api"

# Configure auto-restart
pm2 startup
pm2 save
\`\`\`

## Deployment Platforms

### Heroku

\`\`\`json
// package.json
{
  "scripts": {
    "start": "node dist/index.js"
  },
  "engines": {
    "node": "14.x"
  }
}
\`\`\`

### Docker

\`\`\`dockerfile
FROM node:14-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
\`\`\`

### AWS/Google Cloud/Azure

Use their respective Node.js deployment guides with the built application.

## Production Checklist

- [ ] Enable HTTPS
- [ ] Set secure session secrets
- [ ] Configure environment variables
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure logging
- [ ] Enable CORS appropriately
- [ ] Set security headers
- [ ] Configure load balancing
- [ ] Set up backup strategy
`;
  
  fs.writeFileSync(guidePath, content);
  console.log(`✅ Generated: ${path.relative(rootDir, guidePath)}`);
}