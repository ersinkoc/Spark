'use strict';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MESSAGE = 'Too many requests, please try again later.';

class MemoryStore {
  constructor() {
    this.store = new Map();
    this.resetTimes = new Map();
  }

  async incr(key, windowMs) {
    const now = Date.now();
    const resetTime = this.resetTimes.get(key) || now;
    
    if (now > resetTime) {
      this.store.set(key, 1);
      this.resetTimes.set(key, now + windowMs);
      return { totalHits: 1, resetTime: now + windowMs };
    }
    
    const current = this.store.get(key) || 0;
    const newCount = current + 1;
    this.store.set(key, newCount);
    
    return { totalHits: newCount, resetTime };
  }

  async decrement(key) {
    const current = this.store.get(key) || 0;
    if (current > 0) {
      this.store.set(key, current - 1);
    }
  }

  async reset(key) {
    this.store.delete(key);
    this.resetTimes.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, resetTime] of this.resetTimes) {
      if (now > resetTime) {
        this.store.delete(key);
        this.resetTimes.delete(key);
      }
    }
  }
}

function rateLimit(options = {}) {
  const opts = {
    windowMs: options.windowMs || DEFAULT_WINDOW_MS,
    max: options.max || DEFAULT_MAX_REQUESTS,
    message: options.message || DEFAULT_MESSAGE,
    statusCode: options.statusCode || 429,
    headers: options.headers !== false,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    handler: options.handler || defaultHandler,
    onLimitReached: options.onLimitReached,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    store: options.store || new MemoryStore(),
    ...options
  };

  // Start cleanup interval
  let cleanupInterval;
  if (opts.store.cleanup) {
    // Use smaller interval for cleanup (1/4 of window)
    const cleanupPeriod = Math.max(60000, Math.floor(opts.windowMs / 4));
    cleanupInterval = setInterval(() => {
      opts.store.cleanup();
    }, cleanupPeriod);
    
    // Allow cleanup interval to be stopped when server shuts down
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  const middleware = async (ctx, next) => {
    const key = opts.keyGenerator(ctx);
    const { totalHits, resetTime } = await opts.store.incr(key, opts.windowMs);

    if (opts.headers) {
      ctx.set('X-RateLimit-Limit', opts.max);
      ctx.set('X-RateLimit-Remaining', Math.max(0, opts.max - totalHits));
      ctx.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
    }

    if (totalHits <= opts.max) {
      await next();
      
      if (opts.skipSuccessfulRequests && ctx.statusCode >= 200 && ctx.statusCode < 300) {
        await opts.store.decrement(key);
      }
    } else {
      if (opts.onLimitReached) {
        opts.onLimitReached(ctx, opts);
      }
      
      return opts.handler(ctx, opts);
    }

    if (opts.skipFailedRequests && ctx.statusCode >= 400) {
      await opts.store.decrement(key);
    }
  };
  
  // Attach cleanup method to middleware for manual cleanup
  middleware.cleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    if (opts.store.cleanup) {
      opts.store.cleanup();
    }
  };
  
  // Attach store for external access if needed
  middleware.store = opts.store;
  
  return middleware;
}

function defaultKeyGenerator(ctx) {
  return ctx.ip();
}

function defaultHandler(ctx, opts) {
  ctx.set('Retry-After', Math.round(opts.windowMs / 1000));
  ctx.status(opts.statusCode).json({
    error: 'Too Many Requests',
    message: opts.message
  });
}

function slowDown(options = {}) {
  const opts = {
    windowMs: options.windowMs || DEFAULT_WINDOW_MS,
    delayAfter: options.delayAfter || 1,
    delayMs: options.delayMs || 1000,
    maxDelayMs: options.maxDelayMs || 60000,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    store: options.store || new MemoryStore(),
    ...options
  };

  // Start cleanup interval for slowDown store
  let cleanupInterval;
  if (opts.store.cleanup) {
    const cleanupPeriod = Math.max(60000, Math.floor(opts.windowMs / 4));
    cleanupInterval = setInterval(() => {
      opts.store.cleanup();
    }, cleanupPeriod);
    
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  const middleware = async (ctx, next) => {
    const key = opts.keyGenerator(ctx);
    const { totalHits } = await opts.store.incr(key, opts.windowMs);

    if (totalHits > opts.delayAfter) {
      const delay = Math.min(
        (totalHits - opts.delayAfter) * opts.delayMs,
        opts.maxDelayMs
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await next();

    if (opts.skipSuccessfulRequests && ctx.statusCode >= 200 && ctx.statusCode < 300) {
      await opts.store.decrement(key);
    }

    if (opts.skipFailedRequests && ctx.statusCode >= 400) {
      await opts.store.decrement(key);
    }
  };
  
  // Attach cleanup method
  middleware.cleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    if (opts.store.cleanup) {
      opts.store.cleanup();
    }
  };
  
  middleware.store = opts.store;
  
  return middleware;
}

class TokenBucket {
  constructor(capacity, refillRate, refillPeriod = 1000) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.refillPeriod = refillPeriod;
    this.lastRefill = Date.now();
  }

  consume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.refillPeriod * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

function tokenBucket(options = {}) {
  const opts = {
    capacity: options.capacity || 10,
    refillRate: options.refillRate || 1,
    refillPeriod: options.refillPeriod || 1000,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    message: options.message || DEFAULT_MESSAGE,
    statusCode: options.statusCode || 429,
    cleanupPeriod: options.cleanupPeriod || 300000, // 5 minutes
    maxBuckets: options.maxBuckets || 10000, // Maximum number of buckets to prevent memory leak
    ...options
  };

  const buckets = new Map();
  const lastActivity = new Map();
  
  // Cleanup old buckets
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, timestamp] of lastActivity) {
      if (now - timestamp > opts.cleanupPeriod) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      buckets.delete(key);
      lastActivity.delete(key);
    }
  }, Math.max(60000, opts.cleanupPeriod / 4));
  
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware = async (ctx, next) => {
    const key = opts.keyGenerator(ctx);
    
    // Prevent unlimited growth
    if (!buckets.has(key) && buckets.size >= opts.maxBuckets) {
      // Remove oldest bucket
      const oldestKey = lastActivity.entries().next().value?.[0];
      if (oldestKey) {
        buckets.delete(oldestKey);
        lastActivity.delete(oldestKey);
      }
    }
    
    if (!buckets.has(key)) {
      buckets.set(key, new TokenBucket(opts.capacity, opts.refillRate, opts.refillPeriod));
    }

    const bucket = buckets.get(key);
    lastActivity.set(key, Date.now());
    
    if (bucket.consume()) {
      await next();
    } else {
      ctx.status(opts.statusCode).json({
        error: 'Too Many Requests',
        message: opts.message
      });
    }
  };
  
  // Attach cleanup method
  middleware.cleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    buckets.clear();
    lastActivity.clear();
  };
  
  return middleware;
}

module.exports = rateLimit;
module.exports.slowDown = slowDown;
module.exports.tokenBucket = tokenBucket;
module.exports.MemoryStore = MemoryStore;