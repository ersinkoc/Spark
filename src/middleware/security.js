'use strict';

const crypto = require('crypto');

function security(options = {}) {
  const opts = {
    contentSecurityPolicy: options.contentSecurityPolicy !== false,
    crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy !== false,
    crossOriginOpenerPolicy: options.crossOriginOpenerPolicy !== false,
    crossOriginResourcePolicy: options.crossOriginResourcePolicy !== false,
    dnsPrefetchControl: options.dnsPrefetchControl !== false,
    frameguard: options.frameguard !== false,
    hidePoweredBy: options.hidePoweredBy !== false,
    hsts: options.hsts !== false,
    ieNoOpen: options.ieNoOpen !== false,
    noSniff: options.noSniff !== false,
    originAgentCluster: options.originAgentCluster !== false,
    permittedCrossDomainPolicies: options.permittedCrossDomainPolicies !== false,
    referrerPolicy: options.referrerPolicy !== false,
    xssFilter: options.xssFilter !== false,
    ...options
  };

  return async (ctx, next) => {
    if (opts.contentSecurityPolicy) {
      setContentSecurityPolicy(ctx, opts.contentSecurityPolicy);
    }

    if (opts.crossOriginEmbedderPolicy) {
      ctx.set('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    if (opts.crossOriginOpenerPolicy) {
      ctx.set('Cross-Origin-Opener-Policy', 'same-origin');
    }

    if (opts.crossOriginResourcePolicy) {
      ctx.set('Cross-Origin-Resource-Policy', 'same-origin');
    }

    if (opts.dnsPrefetchControl) {
      ctx.set('X-DNS-Prefetch-Control', 'off');
    }

    if (opts.frameguard) {
      setFrameguard(ctx, opts.frameguard);
    }

    if (opts.hidePoweredBy) {
      ctx.removeHeader('X-Powered-By');
    }

    if (opts.hsts) {
      setHSTS(ctx, opts.hsts);
    }

    if (opts.ieNoOpen) {
      ctx.set('X-Download-Options', 'noopen');
    }

    if (opts.noSniff) {
      ctx.set('X-Content-Type-Options', 'nosniff');
    }

    if (opts.originAgentCluster) {
      ctx.set('Origin-Agent-Cluster', '?1');
    }

    if (opts.permittedCrossDomainPolicies) {
      ctx.set('X-Permitted-Cross-Domain-Policies', 'none');
    }

    if (opts.referrerPolicy) {
      setReferrerPolicy(ctx, opts.referrerPolicy);
    }

    if (opts.xssFilter) {
      ctx.set('X-XSS-Protection', '1; mode=block');
    }

    await next();
  };
}

function setContentSecurityPolicy(ctx, options) {
  const defaultPolicy = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"]
  };

  const policy = typeof options === 'object' ? { ...defaultPolicy, ...options } : defaultPolicy;
  
  const policyString = Object.keys(policy)
    .map(key => `${key} ${policy[key].join(' ')}`)
    .join('; ');

  ctx.set('Content-Security-Policy', policyString);
}

function setFrameguard(ctx, options) {
  if (options === true) {
    ctx.set('X-Frame-Options', 'DENY');
  } else if (typeof options === 'string') {
    ctx.set('X-Frame-Options', options);
  } else if (typeof options === 'object') {
    if (options.action === 'allow-from') {
      // SECURITY FIX: Validate domain to prevent header injection
      if (!options.domain || typeof options.domain !== 'string') {
        throw new Error('Frameguard domain must be a valid string');
      }

      // Check for CRLF injection attempts
      if (options.domain.includes('\r') || options.domain.includes('\n')) {
        throw new Error('Invalid domain: CRLF characters not allowed');
      }

      // Validate domain format (basic check for valid hostname)
      const domainRegex = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)*$/i;
      if (!domainRegex.test(options.domain) && !options.domain.startsWith('http://') && !options.domain.startsWith('https://')) {
        throw new Error('Invalid domain format');
      }

      ctx.set('X-Frame-Options', `ALLOW-FROM ${options.domain}`);
    } else {
      ctx.set('X-Frame-Options', options.action || 'DENY');
    }
  }
}

