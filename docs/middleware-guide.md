# Middleware Guide

This guide explains how to use and create middleware in the Spark Framework.

## Built-in Middleware

### Body Parser
Parses incoming request bodies in various formats.

```javascript
const { bodyParser } = require('@oxog/spark');

app.use(bodyParser({
  limit: '10mb',
  type: 'json' // or 'urlencoded', 'text', 'raw'
}));
```

### CORS
Enables Cross-Origin Resource Sharing.

```javascript
const { cors } = require('@oxog/spark');

app.use(cors({
  origin: 'https://example.com',
  credentials: true
}));
```

### Rate Limiting
Protects against abuse by limiting requests.

```javascript
const { rateLimit } = require('@oxog/spark');

app.use(rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000 // 15 minutes
}));
```

## Creating Custom Middleware

Middleware functions have access to the context object and a next function.

```javascript
async function myMiddleware(ctx, next) {
  // Do something before
  console.log('Request:', ctx.method, ctx.path);
  
  await next(); // Call next middleware
  
  // Do something after
  console.log('Response:', ctx.statusCode);
}

app.use(myMiddleware);
```
