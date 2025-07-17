# Performance Optimization

Master advanced performance optimization techniques to build high-performance applications with Spark.

## Performance Profiling and Monitoring

### 1. Request Profiling

```javascript
const { performance } = require('perf_hooks');

// Advanced request profiler
class RequestProfiler {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.sampleRate = options.sampleRate ?? 1.0;
    this.thresholds = {
      slow: options.slowThreshold ?? 1000,
      critical: options.criticalThreshold ?? 5000
    };
    this.metrics = new Map();
  }
  
  middleware() {
    return async (ctx, next) => {
      if (!this.enabled || Math.random() > this.sampleRate) {
        return next();
      }
      
      const profileId = `${ctx.method}:${ctx.path}`;
      const startTime = performance.now();
      const memStart = process.memoryUsage();
      
      // Track CPU usage
      const cpuStart = process.cpuUsage();
      
      try {
        await next();
      } finally {
        const duration = performance.now() - startTime;
        const memEnd = process.memoryUsage();
        const cpuEnd = process.cpuUsage(cpuStart);
        
        this.recordMetrics(profileId, {
          duration,
          memory: {
            heapUsed: memEnd.heapUsed - memStart.heapUsed,
            external: memEnd.external - memStart.external
          },
          cpu: {
            user: cpuEnd.user,
            system: cpuEnd.system
          },
          statusCode: ctx.statusCode
        });
        
        // Alert on performance issues
        if (duration > this.thresholds.critical) {
          console.error(`CRITICAL: ${profileId} took ${duration.toFixed(2)}ms`);
        } else if (duration > this.thresholds.slow) {
          console.warn(`SLOW: ${profileId} took ${duration.toFixed(2)}ms`);
        }
      }
    };
  }
  
  recordMetrics(profileId, metrics) {
    if (!this.metrics.has(profileId)) {
      this.metrics.set(profileId, {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        errors: 0,
        memoryUsage: [],
        cpuUsage: []
      });
    }
    
    const profile = this.metrics.get(profileId);
    profile.count++;
    profile.totalDuration += metrics.duration;
    profile.maxDuration = Math.max(profile.maxDuration, metrics.duration);
    profile.minDuration = Math.min(profile.minDuration, metrics.duration);
    
    if (metrics.statusCode >= 400) {
      profile.errors++;
    }
    
    profile.memoryUsage.push(metrics.memory.heapUsed);
    profile.cpuUsage.push(metrics.cpu.user + metrics.cpu.system);
  }
  
  getReport() {
    const report = {};
    
    for (const [profileId, data] of this.metrics) {
      report[profileId] = {
        count: data.count,
        averageDuration: data.totalDuration / data.count,
        maxDuration: data.maxDuration,
        minDuration: data.minDuration,
        errorRate: data.errors / data.count,
        averageMemory: data.memoryUsage.reduce((a, b) => a + b, 0) / data.memoryUsage.length,
        averageCpu: data.cpuUsage.reduce((a, b) => a + b, 0) / data.cpuUsage.length
      };
    }
    
    return report;
  }
}

// Usage
const profiler = new RequestProfiler({
  enabled: process.env.NODE_ENV === 'production',
  sampleRate: 0.1, // Profile 10% of requests
  slowThreshold: 500,
  criticalThreshold: 2000
});

app.use(profiler.middleware());

// Expose metrics endpoint
app.get('/admin/metrics', (ctx) => {
  ctx.json(profiler.getReport());
});
```

### 2. Memory Leak Detection

