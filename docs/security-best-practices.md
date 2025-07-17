# Security Best Practices

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
```javascript
// Redirect HTTP to HTTPS
app.use(async (ctx, next) => {
  if (!ctx.secure() && process.env.NODE_ENV === 'production') {
    return ctx.redirect(`https://${ctx.host()}${ctx.originalUrl}`);
  }
  await next();
});
```

### 2. Set Strong Session Secrets
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET, // Use environment variable
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    sameSite: 'strict'
  }
}));
```

### 3. Validate All Input
```javascript
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
```

### 4. Enable Security Headers
```javascript
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
```

### 5. Implement Rate Limiting
```javascript
// Different limits for different endpoints
const strictLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const normalLimit = rateLimit({ max: 100, windowMs: 15 * 60 * 1000 });

app.use('/api/auth', strictLimit);
app.use('/api', normalLimit);
```

## Environment Variables

Never hardcode sensitive information:

```javascript
// .env file
SESSION_SECRET=your-secret-here
DATABASE_URL=postgresql://...
API_KEY=your-api-key

// Usage
require('dotenv').config();

const app = new App({
  port: process.env.PORT || 3000
});
```
