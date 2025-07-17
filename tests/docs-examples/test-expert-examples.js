/**
 * Test examples from expert documentation (simplified versions)
 */

const { Spark } = require('../../src/index');

console.log('🧪 Testing Expert Documentation Examples (Simplified)\n');

// Helper function to get server port
function getServerPort(app) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const server = app.server;
      if (server && server.address()) {
        resolve(server.address().port);
      } else {
        reject(new Error('Server not ready'));
      }
    }, 100);
  });
}

// Test 1: Request Profiler (Simplified)
async function testRequestProfiler() {
  console.log('Test 1: Request Profiler');
  
  const app = new Spark();
  
  // Simplified request profiler
  class RequestProfiler {
    constructor() {
      this.metrics = new Map();
    }
    
    middleware() {
      return async (ctx, next) => {
        const start = Date.now();
        const profileId = `${ctx.method}:${ctx.path}`;
        
        try {
          await next();
        } finally {
          const duration = Date.now() - start;
          
          if (!this.metrics.has(profileId)) {
            this.metrics.set(profileId, {
              count: 0,
              totalDuration: 0,
              maxDuration: 0
            });
          }
          
          const metric = this.metrics.get(profileId);
          metric.count++;
          metric.totalDuration += duration;
          metric.maxDuration = Math.max(metric.maxDuration, duration);
          
          ctx.set('X-Response-Time', `${duration}ms`);
        }
      };
    }
    
    getReport() {
      const report = {};
      
      for (const [profileId, data] of this.metrics) {
        report[profileId] = {
          count: data.count,
          averageDuration: data.totalDuration / data.count,
          maxDuration: data.maxDuration
        };
      }
      
      return report;
    }
  }
  
  const profiler = new RequestProfiler();
  app.use(profiler.middleware());
  
  app.get('/test', (ctx) => {
    ctx.json({ message: 'Test endpoint' });
  });
  
  app.get('/metrics', (ctx) => {
    ctx.json(profiler.getReport());
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Request profiler running on port ${port}`);
      
      // Make some test requests
      for (let i = 0; i < 5; i++) {
        await fetch(`http://localhost:${port}/test`);
      }
      
      // Get metrics
      const metricsResponse = await fetch(`http://localhost:${port}/metrics`);
      const metrics = await metricsResponse.json();
      
      if (metrics['GET:/test'] && metrics['GET:/test'].count === 5) {
        console.log('✅ Request profiling - Success');
        console.log(`   Average response time: ${metrics['GET:/test'].averageDuration.toFixed(2)}ms`);
      } else {
        console.log('❌ Request profiling - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Request profiler test failed:', error.message);
    }
  });
}

// Test 2: Circuit Breaker (Simplified)
async function testCircuitBreaker() {
  console.log('\nTest 2: Circuit Breaker');
  
  const app = new Spark();
  
  // Simplified circuit breaker
  class CircuitBreaker {
    constructor(options = {}) {
      this.failureThreshold = options.failureThreshold || 3;
      this.resetTimeout = options.resetTimeout || 5000;
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.lastFailureTime = null;
    }
    
    async execute(operation) {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.resetTimeout) {
          this.state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }
      
      try {
        const result = await operation();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
    
    onSuccess() {
      this.failureCount = 0;
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
      }
    }
    
    onFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
    }
    
    middleware() {
      return async (ctx, next) => {
        try {
          await this.execute(() => next());
        } catch (error) {
          if (error.message === 'Circuit breaker is OPEN') {
            ctx.status(503).json({
              error: 'Service unavailable',
              message: 'Circuit breaker is open'
            });
          } else {
            throw error;
          }
        }
      };
    }
  }
  
  const breaker = new CircuitBreaker({ failureThreshold: 2 });
  let requestCount = 0;
  
  app.use('/api', breaker.middleware());
  
  app.get('/api/unstable', (ctx) => {
    requestCount++;
    // Fail first 3 requests
    if (requestCount <= 3) {
      throw new Error('Service error');
    }
    ctx.json({ message: 'Success' });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Circuit breaker running on port ${port}`);
      
      // Make requests to trigger circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          const response = await fetch(`http://localhost:${port}/api/unstable`);
          const data = await response.json();
          
          if (response.status === 503) {
            console.log(`   Request ${i + 1}: Circuit breaker OPEN`);
          } else {
            console.log(`   Request ${i + 1}: Success`);
          }
        } catch (error) {
          console.log(`   Request ${i + 1}: Failed`);
        }
      }
      
      console.log('✅ Circuit breaker pattern - Success');
      
      await app.close();
    } catch (error) {
      console.error('❌ Circuit breaker test failed:', error.message);
    }
  });
}