```javascript
// Memory leak detector
class MemoryLeakDetector {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 60000; // 1 minute
    this.thresholds = {
      heapUsed: options.heapThreshold || 100 * 1024 * 1024, // 100MB
      heapGrowth: options.growthThreshold || 10 * 1024 * 1024, // 10MB
      externalGrowth: options.externalGrowthThreshold || 5 * 1024 * 1024 // 5MB
    };
    this.baseline = null;
    this.samples = [];
    this.maxSamples = 10;
  }
  
  start() {
    this.baseline = process.memoryUsage();
    
    setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }
  
  checkMemory() {
    const current = process.memoryUsage();
    
    this.samples.push({
      timestamp: Date.now(),
      heapUsed: current.heapUsed,
      heapTotal: current.heapTotal,
      external: current.external,
      rss: current.rss
    });
    
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    // Check for memory leaks
    this.detectLeaks(current);
  }
  
  detectLeaks(current) {
    const heapGrowth = current.heapUsed - this.baseline.heapUsed;
    const externalGrowth = current.external - this.baseline.external;
    
    if (current.heapUsed > this.thresholds.heapUsed) {
      console.warn(`High heap usage: ${(current.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (heapGrowth > this.thresholds.heapGrowth) {
      console.warn(`Heap growth detected: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (externalGrowth > this.thresholds.externalGrowth) {
      console.warn(`External memory growth: ${(externalGrowth / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Force garbage collection if available
    if (global.gc && current.heapUsed > this.thresholds.heapUsed * 0.8) {
      global.gc();
    }
  }
  
  getStats() {
    const current = process.memoryUsage();
    const trend = this.calculateTrend();
    
    return {
      current,
      baseline: this.baseline,
      growth: {
        heap: current.heapUsed - this.baseline.heapUsed,
        external: current.external - this.baseline.external,
        rss: current.rss - this.baseline.rss
      },
      trend,
      samples: this.samples
    };
  }
  
  calculateTrend() {
    if (this.samples.length < 2) return null;
    
    const recent = this.samples.slice(-5);
    const heapTrend = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
    
    return {
      direction: heapTrend > 0 ? 'increasing' : 'decreasing',
      rate: heapTrend / recent.length
    };
  }
}

// Usage
const memoryDetector = new MemoryLeakDetector({
  checkInterval: 30000,
  heapThreshold: 200 * 1024 * 1024 // 200MB
});

memoryDetector.start();

app.get('/admin/memory', (ctx) => {
  ctx.json(memoryDetector.getStats());
});
```

## Advanced Caching Strategies

### 1. Multi-Level Caching

```javascript
// Multi-level cache implementation
class MultiLevelCache {
  constructor(options = {}) {
    this.l1 = new Map(); // Memory cache
    this.l2 = options.redisClient; // Redis cache
    this.l3 = options.databaseClient; // Database cache
    
    this.l1MaxSize = options.l1MaxSize || 1000;
    this.l1TTL = options.l1TTL || 60000; // 1 minute
    this.l2TTL = options.l2TTL || 3600000; // 1 hour
    this.l3TTL = options.l3TTL || 86400000; // 24 hours
  }
  
  async get(key) {
    // Try L1 cache first
    const l1Result = this.l1.get(key);
    if (l1Result && Date.now() < l1Result.expiry) {
      return l1Result.value;
    }
    
    // Try L2 cache
    if (this.l2) {
      const l2Result = await this.l2.get(key);
      if (l2Result) {
        // Promote to L1
        this.setL1(key, l2Result);
        return l2Result;
      }
    }
    
    // Try L3 cache
    if (this.l3) {
      const l3Result = await this.l3.get(`cache:${key}`);
      if (l3Result) {
        // Promote to L2 and L1
        if (this.l2) await this.l2.setex(key, this.l2TTL / 1000, l3Result);
        this.setL1(key, l3Result);
        return l3Result;
      }
    }
    
    return null;
  }
  
  async set(key, value, ttl = this.l1TTL) {
    // Set in all levels
    this.setL1(key, value);
    
    if (this.l2) {
      await this.l2.setex(key, ttl / 1000, value);
    }
    
    if (this.l3) {
      await this.l3.set(`cache:${key}`, value, { ttl });
    }
  }
  
  setL1(key, value) {
    // Implement LRU eviction
    if (this.l1.size >= this.l1MaxSize) {
      const firstKey = this.l1.keys().next().value;
      this.l1.delete(firstKey);
    }
    
    this.l1.set(key, {
      value,
      expiry: Date.now() + this.l1TTL
    });
  }
  
  async invalidate(key) {
    this.l1.delete(key);
    if (this.l2) await this.l2.del(key);
    if (this.l3) await this.l3.del(`cache:${key}`);
  }
  
  middleware() {
    return async (ctx, next) => {
      if (ctx.method !== 'GET') return next();
      
      const key = `${ctx.path}:${JSON.stringify(ctx.query)}`;
      const cached = await this.get(key);
      
      if (cached) {
        ctx.set('X-Cache', 'HIT');
        return ctx.json(cached);
      }
      
      // Override json to cache response
      const originalJson = ctx.json;
      ctx.json = async function(data) {
        await this.set(key, data);
        ctx.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      }.bind(this);
      
      return next();
    };
  }
}
```

### 2. Intelligent Cache Warming

```javascript
// Cache warming system
class CacheWarmer {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.warmupInterval = options.warmupInterval || 300000; // 5 minutes
    this.concurrency = options.concurrency || 5;
    this.patterns = [];
    this.stats = {
      warmed: 0,
      failed: 0,
      lastRun: null
    };
  }
  
  addPattern(pattern) {
    this.patterns.push(pattern);
    return this;
  }
  
  start() {
    setInterval(() => {
      this.warmCache();
    }, this.warmupInterval);
    
    // Initial warmup
    this.warmCache();
  }
  
  async warmCache() {
    const start = Date.now();
    console.log('Starting cache warmup...');
    
    const promises = this.patterns.map(pattern => 
      this.warmPattern(pattern)
    );
    
    await Promise.all(promises);
    
    this.stats.lastRun = Date.now();
    console.log(`Cache warmup completed in ${Date.now() - start}ms`);
  }
  
  async warmPattern(pattern) {
    const keys = await this.generateKeys(pattern);
    const semaphore = new Semaphore(this.concurrency);
    
    const promises = keys.map(key => 
      semaphore.acquire().then(async (release) => {
        try {
          await this.warmKey(key, pattern);
          this.stats.warmed++;
        } catch (error) {
          console.error(`Failed to warm key ${key}:`, error);
          this.stats.failed++;
        } finally {
          release();
        }
      })
    );
    
    await Promise.all(promises);
  }
  
  async warmKey(key, pattern) {
    const cached = await this.cache.get(key);
    if (cached) return; // Already cached
    
    const data = await pattern.fetcher(key);
    await this.cache.set(key, data, pattern.ttl);
  }
  
  async generateKeys(pattern) {
    if (pattern.keyGenerator) {
      return pattern.keyGenerator();
    }
    
    // Default key generation based on pattern
    return [pattern.key];
  }
}

// Semaphore for concurrency control
class Semaphore {
  constructor(permits) {
    this.permits = permits;
    this.waiting = [];
  }
  
  acquire() {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(resolve);
      }
    });
  }
  
  release() {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      this.permits--;
      resolve(() => this.release());
    }
  }
}

