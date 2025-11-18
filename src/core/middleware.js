'use strict';

const crypto = require('crypto');
const bodyParser = require('../middleware/body-parser');
const cors = require('../middleware/cors');
const compression = require('../middleware/compression');
const staticFiles = require('../middleware/static');
const session = require('../middleware/session');
const rateLimit = require('../middleware/rate-limit');
const security = require('../middleware/security');
const logger = require('../middleware/logger');

function createMiddleware(app) {
  return {
    bodyParser: (options) => bodyParser(options),
    cors: (options) => cors(options),
    compression: (options) => compression(options),
    static: (root, options) => staticFiles(root, options),
    session: (options) => session(options),
    rateLimit: (options) => rateLimit(options),
    security: (options) => security(options),
    logger: (options) => logger(options),
    
    helmet: (options) => security(options),
    
    json: (options) => bodyParser({ ...options, type: 'json' }),
    urlencoded: (options) => bodyParser({ ...options, type: 'urlencoded' }),
    raw: (options) => bodyParser({ ...options, type: 'raw' }),
    text: (options) => bodyParser({ ...options, type: 'text' }),
    
    gzip: (options) => compression({ ...options, algorithm: 'gzip' }),
    deflate: (options) => compression({ ...options, algorithm: 'deflate' }),
    brotli: (options) => compression({ ...options, algorithm: 'br' }),
    
    basicAuth: (options) => {
      return async (ctx, next) => {
        const auth = ctx.get('authorization');
        if (!auth || !auth.startsWith('Basic ')) {
          ctx.set('WWW-Authenticate', 'Basic realm="Secure Area"');
          ctx.status(401).json({ error: 'Unauthorized' });
          return;
        }
        
        const credentials = Buffer.from(auth.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');

        // SECURITY: Use timing-safe comparison to prevent timing attacks
        let authenticated = false;

        if (options.users && options.users[username]) {
          const expectedPassword = options.users[username];
          try {
            // Pad passwords to same length for timing-safe comparison
            const maxLen = Math.max(password.length, expectedPassword.length);
            const passwordBuf = Buffer.from(password.padEnd(maxLen, '\0'));
            const expectedBuf = Buffer.from(expectedPassword.padEnd(maxLen, '\0'));

            authenticated = crypto.timingSafeEqual(passwordBuf, expectedBuf) &&
                          password.length === expectedPassword.length;
          } catch (err) {
            // Length mismatch or other error - not authenticated
            authenticated = false;
          }
        }

        if (authenticated) {
          ctx.user = { username };
          await next();
        } else if (options.verify && await options.verify(username, password)) {
          ctx.user = { username };
          await next();
        } else {
          ctx.set('WWW-Authenticate', 'Basic realm="Secure Area"');
          ctx.status(401).json({ error: 'Unauthorized' });
        }
      };
    },
    
    timeout: (ms) => {
      return async (ctx, next) => {
        const timeout = setTimeout(() => {
          if (!ctx.responded) {
            ctx.status(408).json({ error: 'Request Timeout' });
          }
        }, ms);
        
        try {
          await next();
        } finally {
          clearTimeout(timeout);
        }
      };
    },
    
    errorHandler: (handler) => {
      return async (ctx, next) => {
        try {
          await next();
        } catch (error) {
          if (handler) {
            await handler(error, ctx);
          } else {
            ctx.status(500).json({ 
              error: 'Internal Server Error',
              message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
          }
        }
      };
    },
    
    conditional: (condition, middleware) => {
      return async (ctx, next) => {
        if (typeof condition === 'function' ? condition(ctx) : condition) {
          await middleware(ctx, next);
        } else {
          await next();
        }
      };
    },
    
    compose: (...middlewares) => {
      return async (ctx, next) => {
        let index = 0;
        
        const dispatch = async (i) => {
          if (i >= middlewares.length) {
            return next();
          }
          
          const middleware = middlewares[i];
          return middleware(ctx, () => dispatch(i + 1));
        };
        
        return dispatch(0);
      };
    },
    
    unless: (condition, middleware) => {
      return async (ctx, next) => {
        if (typeof condition === 'function' ? !condition(ctx) : !condition) {
          await middleware(ctx, next);
        } else {
          await next();
        }
      };
    },
    
    skipIf: (condition) => {
      return async (ctx, next) => {
        if (typeof condition === 'function' ? condition(ctx) : condition) {
          await next();
        }
      };
    },
    
    cache: (options = {}) => {
      const { maxAge = 3600, private: isPrivate = false } = options;
      
      return async (ctx, next) => {
        await next();
        
        if (ctx.method === 'GET' && ctx.statusCode === 200) {
          const cacheControl = isPrivate ? 'private' : 'public';
          ctx.set('Cache-Control', `${cacheControl}, max-age=${maxAge}`);
        }
      };
    },
    
    etag: (options = {}) => {
      const crypto = require('crypto');

      return async (ctx, next) => {
        // BUG FIX: Intercept response body to generate ETag
        // The previous implementation used ctx.res._getData() which doesn't exist
        // on real Node.js response objects (only in mock objects)

        let responseBody = null;
        const originalSend = ctx.send;
        const originalJson = ctx.json;

        // Intercept send() to capture body
        ctx.send = function(data) {
          responseBody = data;
          return originalSend.call(this, data);
        };

        // Intercept json() to capture body
        ctx.json = function(data) {
          responseBody = JSON.stringify(data);
          return originalJson.call(this, data);
        };

        await next();

        // Generate ETag if we captured a body
        if (ctx.method === 'GET' && ctx.statusCode === 200 && responseBody) {
          const bodyStr = typeof responseBody === 'string' ? responseBody : String(responseBody);
          // SECURITY: Use SHA-256 instead of MD5 for cryptographic strength
          const etag = crypto.createHash('sha256').update(bodyStr).digest('hex').substring(0, 32);

          ctx.set('ETag', `"${etag}"`);

          // Check if client's ETag matches (conditional GET)
          if (ctx.get('if-none-match') === `"${etag}"`) {
            ctx.status(304).end();
          }
        }
      };
    },
    
    favicon: (path) => {
      // BUG FIX: Use async file reading to avoid blocking event loop
      const fs = require('fs').promises;
      let favicon = null;
      let loading = null;

      // Start loading favicon asynchronously
      loading = fs.readFile(path).then(data => {
        favicon = data;
        loading = null;
      }).catch(err => {
        console.error('Failed to load favicon:', err.message);
        loading = null;
      });

      return async (ctx, next) => {
        if (ctx.path === '/favicon.ico') {
          // Wait for favicon to load if still loading
          if (loading) {
            await loading;
          }

          if (favicon) {
            ctx.set('Content-Type', 'image/x-icon');
            ctx.set('Cache-Control', 'public, max-age=86400');
            ctx.send(favicon);
          } else {
            ctx.status(404).send('Favicon not found');
          }
        } else {
          await next();
        }
      };
    },
    
    responseTime: () => {
      return async (ctx, next) => {
        const start = Date.now();
        await next();
        const duration = Date.now() - start;
        ctx.set('X-Response-Time', `${duration}ms`);
      };
    },
    
    requestId: () => {
      const crypto = require('crypto');
      
      return async (ctx, next) => {
        const id = crypto.randomBytes(16).toString('hex');
        ctx.requestId = id;
        ctx.set('X-Request-ID', id);
        await next();
      };
    },
    
    healthCheck: (path = '/health') => {
      return async (ctx, next) => {
        if (ctx.path === path) {
          ctx.json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          });
        } else {
          await next();
        }
      };
    }
  };
}

module.exports = { createMiddleware };