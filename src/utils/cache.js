'use strict';

const { EventEmitter } = require('events');

const DEFAULT_TTL = 300000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;

class MemoryCache extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      ttl: options.ttl || DEFAULT_TTL,
      maxSize: options.maxSize || DEFAULT_MAX_SIZE,
      checkPeriod: options.checkPeriod || 60000, // 1 minute
      maxEventListeners: options.maxEventListeners || 100,
      ...options
    };
    
    // Set max event listeners to prevent warning
    this.setMaxListeners(this.options.maxEventListeners);
    
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      keys: 0,
      ksize: 0,
      vsize: 0
    };
    
    this.cleanupInterval = null;
    this.startCleanup();
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.del(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    entry.accessed = Date.now();
    return entry.value;
  }

  set(key, value, ttl) {
    const expiresAt = Date.now() + (ttl || this.options.ttl);
    
    if (this.cache.has(key)) {
      this.del(key);
    }

    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const entry = {
      value,
      expires: expiresAt,
      created: Date.now(),
      accessed: Date.now()
    };

    this.cache.set(key, entry);
    this.stats.keys++;
    this.stats.ksize += key.length;
    this.stats.vsize += this.getSize(value);

    this.scheduleExpiration(key, expiresAt);
    this.emit('set', key, value);
    
    return true;
  }

  del(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.stats.keys--;
    this.stats.ksize -= key.length;
    this.stats.vsize -= this.getSize(entry.value);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    this.emit('del', key);
    return true;
  }

  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.del(key);
      return false;
    }

    return true;
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      keys: 0,
      ksize: 0,
      vsize: 0
    };
    
    this.emit('flush');
  }

  keys() {
    const keys = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (now <= entry.expires) {
        keys.push(key);
      } else {
        this.del(key);
      }
    }
    
    return keys;
  }

  values() {
    const values = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (now <= entry.expires) {
        values.push(entry.value);
      } else {
        this.del(key);
      }
    }
    
    return values;
  }

  entries() {
    const entries = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (now <= entry.expires) {
        entries.push([key, entry.value]);
      } else {
        this.del(key);
      }
    }
    
    return entries;
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memoryUsage: this.stats.ksize + this.stats.vsize
    };
  }

  getTTL(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return -1;
    }

    const remaining = entry.expires - Date.now();
    return remaining > 0 ? remaining : -1;
  }

  touch(key, ttl) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const newExpires = Date.now() + (ttl || this.options.ttl);
    entry.expires = newExpires;
    entry.accessed = Date.now();
    
    this.scheduleExpiration(key, newExpires);
    return true;
  }

  scheduleExpiration(key, expiresAt) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const delay = expiresAt - Date.now();
    
    // Only set timer if delay is positive and reasonable
    if (delay > 0 && delay < 2147483647) { // Max 32-bit signed integer for setTimeout
      const timeout = setTimeout(() => {
        this.del(key);
      }, delay);
      
      // Allow timer to be garbage collected if process exits
      if (timeout.unref) {
        timeout.unref();
      }

      this.timers.set(key, timeout);
    } else if (delay <= 0) {
      // If already expired, delete immediately
      setImmediate(() => this.del(key));
    }
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessed < oldestTime) {
        oldestTime = entry.accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.del(oldestKey);
      this.emit('evict', oldestKey);
    }
  }

  getSize(value) {
    if (typeof value === 'string') {
      return value.length;
    }
    
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value).length;
    }
    
    return 0;
  }

  startCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.checkPeriod);
    
    // Allow cleanup interval to be garbage collected if process exits
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.del(key);
    }

    this.emit('cleanup', expiredKeys.length);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
    
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
  }
}

class LRUCache extends MemoryCache {
  constructor(options = {}) {
    super(options);
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE;
    
    // Override parent's max size to ensure consistency
    this.options.maxSize = this.maxSize;
  }

  get(key) {
    const value = super.get(key);
    
    if (value !== undefined) {
      this.moveToFront(key);
    }
    
    return value;
  }

  set(key, value, ttl) {
    const result = super.set(key, value, ttl);
    this.moveToFront(key);
    return result;
  }

  moveToFront(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
  }
}

function createCache(options = {}) {
  const type = options.type || 'memory';
  
  switch (type) {
    case 'memory':
      return new MemoryCache(options);
    case 'lru':
      return new LRUCache(options);
    default:
      throw new Error(`Unknown cache type: ${type}`);
  }
}

function memoize(fn, options = {}) {
  const cache = createCache(options);
  
  const memoized = function(...args) {
    const key = options.keyGenerator ? 
      options.keyGenerator(...args) : 
      JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result, options.ttl);
    
    return result;
  };
  
  // Attach cache cleanup method
  memoized.clear = () => cache.clear();
  memoized.stop = () => cache.stop();
  
  return memoized;
}

function asyncMemoize(fn, options = {}) {
  const cache = createCache(options);
  const pending = new Map();
  
  const memoized = async function(...args) {
    const key = options.keyGenerator ? 
      options.keyGenerator(...args) : 
      JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    if (pending.has(key)) {
      return pending.get(key);
    }
    
    const promise = fn.apply(this, args);
    pending.set(key, promise);
    
    try {
      const result = await promise;
      cache.set(key, result, options.ttl);
      pending.delete(key);
      return result;
    } catch (error) {
      pending.delete(key);
      throw error;
    }
  };
  
  // Attach cache cleanup method
  memoized.clear = () => {
    cache.clear();
    pending.clear();
  };
  memoized.stop = () => cache.stop();
  
  return memoized;
}

module.exports = {
  MemoryCache,
  LRUCache,
  createCache,
  memoize,
  asyncMemoize
};