// Usage
const warmer = new CacheWarmer(cache, { concurrency: 10 })
  .addPattern({
    key: 'popular-products',
    fetcher: async () => await db.getPopularProducts(),
    ttl: 3600000
  })
  .addPattern({
    keyGenerator: async () => {
      const userIds = await db.getActiveUserIds();
      return userIds.map(id => `user:${id}:profile`);
    },
    fetcher: async (key) => {
      const userId = key.split(':')[1];
      return await db.getUserProfile(userId);
    },
    ttl: 1800000
  });

warmer.start();
```

## Connection Pooling and Resource Management

### 1. Advanced Connection Pool

```javascript
// Advanced connection pool with health checking
class ConnectionPool {
  constructor(factory, options = {}) {
    this.factory = factory;
    this.minSize = options.minSize || 5;
    this.maxSize = options.maxSize || 20;
    this.idleTimeout = options.idleTimeout || 300000; // 5 minutes
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute
    this.maxRetries = options.maxRetries || 3;
    
    this.pool = [];
    this.active = new Set();
    this.waiting = [];
    this.stats = {
      created: 0,
      destroyed: 0,
      borrowed: 0,
      returned: 0,
      failures: 0
    };
    
    this.initialize();
  }
  
  async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.minSize; i++) {
      try {
        const conn = await this.createConnection();
        this.pool.push(conn);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    }
    
    // Start health check
    this.startHealthCheck();
  }
  
  async createConnection() {
    const conn = await this.factory.create();
    conn._createdAt = Date.now();
    conn._lastUsed = Date.now();
    conn._healthy = true;
    this.stats.created++;
    return conn;
  }
  
  async acquire() {
    // Try to get from pool
    if (this.pool.length > 0) {
      const conn = this.pool.pop();
      this.active.add(conn);
      conn._lastUsed = Date.now();
      this.stats.borrowed++;
      return conn;
    }
    
    // Create new connection if under max size
    if (this.active.size < this.maxSize) {
      const conn = await this.createConnection();
      this.active.add(conn);
      this.stats.borrowed++;
      return conn;
    }
    
    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.indexOf(resolve);
        if (index !== -1) {
          this.waiting.splice(index, 1);
          reject(new Error('Connection timeout'));
        }
      }, 10000);
      
      this.waiting.push((conn) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }
  
  release(conn) {
    if (!this.active.has(conn)) return;
    
    this.active.delete(conn);
    this.stats.returned++;
    
    // Serve waiting requests first
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      this.active.add(conn);
      conn._lastUsed = Date.now();
      waiter(conn);
      return;
    }
    
    // Return to pool if not expired
    if (Date.now() - conn._lastUsed < this.idleTimeout) {
      this.pool.push(conn);
    } else {
      this.destroyConnection(conn);
    }
  }
  
  async destroyConnection(conn) {
    try {
      await this.factory.destroy(conn);
      this.stats.destroyed++;
    } catch (error) {
      console.error('Failed to destroy connection:', error);
    }
  }
  
  startHealthCheck() {
    setInterval(async () => {
      await this.healthCheck();
    }, this.healthCheckInterval);
  }
  
  async healthCheck() {
    const allConnections = [...this.pool, ...this.active];
    
    for (const conn of allConnections) {
      try {
        await this.factory.validate(conn);
        conn._healthy = true;
      } catch (error) {
        conn._healthy = false;
        this.stats.failures++;
        
        // Remove unhealthy connections
        if (this.pool.includes(conn)) {
          this.pool.splice(this.pool.indexOf(conn), 1);
          this.destroyConnection(conn);
        }
      }
    }
    
    // Maintain minimum pool size
    while (this.pool.length < this.minSize) {
      try {
        const conn = await this.createConnection();
        this.pool.push(conn);
      } catch (error) {
        console.error('Failed to create connection during health check:', error);
        break;
      }
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      activeSize: this.active.size,
      waitingSize: this.waiting.length,
      totalSize: this.pool.length + this.active.size
    };
  }
  
  middleware() {
    return async (ctx, next) => {
      const conn = await this.acquire();
      ctx.db = conn;
      
      try {
        await next();
      } finally {
        this.release(conn);
      }
    };
  }
}
```

### 2. Resource Cleanup Manager

```javascript
// Resource cleanup manager
class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.cleanupHandlers = [];
    this.shuttingDown = false;
    
    this.setupSignalHandlers();
  }
  
  register(id, resource, cleanupFn) {
    this.resources.set(id, {
      resource,
      cleanup: cleanupFn,
      createdAt: Date.now()
    });
    
    return () => this.unregister(id);
  }
  
  unregister(id) {
    const resource = this.resources.get(id);
    if (resource) {
      this.resources.delete(id);
      return resource.cleanup(resource.resource);
    }
  }
  
  onShutdown(handler) {
    this.cleanupHandlers.push(handler);
  }
  
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.shutdown(signal);
      });
    });
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      this.shutdown('unhandledRejection');
    });
  }
  
  async shutdown(signal) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    
    console.log(`Shutting down due to ${signal}...`);
    
    // Run custom cleanup handlers
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Cleanup handler error:', error);
      }
    }
    
    // Cleanup registered resources
    const cleanupPromises = Array.from(this.resources.values()).map(
      async ({ resource, cleanup }) => {
        try {
          await cleanup(resource);
        } catch (error) {
          console.error('Resource cleanup error:', error);
        }
      }
    );
    
    await Promise.all(cleanupPromises);
    
    console.log('Shutdown complete');
    process.exit(0);
  }
  
  middleware() {
    return async (ctx, next) => {
      const resourceId = `request:${Date.now()}:${Math.random()}`;
      const resources = [];
      
      ctx.addResource = (resource, cleanupFn) => {
        resources.push({ resource, cleanup: cleanupFn });
      };
      
      try {
        await next();
      } finally {
        // Cleanup request resources
        for (const { resource, cleanup } of resources) {
          try {
            await cleanup(resource);
          } catch (error) {
            console.error('Request resource cleanup error:', error);
          }
        }
      }
    };
  }
}
```

## Advanced Security Optimizations

### 1. Rate Limiting with Sliding Window

```javascript
// Advanced rate limiter with sliding window
class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowSize = options.windowSize || 60000; // 1 minute
    this.precision = options.precision || 1000; // 1 second buckets
    this.storage = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000;
    
    this.startCleanup();
  }
  
  async isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }
    
    const requests = this.storage.get(key);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.storage.set(key, validRequests);
    
    // Check if request is allowed
    if (validRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        resetTime: Math.min(...validRequests) + this.windowSize,
        remaining: 0
      };
    }
    
    // Add current request
    validRequests.push(now);
    
    return {
      allowed: true,
      resetTime: now + this.windowSize,
      remaining: this.maxRequests - validRequests.length
    };
  }
  
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.windowSize;
      
      for (const [key, requests] of this.storage) {
        const validRequests = requests.filter(timestamp => timestamp > cutoff);
        
        if (validRequests.length === 0) {
          this.storage.delete(key);
        } else {
          this.storage.set(key, validRequests);
        }
      }
    }, this.cleanupInterval);
  }
  
  middleware(keyGenerator = (ctx) => ctx.ip) {
    return async (ctx, next) => {
      const key = keyGenerator(ctx);
      const result = await this.isAllowed(key);
      
      ctx.set('X-RateLimit-Limit', this.maxRequests);
      ctx.set('X-RateLimit-Remaining', result.remaining);
      ctx.set('X-RateLimit-Reset', result.resetTime);
      
      if (!result.allowed) {
        return ctx.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      return next();
    };
  }
}
```

### 2. Request Deduplication

```javascript
// Request deduplication to prevent duplicate processing
class RequestDeduplicator {
  constructor(options = {}) {
    this.ttl = options.ttl || 60000; // 1 minute
    this.pending = new Map();
    this.results = new Map();
  }
  