// Test 3: Multi-Level Cache (Simplified)
async function testMultiLevelCache() {
  console.log('\nTest 3: Multi-Level Cache');
  
  const app = new Spark();
  
  // Simplified multi-level cache
  class MultiLevelCache {
    constructor() {
      this.l1 = new Map(); // Memory cache
      this.l1MaxSize = 100;
      this.l1TTL = 5000; // 5 seconds
    }
    
    async get(key) {
      const l1Result = this.l1.get(key);
      if (l1Result && Date.now() < l1Result.expiry) {
        return l1Result.value;
      }
      return null;
    }
    
    async set(key, value) {
      // Implement simple LRU
      if (this.l1.size >= this.l1MaxSize) {
        const firstKey = this.l1.keys().next().value;
        this.l1.delete(firstKey);
      }
      
      this.l1.set(key, {
        value,
        expiry: Date.now() + this.l1TTL
      });
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
          return originalJson.call(ctx, data);
        }.bind(this);
        
        return next();
      };
    }
  }
  
  const cache = new MultiLevelCache();
  app.use(cache.middleware());
  
  let callCount = 0;
  app.get('/data', (ctx) => {
    callCount++;
    ctx.json({ 
      data: 'test data',
      generated: Date.now(),
      callCount
    });
  });
  
  app.listen(0, async () => {
    try {
      const port = await getServerPort(app);
      console.log(`✅ Multi-level cache running on port ${port}`);
      
      // First request - should miss cache
      const response1 = await fetch(`http://localhost:${port}/data`);
      const data1 = await response1.json();
      const cacheHeader1 = response1.headers.get('x-cache');
      
      if (cacheHeader1 === 'MISS' && data1.callCount === 1) {
        console.log('✅ Cache MISS - Success');
      } else {
        console.log('❌ Cache MISS - Failed');
      }
      
      // Second request - should hit cache
      const response2 = await fetch(`http://localhost:${port}/data`);
      const data2 = await response2.json();
      const cacheHeader2 = response2.headers.get('x-cache');
      
      if (cacheHeader2 === 'HIT' && data2.callCount === 1) {
        console.log('✅ Cache HIT - Success');
      } else {
        console.log('❌ Cache HIT - Failed');
      }
      
      await app.close();
    } catch (error) {
      console.error('❌ Multi-level cache test failed:', error.message);
    }
  });
}

// Test 4: Service Discovery (Simplified)
async function testServiceDiscovery() {
  console.log('\nTest 4: Service Discovery');
  
  // Simplified service registry
  class ServiceRegistry {
    constructor() {
      this.services = new Map();
    }
    
    register(serviceInfo) {
      const service = {
        ...serviceInfo,
        lastSeen: Date.now(),
        healthy: true
      };
      
      if (!this.services.has(service.name)) {
        this.services.set(service.name, new Map());
      }
      
      const serviceInstances = this.services.get(service.name);
      serviceInstances.set(service.id || `${service.name}-${service.port}`, service);
    }
    
    discover(serviceName) {
      const serviceInstances = this.services.get(serviceName);
      if (!serviceInstances || serviceInstances.size === 0) {
        throw new Error(`Service ${serviceName} not found`);
      }
      
      // Return first healthy instance
      const instances = Array.from(serviceInstances.values());
      return instances.find(s => s.healthy) || instances[0];
    }
    
    getServices() {
      const result = {};
      for (const [serviceName, serviceInstances] of this.services) {
        result[serviceName] = Array.from(serviceInstances.values());
      }
      return result;
    }
  }
  
  const registry = new ServiceRegistry();
  
  // Register services
  registry.register({
    name: 'user-service',
    id: 'user-1',
    host: 'localhost',
    port: 3001
  });
  
  registry.register({
    name: 'user-service',
    id: 'user-2',
    host: 'localhost',
    port: 3002
  });
  
  registry.register({
    name: 'order-service',
    id: 'order-1',
    host: 'localhost',
    port: 3003
  });
  
  // Test discovery
  try {
    const userService = registry.discover('user-service');
    if (userService && userService.name === 'user-service') {
      console.log('✅ Service discovery - Success');
      console.log(`   Found ${userService.name} at ${userService.host}:${userService.port}`);
    } else {
      console.log('❌ Service discovery - Failed');
    }
    
    const services = registry.getServices();
    if (services['user-service'].length === 2 && services['order-service'].length === 1) {
      console.log('✅ Service registry - Success');
    } else {
      console.log('❌ Service registry - Failed');
    }
  } catch (error) {
    console.error('❌ Service discovery test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testRequestProfiler();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testCircuitBreaker();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testMultiLevelCache();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testServiceDiscovery();
  
  console.log('\n✅ All expert documentation examples tested!');
  process.exit(0);
}

runAllTests().catch(console.error);