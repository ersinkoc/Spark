'use strict';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MESSAGE = 'Too many requests, please try again later.';

class MemoryStore {
  constructor(options = {}) {
    this.store = new Map();
    this.resetTimes = new Map();
    // SECURITY: Limit maximum number of keys to prevent memory exhaustion
    this.maxKeys = options.maxKeys || 10000;
    this.lastAccessTimes = new Map(); // Track LRU
  }

  async incr(key, windowMs) {
    const now = Date.now();
    const resetTime = this.resetTimes.get(key) || now;

    // SECURITY: Enforce maximum key limit with LRU eviction
    if (!this.store.has(key) && this.store.size >= this.maxKeys) {
      this._evictOldest();
    }

    // Track access time for LRU
    this.lastAccessTimes.set(key, now);

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
    this.lastAccessTimes.delete(key);
  }

  cleanup() {
    // SECURITY NOTE: Potential race condition exists here
    // Cleanup runs periodically and could conflict with concurrent incr() calls
    // This is acceptable for MemoryStore as Map operations are atomic in single-threaded Node.js
    // For distributed stores, use atomic operations or locks for production deployments
    const now = Date.now();
    for (const [key, resetTime] of this.resetTimes) {
      if (now > resetTime) {
        this.store.delete(key);
        this.resetTimes.delete(key);
        this.lastAccessTimes.delete(key);
      }
    }
  }

  _evictOldest() {
    // Find and remove the least recently used entry
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.lastAccessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.resetTimes.delete(oldestKey);
      this.lastAccessTimes.delete(oldestKey);
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
    // SECURITY: Pass maxKeys to MemoryStore to prevent unbounded memory growth
    store: options.store || new MemoryStore({ maxKeys: options.maxKeys }),
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