  generateKey(ctx) {
    return `${ctx.method}:${ctx.path}:${JSON.stringify(ctx.query)}:${JSON.stringify(ctx.body)}:${ctx.user?.id || 'anonymous'}`;
  }
  
  middleware() {
    return async (ctx, next) => {
      if (ctx.method === 'GET' || ctx.method === 'HEAD') {
        return next(); // Skip for safe methods
      }
      
      const key = this.generateKey(ctx);
      
      // Check if request is already being processed
      if (this.pending.has(key)) {
        const result = await this.pending.get(key);
        ctx.status(result.status);
        return ctx.json(result.data);
      }
      
      // Check if we have a cached result
      const cachedResult = this.results.get(key);
      if (cachedResult && Date.now() - cachedResult.timestamp < this.ttl) {
        ctx.status(cachedResult.status);
        return ctx.json(cachedResult.data);
      }
      
      // Process request
      const promise = this.processRequest(ctx, next);
      this.pending.set(key, promise);
      
      try {
        const result = await promise;
        
        // Cache result
        this.results.set(key, {
          status: result.status,
          data: result.data,
          timestamp: Date.now()
        });
        
        ctx.status(result.status);
        return ctx.json(result.data);
      } finally {
        this.pending.delete(key);
      }
    };
  }
  
