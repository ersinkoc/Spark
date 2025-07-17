# Installation and Setup

This guide will help you install Spark and set up your development environment.

## Prerequisites

Before installing Spark, make sure you have:

### Node.js
Spark requires Node.js version 14 or higher.

**Check your Node.js version:**
```bash
node --version
```

**Install Node.js if needed:**
- Download from [nodejs.org](https://nodejs.org/)
- Choose the LTS (Long Term Support) version
- Follow the installation instructions for your operating system

### npm
npm comes with Node.js, but make sure it's up to date:

```bash
npm --version
npm install -g npm@latest
```

## Installing Spark

### Option 1: Create a New Project
```bash
# Create a new directory for your project
mkdir my-spark-app
cd my-spark-app

# Initialize a new npm project
npm init -y

# Install Spark
npm install @oxog/spark
```

### Option 2: Add to Existing Project
```bash
# Navigate to your existing project
cd my-existing-project

# Install Spark
npm install @oxog/spark
```

## Verify Installation

Create a simple test file to verify Spark is working:

**test.js:**
```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

app.get('/', (ctx) => {
  ctx.json({ message: 'Spark is working!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**Run the test:**
```bash
node test.js
```

**Visit:** `http://localhost:3000`

You should see: `{"message":"Spark is working!"}`

## Development Environment Setup

### Recommended Tools

#### 1. **VS Code Extensions**
- **JavaScript (ES6) code snippets**
- **Prettier** - Code formatter
- **ESLint** - Code linting
- **REST Client** - Test your APIs

#### 2. **Package.json Scripts**
Add these useful scripts to your `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node test.js"
  }
}
```

#### 3. **Nodemon (Optional)**
For automatic server restarts during development:

```bash
npm install -g nodemon
```

Then run:
```bash
nodemon server.js
```

## Project Structure

Here's a recommended project structure:

```
my-spark-app/
├── src/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── products.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── utils/
│   │   └── helpers.js
│   └── server.js
├── tests/
│   └── api.test.js
├── public/
│   └── index.html
├── package.json
└── README.md
```

## Environment Variables

Create a `.env` file for configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security
SESSION_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:3000

# Database (if using one)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
```

**Note:** Always add `.env` to your `.gitignore` file!

## Common Issues and Solutions

### Issue: "Cannot find module '@oxog/spark'"
**Solution:** Make sure you're in the correct directory and Spark is installed:
```bash
npm list @oxog/spark
npm install @oxog/spark
```

### Issue: "Port already in use"
**Solution:** Either stop the process using the port or use a different port:
```bash
# Find and kill the process (Linux/Mac)
lsof -ti:3000 | xargs kill

# Or use a different port
app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
```

### Issue: "Permission denied"
**Solution:** Don't use `sudo` with npm. Fix npm permissions:
```bash
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## Testing Your Setup

Create a more comprehensive test to ensure everything works:

**setup-test.js:**
```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

// Test different routes
app.get('/', (ctx) => {
  ctx.json({ message: 'Welcome to Spark!' });
});

app.get('/health', (ctx) => {
  ctx.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/test/:id', (ctx) => {
  ctx.json({ 
    id: ctx.params.id,
    query: ctx.query
  });
});

app.post('/echo', (ctx) => {
  ctx.json({ 
    received: ctx.body,
    headers: ctx.headers
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Spark server running on port ${port}`);
  console.log(`📱 Test endpoints:
  - GET  http://localhost:${port}/
  - GET  http://localhost:${port}/health
  - GET  http://localhost:${port}/test/123?name=spark
  - POST http://localhost:${port}/echo`);
});
```

## What's Next?

Now that you have Spark installed and working, let's build your first real application!

👉 **Next Guide:** [Your First Application](03-first-application.md)

## Quick Reference

### Installation Commands
```bash
# Install Spark
npm install @oxog/spark

# Install development tools
npm install -g nodemon

# Create package.json
npm init -y
```

### Basic Server Template
```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Useful Scripts
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node test.js"
  }
}
```

Happy coding! 🎉