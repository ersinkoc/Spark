'use strict';

/**
 * Cache middleware for @oxog/spark
 * Provides response caching functionality
 */

/**
 * Creates a cache middleware
 * @param {Object} options - Cache configuration options
 * @param {number} [options.maxAge=3600] - Cache max age in seconds
 * @param {Function} [options.key] - Function to generate cache key
 * @param {Function} [options.condition] - Function to determine if response should be cached
 * @param {Object} [options.store] - Custom cache store (default: in-memory)
 * @returns {Function} Cache middleware function
 */
function cache(options = {}) {
  const {
    maxAge = 3600,
    key = defaultKeyGenerator,
    condition = defaultCondition,
    store = new Map()
  } = options;

  return async function cacheMiddleware(ctx, next) {
    // Only cache GET and HEAD requests
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next();
    }

    // Check if caching should be applied
    if (!condition(ctx)) {
      return next();
    }

    // Generate cache key
    const cacheKey = key(ctx);
    
    // Check if cached response exists
    const cached = store.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      // Serve from cache
      ctx.status = cached.status;
      ctx.body = cached.body;
      ctx.set(cached.headers);
      ctx.set('X-Cache', 'HIT');
      ctx.set('Age', Math.floor((Date.now() - cached.created) / 1000));
      return;
    }

    // Not in cache, proceed with request
    await next();

    // Store response in cache if successful
    if (ctx.status >= 200 && ctx.status < 300 && ctx.body) {
      const cacheEntry = {
        status: ctx.status,
        body: ctx.body,
        headers: filterHeaders(ctx.headers),
        created: Date.now(),
        expires: Date.now() + (maxAge * 1000)
      };

      store.set(cacheKey, cacheEntry);
      
      // Set cache headers
      ctx.set('Cache-Control', `public, max-age=${maxAge}`);
      ctx.set('X-Cache', 'MISS');
    }
  };
}

/**
 * Default cache key generator
 * @param {Object} ctx - Koa context
 * @returns {string} Cache key
 */
function defaultKeyGenerator(ctx) {
  return ctx.url;
}

/**
 * Default condition to determine if response should be cached
 * @param {Object} ctx - Koa context
 * @returns {boolean} Whether to cache the response
 */
function defaultCondition(ctx) {
  // Don't cache if no-cache header is present
  const cacheControl = ctx.get('Cache-Control');
  if (cacheControl && cacheControl.includes('no-cache')) {
    return false;
  }
  
  // Don't cache authenticated requests by default
  if (ctx.get('Authorization')) {
    return false;
  }
  
  return true;
}

/**
 * Filter headers to store in cache
 * @param {Object} headers - Response headers
 * @returns {Object} Filtered headers
 */
function filterHeaders(headers) {
  const filtered = {};
  const allowedHeaders = [
    'content-type',
    'content-encoding',
    'content-language',
    'vary',
    'etag',
    'last-modified'
  ];
  
  for (const [key, value] of Object.entries(headers)) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Memory cache store with size limits
 */
class MemoryCacheStore {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry;
    }
    // Remove expired entry
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  set(key, value) {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Export factory function and store class
cache.MemoryCacheStore = MemoryCacheStore;

module.exports = cache;