  async processRequest(ctx, next) {
    const originalJson = ctx.json;
    let result = null;
    
    ctx.json = function(data) {
      result = { status: this.statusCode || 200, data };
      return originalJson.call(this, data);
    };
    
    await next();
    
    return result || { status: 200, data: null };
  }
}
```

## Load Balancing and Clustering

### 1. Intelligent Load Balancer

```javascript
// Intelligent load balancer with health checking
class LoadBalancer {
  constructor(options = {}) {
    this.servers = [];
    this.algorithm = options.algorithm || 'round-robin';
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.healthCheckTimeout = options.healthCheckTimeout || 5000;
    this.currentIndex = 0;
    this.weights = new Map();
    this.responses = new Map();
    
    this.startHealthCheck();
  }
  
  addServer(server) {
    this.servers.push({
      ...server,
      healthy: true,
      lastCheck: Date.now(),
      responseTime: 0,
      errors: 0,
      requests: 0
    });
    
    this.weights.set(server.id, server.weight || 1);
    this.responses.set(server.id, []);
  }
  
  removeServer(serverId) {
    const index = this.servers.findIndex(s => s.id === serverId);
    if (index !== -1) {
      this.servers.splice(index, 1);
      this.weights.delete(serverId);
      this.responses.delete(serverId);
    }
  }
  
