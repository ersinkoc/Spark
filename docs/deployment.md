# Deployment Guide

This guide covers how to deploy Spark Framework applications.

## Prerequisites

- Node.js 14.x or higher
- SSL certificate for HTTPS
- Process manager (PM2 recommended)

## Basic Deployment

### 1. Prepare Your Application

```bash
# Install dependencies (if any)
npm install

# Build the application
npm run build

# Run tests
npm test
```

### 2. Environment Configuration

Create a `.env` file for production:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=your-production-secret
```

### 3. Process Management with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start your application
pm2 start dist/index.js --name "my-api"

# Configure auto-restart
pm2 startup
pm2 save
```

## Deployment Platforms

### Heroku

```json
// package.json
{
  "scripts": {
    "start": "node dist/index.js"
  },
  "engines": {
    "node": "14.x"
  }
}
```

### Docker

```dockerfile
FROM node:14-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

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
