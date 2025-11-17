'use strict';

/**
 * Metrics collection middleware for performance monitoring
 */

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byPath: {}
      },
      responseTime: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        buckets: {
          '<100ms': 0,
          '100-500ms': 0,
          '500ms-1s': 0,
          '1s-5s': 0,
          '>5s': 0
        }
      },
      errors: {
        total: 0,
        byType: {},
        byStatus: {}
      },
      activeConnections: 0,
      memory: {
        samples: [],
        maxSamples: 100
      }
    };
    
    this.startTime = Date.now();
    this.memoryInterval = null;
    this.setupMemoryTracking();
  }

  setupMemoryTracking() {
    this.memoryInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memory.samples.push({
        timestamp: Date.now(),
        ...memUsage
      });
      
      // Keep only last 100 samples
      if (this.metrics.memory.samples.length > this.metrics.memory.maxSamples) {
        this.metrics.memory.samples.shift();
      }
    }, 30000); // Every 30 seconds
    
    // Don't keep process alive
    this.memoryInterval.unref();
  }

  recordRequest(method, path, status, duration, error = null) {
    // Total requests
    this.metrics.requests.total++;
    
    // By method
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    
    // By status
    this.metrics.requests.byStatus[status] = (this.metrics.requests.byStatus[status] || 0) + 1;
    
    // By path (sanitized)
    const sanitizedPath = this.sanitizePath(path);
    this.metrics.requests.byPath[sanitizedPath] = (this.metrics.requests.byPath[sanitizedPath] || 0) + 1;
    
    // Response time
    this.metrics.responseTime.total += duration;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, duration);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, duration);
    
    // Response time buckets
    if (duration < 100) {
      this.metrics.responseTime.buckets['<100ms']++;
    } else if (duration < 500) {
      this.metrics.responseTime.buckets['100-500ms']++;
    } else if (duration < 1000) {
      this.metrics.responseTime.buckets['500ms-1s']++;
    } else if (duration < 5000) {
      this.metrics.responseTime.buckets['1s-5s']++;
    } else {
      this.metrics.responseTime.buckets['>5s']++;
    }
    
    // Errors
    if (error || status >= 400) {
      this.metrics.errors.total++;
      this.metrics.errors.byStatus[status] = (this.metrics.errors.byStatus[status] || 0) + 1;
      
      if (error) {
        const errorType = error.constructor.name;
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
      }
    }
  }

  sanitizePath(path) {
    // Replace IDs and numbers with placeholders
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id') // MongoDB ObjectIds
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid'); // UUIDs
  }

  incrementActiveConnections() {
    this.metrics.activeConnections++;
  }

  decrementActiveConnections() {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
  }

  getMetrics() {
    const now = Date.now();
    const uptime = now - this.startTime;

    const avgResponseTime = this.metrics.responseTime.count > 0
      ? this.metrics.responseTime.total / this.metrics.responseTime.count
      : 0;

    // SECURITY: Prevent division by zero when uptime is 0 (immediately after startup)
    const uptimeSeconds = uptime / 1000;
    const rps = uptimeSeconds > 0 ? this.metrics.requests.total / uptimeSeconds : 0;

    return {
      timestamp: now,
      uptime: uptime,
      requests: {
        ...this.metrics.requests,
        rps: rps // requests per second (safe from division by zero)
      },
      responseTime: {
        ...this.metrics.responseTime,
        average: avgResponseTime,
        min: this.metrics.responseTime.min === Infinity ? 0 : this.metrics.responseTime.min
      },
      errors: {
        ...this.metrics.errors,
        errorRate: this.metrics.requests.total > 0 
          ? (this.metrics.errors.total / this.metrics.requests.total * 100).toFixed(2) + '%'
          : '0%'
      },
      activeConnections: this.metrics.activeConnections,
      memory: this.getMemoryStats()
    };
  }

  getMemoryStats() {
    if (this.metrics.memory.samples.length === 0) {
      return { current: process.memoryUsage() };
    }

    const latest = this.metrics.memory.samples[this.metrics.memory.samples.length - 1];
    const samples = this.metrics.memory.samples;
    
    const heapUsedSamples = samples.map(s => s.heapUsed);
    const avg = heapUsedSamples.reduce((a, b) => a + b, 0) / heapUsedSamples.length;
    const max = Math.max(...heapUsedSamples);
    const min = Math.min(...heapUsedSamples);

    return {
      current: {
        heapUsed: latest.heapUsed,
        heapTotal: latest.heapTotal,
        external: latest.external,
        rss: latest.rss
      },
      stats: {
        average: avg,
        max: max,
        min: min,
        samples: samples.length
      }
    };
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byPath: {}
      },
      responseTime: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        buckets: {
          '<100ms': 0,
          '100-500ms': 0,
          '500ms-1s': 0,
          '1s-5s': 0,
          '>5s': 0
        }
      },
      errors: {
        total: 0,
        byType: {},
        byStatus: {}
      },
      activeConnections: 0,
      memory: {
        samples: [],
        maxSamples: 100
      }
    };
    
    this.startTime = Date.now();
  }

  stop() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }
}

// Global metrics collector instance
const globalCollector = new MetricsCollector();

/**
 * Metrics middleware
 * @param {Object} options - Metrics options
 * @returns {Function} Middleware function
 */
function metrics(options = {}) {
  const opts = {
    path: '/_metrics',
    collectResponseTime: true,
    collectMemory: true,
    excludePaths: ['/favicon.ico'],
    customCollector: null,
    ...options
  };

  const collector = opts.customCollector || globalCollector;

  const middleware = async (ctx, next) => {
    // Serve metrics endpoint
    if (ctx.path === opts.path) {
      if (ctx.method !== 'GET') {
        ctx.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      
      const metricsData = collector.getMetrics();
      ctx.json(metricsData);
      return;
    }

    // Skip excluded paths
    if (opts.excludePaths.includes(ctx.path)) {
      return next();
    }

    // Track active connections
    collector.incrementActiveConnections();
    
    const startTime = Date.now();
    let error = null;

    try {
      await next();
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Record metrics
      collector.recordRequest(
        ctx.method,
        ctx.path,
        ctx.statusCode,
        duration,
        error
      );
      
      // Add response time header
      if (opts.collectResponseTime) {
        ctx.set('X-Response-Time', `${duration}ms`);
      }
      
      // Decrement active connections
      collector.decrementActiveConnections();
    }
  };

  // Add cleanup method to middleware
  middleware.cleanup = () => {
    collector.stop();
  };

  // Add collector access
  middleware.collector = collector;

  return middleware;
}

/**
 * Create a custom metrics collector
 * @returns {MetricsCollector} New metrics collector instance
 */
function createCollector() {
  return new MetricsCollector();
}

/**
 * Get global metrics collector
 * @returns {MetricsCollector} Global collector instance
 */
function getGlobalCollector() {
  return globalCollector;
}

module.exports = metrics;
module.exports.createCollector = createCollector;
module.exports.getGlobalCollector = getGlobalCollector;
module.exports.MetricsCollector = MetricsCollector;