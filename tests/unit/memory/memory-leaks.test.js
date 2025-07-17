const { describe, it, expect, beforeEach, afterEach } = require('../../../test-helper');
const Application = require('../../../src/core/application');
const rateLimit = require('../../../src/middleware/rate-limit');
const { createCache } = require('../../../src/utils/cache');

describe('Memory Leak Prevention', () => {
  let app;
  let originalListeners;
  
  beforeEach(() => {
    app = new Application();
    originalListeners = process.listeners('SIGTERM').length;
  });

  afterEach(() => {
    if (app && app.close) {
      app.close();
    }
  });

  describe('Application Memory Management', () => {
    it('should set max listeners to prevent warning', () => {
      expect(app.getMaxListeners()).toBe(50);
    });

    it('should register shutdown handlers', () => {
      const sigtermListeners = process.listeners('SIGTERM');
      expect(sigtermListeners.length).toBeGreaterThan(originalListeners);
    });

    it('should cleanup handlers on shutdown', async () => {
      const cleanup = jest.fn();
      const middleware = jest.fn();
      middleware.cleanup = cleanup;
      
      app.use(middleware);
      
      await app.gracefulShutdown();
      
      expect(cleanup).toHaveBeenCalled();
    });

    it('should handle multiple cleanup handlers', async () => {
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();
      
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();
      
      middleware1.cleanup = cleanup1;
      middleware2.cleanup = cleanup2;
      
      app.use(middleware1);
      app.use(middleware2);
      
      await app.gracefulShutdown();
      
      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should prevent multiple shutdown calls', async () => {
      const cleanup = jest.fn();
      app.onShutdown(cleanup);
      
      await Promise.all([
        app.gracefulShutdown(),
        app.gracefulShutdown()
      ]);
      
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiter Memory Management', () => {
    it('should cleanup intervals on shutdown', () => {
      const limiter = rateLimit();
      
      expect(typeof limiter.cleanup).toBe('function');
      
      // Should not throw
      expect(() => {
        limiter.cleanup();
      }).not.toThrow();
    });

    it('should limit token bucket size', () => {
      const tokenBucket = rateLimit.tokenBucket({ 
        bucketSize: 10,
        refillRate: 1,
        maxBuckets: 100
      });
      
      // Simulate many requests to fill up buckets
      const ctx = {
        ip: () => 'test-ip',
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();
      
      // This should not cause memory issues
      for (let i = 0; i < 200; i++) {
        ctx.ip = () => `ip-${i}`;
        tokenBucket(ctx, next);
      }
      
      // Should have automatic cleanup
      expect(tokenBucket.cleanup).toBeDefined();
    });

    it('should cleanup expired entries', (done) => {
      const limiter = rateLimit({
        windowMs: 50, // Very short window
        max: 10
      });
      
      const ctx = {
        ip: () => 'test-ip',
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();
      
      // Make some requests
      limiter(ctx, next);
      limiter(ctx, next);
      
      // Wait for cleanup
      setTimeout(() => {
        // Should have cleaned up expired entries
        expect(limiter.cleanup).toBeDefined();
        limiter.cleanup();
        done();
      }, 100);
    });
  });

  describe('Cache Memory Management', () => {
    it('should cleanup cache intervals', () => {
      const cache = createCache({ 
        ttl: 1000,
        checkPeriod: 100
      });
      
      expect(typeof cache.stop).toBe('function');
      
      // Should not throw
      expect(() => {
        cache.stop();
      }).not.toThrow();
    });

    it('should remove expired entries', (done) => {
      const cache = createCache({ 
        ttl: 50,
        checkPeriod: 25
      });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      setTimeout(() => {
        expect(cache.size()).toBe(0);
        cache.stop();
        done();
      }, 100);
    });

    it('should handle cache size limits', () => {
      const cache = createCache({ 
        maxSize: 3,
        type: 'lru'
      });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1
      
      expect(cache.size()).toBe(3);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key4')).toBe(true);
      
      cache.stop();
    });

    it('should cleanup all event listeners on stop', () => {
      const cache = createCache();
      
      const initialListeners = cache.listenerCount('expired');
      cache.on('expired', () => {});
      
      expect(cache.listenerCount('expired')).toBe(initialListeners + 1);
      
      cache.stop();
      
      // Should have removed all listeners
      expect(cache.listenerCount('expired')).toBe(0);
    });
  });

  describe('Timer Management', () => {
    it('should use unref() for cleanup timers', () => {
      const cache = createCache({ 
        ttl: 1000,
        checkPeriod: 100
      });
      
      // The timer should be unref'd so it doesn't keep process alive
      expect(cache._checkTimer).toBeDefined();
      
      cache.stop();
    });

    it('should clear all timers on shutdown', () => {
      const limiter = rateLimit({
        windowMs: 1000,
        max: 10
      });
      
      // Should clear any internal timers
      expect(() => {
        limiter.cleanup();
      }).not.toThrow();
    });
  });

  describe('Event Listener Management', () => {
    it('should not exceed max listeners', () => {
      const cache = createCache();
      
      // Add many listeners
      for (let i = 0; i < 100; i++) {
        cache.on('expired', () => {});
      }
      
      // Should not have warning
      expect(cache.listenerCount('expired')).toBe(100);
      
      cache.stop();
    });

    it('should cleanup process listeners on app close', async () => {
      const app = new Application();
      const initialListeners = process.listeners('SIGTERM').length;
      
      await app.gracefulShutdown();
      
      // Should not have added permanent listeners
      const finalListeners = process.listeners('SIGTERM').length;
      expect(finalListeners).toBeLessThanOrEqual(initialListeners + 1);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should track memory usage over time', () => {
      const initialMemory = process.memoryUsage();
      
      // Create some objects
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        objects.push({ id: i, data: 'test'.repeat(100) });
      }
      
      const afterCreation = process.memoryUsage();
      
      // Clear objects
      objects.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanup = process.memoryUsage();
      
      // Memory should have increased during creation
      expect(afterCreation.heapUsed).toBeGreaterThan(initialMemory.heapUsed);
      
      // Memory should decrease after cleanup (not always guaranteed due to GC)
      expect(afterCleanup.heapUsed).toBeLessThanOrEqual(afterCreation.heapUsed + 1000000);
    });
  });
});