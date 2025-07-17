#!/usr/bin/env node

/**
 * Documentation builder for @oxog/spark
 * Generates comprehensive documentation from source code and markdown files
 */

const fs = require('fs');
const path = require('path');

class DocsBuilder {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'docs', 'generated');
    this.apiDocs = [];
    this.startTime = Date.now();
  }

  build() {
    console.log('📖 Building documentation for @oxog/spark\n');

    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });

    // Build different documentation sections
    this.buildAPIReference();
    this.buildMiddlewareGuide();
    this.buildExamplesIndex();
    this.buildFullDocumentation();
    
    console.log(`\n✅ Documentation built in ${Date.now() - this.startTime}ms`);
    console.log(`📁 Output directory: ${this.outputDir}`);
  }

  buildAPIReference() {
    console.log('Building API reference...');
    
    const srcDir = path.join(__dirname, '..', 'src');
    const apiRef = [];

    // Parse main exports
    const indexPath = path.join(srcDir, 'index.js');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Extract main classes
    this.parseClass(path.join(srcDir, 'core', 'application.js'), 'Spark', apiRef);
    this.parseClass(path.join(srcDir, 'core', 'router.js'), 'Router', apiRef);
    this.parseClass(path.join(srcDir, 'core', 'context.js'), 'Context', apiRef);
    this.parseClass(path.join(srcDir, 'core', 'request.js'), 'Request', apiRef);
    this.parseClass(path.join(srcDir, 'core', 'response.js'), 'Response', apiRef);

    // Generate API reference markdown
    let apiMarkdown = '# API Reference\n\n';
    apiMarkdown += 'Complete API documentation for @oxog/spark\n\n';
    apiMarkdown += '## Table of Contents\n\n';
    
    apiRef.forEach(cls => {
      apiMarkdown += `- [${cls.name}](#${cls.name.toLowerCase()})\n`;
    });
    
    apiMarkdown += '\n---\n\n';
    
    // Add detailed documentation for each class
    apiRef.forEach(cls => {
      apiMarkdown += `## ${cls.name}\n\n`;
      apiMarkdown += `${cls.description || 'No description available.'}\n\n`;
      
      if (cls.extends) {
        apiMarkdown += `**Extends:** ${cls.extends}\n\n`;
      }
      
      // Constructor
      if (cls.constructor) {
        apiMarkdown += '### Constructor\n\n';
        apiMarkdown += '```javascript\n';
        apiMarkdown += `new ${cls.name}(${cls.constructor.params || ''})\n`;
        apiMarkdown += '```\n\n';
        
        if (cls.constructor.description) {
          apiMarkdown += `${cls.constructor.description}\n\n`;
        }
      }
      
      // Methods
      if (cls.methods && cls.methods.length > 0) {
        apiMarkdown += '### Methods\n\n';
        
        cls.methods.forEach(method => {
          apiMarkdown += `#### ${method.name}\n\n`;
          apiMarkdown += '```javascript\n';
          apiMarkdown += `${method.signature}\n`;
          apiMarkdown += '```\n\n';
          
          if (method.description) {
            apiMarkdown += `${method.description}\n\n`;
          }
          
          if (method.params) {
            apiMarkdown += '**Parameters:**\n\n';
            method.params.forEach(param => {
              apiMarkdown += `- \`${param.name}\` (${param.type}) - ${param.description}\n`;
            });
            apiMarkdown += '\n';
          }
          
          if (method.returns) {
            apiMarkdown += `**Returns:** ${method.returns}\n\n`;
          }
          
          if (method.example) {
            apiMarkdown += '**Example:**\n\n';
            apiMarkdown += '```javascript\n';
            apiMarkdown += method.example;
            apiMarkdown += '\n```\n\n';
          }
        });
      }
      
      // Properties
      if (cls.properties && cls.properties.length > 0) {
        apiMarkdown += '### Properties\n\n';
        
        cls.properties.forEach(prop => {
          apiMarkdown += `- \`${prop.name}\` (${prop.type}) - ${prop.description}\n`;
        });
        apiMarkdown += '\n';
      }
      
      apiMarkdown += '---\n\n';
    });

    // Save API reference
    fs.writeFileSync(path.join(this.outputDir, 'api-reference.md'), apiMarkdown);
    this.apiDocs = apiRef;
  }

  parseClass(filePath, className, apiRef) {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const classInfo = {
      name: className,
      methods: [],
      properties: []
    };

    // Extract class description from comments
    const classCommentMatch = content.match(/\/\*\*[\s\S]*?\*\/\s*class\s+\w+/);
    if (classCommentMatch) {
      classInfo.description = this.parseJSDoc(classCommentMatch[0]);
    }

    // Parse methods
    const methodRegex = /\/\*\*[\s\S]*?\*\/\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g;
    let match;
    
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      if (methodName === 'constructor') continue;
      
      const methodInfo = {
        name: methodName,
        signature: match[0].split('{')[0].trim()
      };
      
      // Parse JSDoc comment
      const comment = match[0].split('*/')[0] + '*/';
      const jsdoc = this.parseJSDoc(comment);
      
      if (jsdoc) {
        methodInfo.description = jsdoc.description;
        methodInfo.params = jsdoc.params;
        methodInfo.returns = jsdoc.returns;
        methodInfo.example = jsdoc.example;
      }
      
      classInfo.methods.push(methodInfo);
    }

    apiRef.push(classInfo);
  }

  parseJSDoc(comment) {
    const result = {};
    
    // Extract description
    const descMatch = comment.match(/\/\*\*\s*\n\s*\*\s*([^@]+)/);
    if (descMatch) {
      result.description = descMatch[1].replace(/\s*\*\s*/g, ' ').trim();
    }
    
    // Extract params
    const paramMatches = comment.matchAll(/@param\s*{([^}]+)}\s*(\w+)\s*-?\s*(.+)/g);
    result.params = [];
    for (const match of paramMatches) {
      result.params.push({
        type: match[1],
        name: match[2],
        description: match[3].trim()
      });
    }
    
    // Extract returns
    const returnsMatch = comment.match(/@returns?\s*{([^}]+)}\s*(.+)/);
    if (returnsMatch) {
      result.returns = `${returnsMatch[1]} - ${returnsMatch[2].trim()}`;
    }
    
    // Extract example
    const exampleMatch = comment.match(/@example\s*\n([\s\S]+?)(?=\*\s*@|\*\/)/);
    if (exampleMatch) {
      result.example = exampleMatch[1].replace(/\s*\*\s*/g, '\n').trim();
    }
    
    return result;
  }

  buildMiddlewareGuide() {
    console.log('Building middleware guide...');
    
    const middlewareDir = path.join(__dirname, '..', 'src', 'middleware');
    const middlewares = fs.readdirSync(middlewareDir).filter(f => f.endsWith('.js'));
    
    let guide = '# Middleware Guide\n\n';
    guide += 'Built-in middleware for @oxog/spark\n\n';
    guide += '## Available Middleware\n\n';
    
    middlewares.forEach(file => {
      const name = file.replace('.js', '');
      const content = fs.readFileSync(path.join(middlewareDir, file), 'utf8');
      
      // Extract description from comments
      const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^@*]+)/);
      const description = descMatch ? descMatch[1].trim() : 'No description available.';
      
      guide += `### ${name}\n\n`;
      guide += `${description}\n\n`;
      
      // Add usage example
      guide += '**Usage:**\n\n';
      guide += '```javascript\n';
      guide += `const { middleware } = require('@oxog/spark');\n`;
      guide += `const ${name} = middleware.${name}();\n\n`;
      guide += `app.use(${name});\n`;
      guide += '```\n\n';
      
      // Extract options if available
      const optionsMatch = content.match(/@param\s*{Object}\s*options[\s\S]*?(?=@param|@returns|\*\/)/);
      if (optionsMatch) {
        guide += '**Options:**\n\n';
        const optionMatches = content.matchAll(/@param\s*{[^}]+}\s*options\.(\w+)\s*-?\s*(.+)/g);
        
        for (const match of optionMatches) {
          guide += `- \`${match[1]}\` - ${match[2].trim()}\n`;
        }
        guide += '\n';
      }
      
      guide += '---\n\n';
    });
    
    fs.writeFileSync(path.join(this.outputDir, 'middleware-guide.md'), guide);
  }

  buildExamplesIndex() {
    console.log('Building examples index...');
    
    const examplesDir = path.join(__dirname, '..', 'examples');
    if (!fs.existsSync(examplesDir)) return;
    
    const examples = fs.readdirSync(examplesDir).filter(d => 
      fs.statSync(path.join(examplesDir, d)).isDirectory()
    );
    
    let index = '# Examples\n\n';
    index += 'Example applications demonstrating @oxog/spark features\n\n';
    
    examples.forEach(example => {
      const examplePath = path.join(examplesDir, example);
      const readmePath = path.join(examplePath, 'README.md');
      
      index += `## ${example}\n\n`;
      
      if (fs.existsSync(readmePath)) {
        const readme = fs.readFileSync(readmePath, 'utf8');
        const firstLine = readme.split('\n').find(line => line.trim() && !line.startsWith('#'));
        index += `${firstLine || 'No description available.'}\n\n`;
      }
      
      index += `[View Example](../../examples/${example})\n\n`;
      
      // Show main file snippet
      const mainFile = path.join(examplePath, 'index.js');
      if (fs.existsSync(mainFile)) {
        const content = fs.readFileSync(mainFile, 'utf8');
        const snippet = content.split('\n').slice(0, 10).join('\n');
        
        index += '```javascript\n';
        index += snippet;
        index += '\n// ...\n';
        index += '```\n\n';
      }
      
      index += '---\n\n';
    });
    
    fs.writeFileSync(path.join(this.outputDir, 'examples.md'), index);
  }

  buildFullDocumentation() {
    console.log('Building full documentation...');
    
    // Create table of contents
    let toc = '# @oxog/spark Documentation\n\n';
    toc += '## Table of Contents\n\n';
    toc += '1. [Getting Started](../getting-started.md)\n';
    toc += '2. [API Reference](./api-reference.md)\n';
    toc += '3. [Middleware Guide](./middleware-guide.md)\n';
    toc += '4. [Examples](./examples.md)\n';
    toc += '5. [Security Best Practices](../security-best-practices.md)\n';
    toc += '6. [Performance Optimization](./performance.md)\n';
    toc += '7. [Deployment Guide](./deployment.md)\n';
    toc += '8. [Migration Guide](./migration.md)\n';
    
    fs.writeFileSync(path.join(this.outputDir, 'index.md'), toc);
    
    // Generate performance guide
    this.buildPerformanceGuide();
    
    // Generate deployment guide
    this.buildDeploymentGuide();
    
    // Generate migration guide
    this.buildMigrationGuide();
  }

  buildPerformanceGuide() {
    let guide = '# Performance Optimization Guide\n\n';
    guide += '## Best Practices\n\n';
    guide += '### 1. Use Clustering\n\n';
    guide += '```javascript\n';
    guide += 'const { Spark } = require(\'@oxog/spark\');\n';
    guide += 'const cluster = require(\'cluster\');\n';
    guide += 'const os = require(\'os\');\n\n';
    guide += 'if (cluster.isPrimary) {\n';
    guide += '  for (let i = 0; i < os.cpus().length; i++) {\n';
    guide += '    cluster.fork();\n';
    guide += '  }\n';
    guide += '} else {\n';
    guide += '  const app = new Spark();\n';
    guide += '  // ... your app\n';
    guide += '  app.listen(3000);\n';
    guide += '}\n';
    guide += '```\n\n';
    
    guide += '### 2. Enable Compression\n\n';
    guide += '```javascript\n';
    guide += 'app.use(middleware.compress());\n';
    guide += '```\n\n';
    
    guide += '### 3. Implement Caching\n\n';
    guide += '```javascript\n';
    guide += 'app.use(middleware.cache({ maxAge: 3600 }));\n';
    guide += '```\n\n';
    
    fs.writeFileSync(path.join(this.outputDir, 'performance.md'), guide);
  }

  buildDeploymentGuide() {
    let guide = '# Deployment Guide\n\n';
    guide += '## Production Checklist\n\n';
    guide += '- [ ] Set NODE_ENV=production\n';
    guide += '- [ ] Enable clustering\n';
    guide += '- [ ] Configure security headers\n';
    guide += '- [ ] Set up monitoring\n';
    guide += '- [ ] Configure logging\n';
    guide += '- [ ] Set up health checks\n\n';
    
    guide += '## Docker Deployment\n\n';
    guide += '```dockerfile\n';
    guide += 'FROM node:18-alpine\n';
    guide += 'WORKDIR /app\n';
    guide += 'COPY package*.json ./\n';
    guide += 'RUN npm ci --production\n';
    guide += 'COPY . .\n';
    guide += 'EXPOSE 3000\n';
    guide += 'CMD ["node", "server.js"]\n';
    guide += '```\n\n';
    
    fs.writeFileSync(path.join(this.outputDir, 'deployment.md'), guide);
  }

  buildMigrationGuide() {
    let guide = '# Migration Guide\n\n';
    guide += '## Migrating from Express\n\n';
    guide += '### Key Differences\n\n';
    guide += '1. **Zero Dependencies**: Spark has no external dependencies\n';
    guide += '2. **Built-in Middleware**: Common middleware is included\n';
    guide += '3. **Async/Await First**: Native async support\n\n';
    
    guide += '### Code Changes\n\n';
    guide += '**Express:**\n';
    guide += '```javascript\n';
    guide += 'const express = require(\'express\');\n';
    guide += 'const app = express();\n';
    guide += '```\n\n';
    
    guide += '**Spark:**\n';
    guide += '```javascript\n';
    guide += 'const { Spark } = require(\'@oxog/spark\');\n';
    guide += 'const app = new Spark();\n';
    guide += '```\n\n';
    
    fs.writeFileSync(path.join(this.outputDir, 'migration.md'), guide);
  }
}

// Run documentation builder
if (require.main === module) {
  const builder = new DocsBuilder();
  builder.build();
}

module.exports = DocsBuilder;