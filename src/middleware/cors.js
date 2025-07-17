const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];

function cors(options = {}) {
  const opts = {
    origin: options.origin !== undefined ? options.origin : false,  // Secure default: CORS disabled
    methods: options.methods || DEFAULT_METHODS,
    allowedHeaders: options.allowedHeaders || ['Content-Type', 'Authorization'],
    exposedHeaders: options.exposedHeaders || [],
    credentials: options.credentials || false,
    maxAge: options.maxAge || 86400,
    preflightContinue: options.preflightContinue || false,
    optionsSuccessStatus: options.optionsSuccessStatus || 204,
    ...options
  };

  return async (ctx, next) => {
    const origin = getOrigin(ctx, opts.origin);
    
    if (origin) {
      ctx.set('Access-Control-Allow-Origin', origin);
    }

    if (opts.credentials) {
      ctx.set('Access-Control-Allow-Credentials', 'true');
    }

    if (opts.exposedHeaders && opts.exposedHeaders.length > 0) {
      ctx.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
    }

    if (ctx.method === 'OPTIONS') {
      return handlePreflight(ctx, opts);
    }

    await next();
  };
}

function getOrigin(ctx, origin) {
  if (origin === false) {
    return null;  // CORS disabled
  }

  if (origin === '*') {
    return '*';
  }

  if (origin === true) {
    // Reflect the request origin
    return ctx.get('origin') || '*';
  }

  if (typeof origin === 'string') {
    return origin;
  }

  if (typeof origin === 'function') {
    return origin(ctx);
  }

  if (Array.isArray(origin)) {
    const requestOrigin = ctx.get('origin');
    return origin.includes(requestOrigin) ? requestOrigin : null;
  }

  return null;
}

function handlePreflight(ctx, opts) {
  ctx.set('Access-Control-Allow-Methods', opts.methods.join(', '));
  
  const requestedHeaders = ctx.get('Access-Control-Request-Headers');
  if (requestedHeaders) {
    const allowedHeaders = typeof opts.allowedHeaders === 'function' 
      ? opts.allowedHeaders(ctx) 
      : opts.allowedHeaders;
    
    if (allowedHeaders) {
      ctx.set('Access-Control-Allow-Headers', 
        Array.isArray(allowedHeaders) ? allowedHeaders.join(', ') : allowedHeaders);
    }
  }

  if (opts.maxAge) {
    ctx.set('Access-Control-Max-Age', opts.maxAge);
  }

  if (opts.preflightContinue) {
    return;
  }

  ctx.status(opts.optionsSuccessStatus).end();
}

module.exports = cors;