function setHSTS(ctx, options) {
  const defaults = {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false
  };

  const opts = typeof options === 'object' ? { ...defaults, ...options } : defaults;
  
  let hstsHeader = `max-age=${opts.maxAge}`;
  
  if (opts.includeSubDomains) {
    hstsHeader += '; includeSubDomains';
  }
  
  if (opts.preload) {
    hstsHeader += '; preload';
  }

  ctx.set('Strict-Transport-Security', hstsHeader);
}

function setReferrerPolicy(ctx, options) {
  const policy = typeof options === 'string' ? options : 'no-referrer';
  ctx.set('Referrer-Policy', policy);
}

function csrf(options = {}) {
  const opts = {
    secret: options.secret || throwMissingCsrfSecretError(),
    cookie: options.cookie !== false,
    cookieName: options.cookieName || '_csrf',
    headerName: options.headerName || 'x-csrf-token',
    bodyName: options.bodyName || '_csrf',
    value: options.value,
    sessionKey: options.sessionKey || 'csrfSecret',
    ignoreMethods: options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
    ...options
  };

  return async (ctx, next) => {
    if (opts.ignoreMethods.includes(ctx.method)) {
      return next();
    }

    const secret = getSecret(ctx, opts);
    const token = getTokenFromRequest(ctx, opts);
    
    if (!token) {
      return ctx.status(403).json({ error: 'CSRF token missing' });
    }

    if (!verifyToken(token, secret)) {
      return ctx.status(403).json({ error: 'Invalid CSRF token' });
    }

    await next();
  };
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function generateToken(secret) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + secret).digest('hex');
  return salt + hash;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Token format: 16 char salt + 64 char hash = 80 chars total
  if (token.length !== 80) {
    return false;
  }

  const salt = token.slice(0, 16);
  const hash = token.slice(16);
  const expected = crypto.createHash('sha256').update(salt + secret).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

function getSecret(ctx, opts) {
  if (ctx.session && ctx.session[opts.sessionKey]) {
    return ctx.session[opts.sessionKey];
  }

  const secret = opts.secret || generateSecret();
  
  if (ctx.session) {
    ctx.session[opts.sessionKey] = secret;
  }

  return secret;
}

function getTokenFromRequest(ctx, opts) {
  return ctx.get(opts.headerName) || 
         (ctx.body && ctx.body[opts.bodyName]) || 
         (ctx.cookies && ctx.cookies[opts.cookieName]);
}

function csrfToken(ctx, options = {}) {
  const opts = {
    secret: options.secret || generateSecret(),
    sessionKey: options.sessionKey || 'csrfSecret',
    ...options
  };

  const secret = getSecret(ctx, opts);
  return generateToken(secret);
}

function xssProtection(options = {}) {
  const opts = {
    escapeHtml: options.escapeHtml !== false,
    escapeJson: options.escapeJson !== false,
    ...options
  };

  return async (ctx, next) => {
    if (opts.escapeHtml) {
      const originalHtml = ctx.html;
      ctx.html = function(data) {
        return originalHtml.call(this, escapeHtml(data));
      };
    }

    if (opts.escapeJson) {
      const originalJson = ctx.json;
      ctx.json = function(data) {
        return originalJson.call(this, escapeJsonValues(data));
      };
    }

    await next();
  };
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(text).replace(/[&<>"']/g, (s) => map[s]);
}

function escapeJsonValues(obj) {
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(escapeJsonValues);
  }

  if (obj && typeof obj === 'object') {
    const escaped = {};
    for (const [key, value] of Object.entries(obj)) {
      escaped[key] = escapeJsonValues(value);
    }
    return escaped;
  }

  return obj;
}

function requestSizeLimit(options = {}) {
  const opts = {
    limit: options.limit || 1024 * 1024, // 1MB
    message: options.message || 'Request too large',
    statusCode: options.statusCode || 413,
    ...options
  };

  return async (ctx, next) => {
    const contentLength = parseInt(ctx.get('content-length') || '0');
    
    if (contentLength > opts.limit) {
      return ctx.status(opts.statusCode).json({
        error: 'Request Too Large',
        message: opts.message
      });
    }

    await next();
  };
}

function throwMissingCsrfSecretError() {
  throw new Error(
    'CSRF secret is required for security. ' +
    'Please provide a secret in the csrf options: ' +
    'csrf({ secret: "your-secret-here" })'
  );
}

module.exports = security;
module.exports.csrf = csrf;
module.exports.csrfToken = csrfToken;
module.exports.xssProtection = xssProtection;
module.exports.requestSizeLimit = requestSizeLimit;