  getServer() {
    const healthyServers = this.servers.filter(s => s.healthy);
    
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }
    
    switch (this.algorithm) {
      case 'round-robin':
        return this.roundRobin(healthyServers);
      case 'weighted':
        return this.weighted(healthyServers);
      case 'least-connections':
        return this.leastConnections(healthyServers);
      case 'response-time':
        return this.responseTime(healthyServers);
      default:
        return this.roundRobin(healthyServers);
    }
  }
  
  roundRobin(servers) {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }
  
  weighted(servers) {
    const totalWeight = servers.reduce((sum, server) => 
      sum + this.weights.get(server.id), 0);
    
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= this.weights.get(server.id);
      if (random <= 0) {
        return server;
      }
    }
    
    return servers[0];
  }
  
  leastConnections(servers) {
    return servers.reduce((least, server) => 
      server.activeConnections < least.activeConnections ? server : least);
  }
  
  responseTime(servers) {
    return servers.reduce((fastest, server) => 
      server.responseTime < fastest.responseTime ? server : fastest);
  }
  
  startHealthCheck() {
    setInterval(async () => {
      await this.checkHealth();
    }, this.healthCheckInterval);
  }
  
  async checkHealth() {
    const promises = this.servers.map(server => this.checkServer(server));
    await Promise.all(promises);
  }
  
  async checkServer(server) {
    const start = Date.now();
    
    try {
      const response = await fetch(`${server.url}/health`, {
        timeout: this.healthCheckTimeout
      });
      
      if (response.ok) {
        server.healthy = true;
        server.responseTime = Date.now() - start;
        server.lastCheck = Date.now();
      } else {
        server.healthy = false;
        server.errors++;
      }
    } catch (error) {
      server.healthy = false;
      server.errors++;
      server.lastCheck = Date.now();
    }
  }
  
  middleware() {
    return async (ctx, next) => {
      try {
        const server = this.getServer();
        
        // Track active connections
        server.activeConnections = (server.activeConnections || 0) + 1;
        server.requests++;
        
        // Forward request to server
        const response = await this.forwardRequest(ctx, server);
        
        // Update statistics
        this.updateStats(server, response);
        
        // Send response
        ctx.status(response.status);
        ctx.json(response.data);
      } catch (error) {
        ctx.status(503).json({
          error: 'Service unavailable',
          message: error.message
        });
      }
    };
  }
  
  async forwardRequest(ctx, server) {
    const start = Date.now();
    
    try {
      const response = await fetch(`${server.url}${ctx.path}`, {
        method: ctx.method,
        headers: ctx.headers,
        body: ctx.body ? JSON.stringify(ctx.body) : undefined
      });
      
      const data = await response.json();
      
      return {
        status: response.status,
        data,
        responseTime: Date.now() - start
      };
    } finally {
      server.activeConnections--;
    }
  }
  
  updateStats(server, response) {
    const responses = this.responses.get(server.id);
    responses.push(response.responseTime);
    
    // Keep only last 100 responses
    if (responses.length > 100) {
      responses.shift();
    }
    
    // Update average response time
    server.responseTime = responses.reduce((sum, time) => sum + time, 0) / responses.length;
  }
}
```

## Best Practices Summary

1. **Profile Before Optimizing**: Use profiling tools to identify actual bottlenecks
2. **Monitor Key Metrics**: Track response times, memory usage, error rates
3. **Implement Caching Strategically**: Use multi-level caching for frequently accessed data
4. **Pool Resources**: Use connection pooling and resource management
5. **Handle Errors Gracefully**: Implement circuit breakers and fallback mechanisms
6. **Optimize for Production**: Use clustering, load balancing, and horizontal scaling
7. **Clean Up Resources**: Implement proper cleanup and shutdown procedures
8. **Security First**: Rate limiting, request deduplication, and input validation

You now have advanced tools to build high-performance, scalable applications that can handle enterprise-level traffic!

## What's Next?

👉 **Next Guide:** [Microservices Architecture](02-microservices-architecture.md)

You'll learn:
- Service decomposition strategies
- Inter-service communication
- Event-driven architectures
- Distributed tracing

Master the art of building scalable systems! 🚀