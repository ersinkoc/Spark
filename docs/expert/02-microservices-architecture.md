# Microservices Architecture with Spark

Build scalable microservices architectures using Spark's lightweight and performant foundation.

## Service Decomposition Strategies

### 1. Domain-Driven Design (DDD) Approach

```javascript
// Base service class with common patterns
class BaseService {
  constructor(options = {}) {
    this.name = options.name;
    this.version = options.version || '1.0.0';
    this.port = options.port || 0;
    this.dependencies = options.dependencies || [];
    this.healthChecks = new Map();
    this.metrics = new Map();
    this.circuit = new Map();
  }
  
  async initialize() {
    // Service registry registration
    await this.registerService();
    
    // Health check setup
    this.setupHealthChecks();
    
    // Metrics collection
    this.setupMetrics();
    
    // Circuit breaker initialization
    this.setupCircuitBreakers();
  }
  
  async registerService() {
    const serviceInfo = {
      name: this.name,
      version: this.version,
      port: this.port,
      health: `/health`,
      metrics: `/metrics`,
      timestamp: Date.now()
    };
    
    // Register with service discovery
    await serviceRegistry.register(serviceInfo);
  }
  
  setupHealthChecks() {
    // Add default health checks
    this.healthChecks.set('self', () => ({ status: 'healthy' }));
    
    // Add dependency health checks
    this.dependencies.forEach(dep => {
      this.healthChecks.set(dep.name, async () => {
        try {
          const response = await fetch(`${dep.url}/health`);
          return response.ok ? { status: 'healthy' } : { status: 'unhealthy' };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      });
    });
  }
  
  createApp() {
    const app = new Spark();
    
    // Add service middleware
    app.use(this.serviceMiddleware());
    
    // Health endpoint
    app.get('/health', async (ctx) => {
      const health = await this.checkHealth();
      ctx.status(health.status === 'healthy' ? 200 : 503);
      ctx.json(health);
    });
    
    // Metrics endpoint
    app.get('/metrics', (ctx) => {
      ctx.json(this.getMetrics());
    });
    
    return app;
  }
  
  serviceMiddleware() {
    return async (ctx, next) => {
      const start = Date.now();
      
      // Add service context
      ctx.service = {
        name: this.name,
        version: this.version,
        requestId: this.generateRequestId()
      };
      
      try {
        await next();
        
        // Record success metrics
        this.recordMetric('requests_total', 1, { status: 'success' });
      } catch (error) {
        // Record error metrics
        this.recordMetric('requests_total', 1, { status: 'error' });
        throw error;
      } finally {
        // Record response time
        this.recordMetric('request_duration_ms', Date.now() - start);
      }
    };
  }
  
  async checkHealth() {
    const checks = {};
    let overallStatus = 'healthy';
    
    for (const [name, check] of this.healthChecks) {
      try {
        checks[name] = await check();
        if (checks[name].status !== 'healthy') {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        checks[name] = { status: 'unhealthy', error: error.message };
        overallStatus = 'unhealthy';
      }
    }
    
    return {
      status: overallStatus,
      checks,
      timestamp: Date.now()
    };
  }
  
  generateRequestId() {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  recordMetric(name, value, labels = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        name,
        labels,
        values: [],
        count: 0,
        sum: 0
      });
    }
    
    const metric = this.metrics.get(key);
    metric.values.push(value);
    metric.count++;
    metric.sum += value;
    
    // Keep only last 1000 values
    if (metric.values.length > 1000) {
      metric.values.shift();
    }
  }
  
  getMetrics() {
    const metrics = {};
    
    for (const [key, metric] of this.metrics) {
      metrics[key] = {
        name: metric.name,
        labels: metric.labels,
        count: metric.count,
        sum: metric.sum,
        avg: metric.sum / metric.count,
        min: Math.min(...metric.values),
        max: Math.max(...metric.values)
      };
    }
    
    return metrics;
  }
}

// User service example
class UserService extends BaseService {
  constructor() {
    super({
      name: 'user-service',
      version: '1.0.0',
      port: 3001,
      dependencies: [
        { name: 'auth-service', url: 'http://auth-service:3002' },
        { name: 'notification-service', url: 'http://notification-service:3003' }
      ]
    });
    
    this.users = new Map();
    this.setupRoutes();
  }
  
  setupRoutes() {
    const app = this.createApp();
    
    // User routes
    app.get('/users', this.getUsers.bind(this));
    app.get('/users/:id', this.getUser.bind(this));
    app.post('/users', this.createUser.bind(this));
    app.put('/users/:id', this.updateUser.bind(this));
    app.delete('/users/:id', this.deleteUser.bind(this));
    
    this.app = app;
  }
  
  async getUsers(ctx) {
    const users = Array.from(this.users.values());
    ctx.json({ users });
  }
  
  async getUser(ctx) {
    const user = this.users.get(ctx.params.id);
    if (!user) {
      return ctx.status(404).json({ error: 'User not found' });
    }
    ctx.json({ user });
  }
  
  async createUser(ctx) {
    const { name, email } = ctx.body;
    
    // Validate with auth service
    const authResult = await this.callService('auth-service', 'POST', '/validate', {
      email
    });
    
    if (!authResult.valid) {
      return ctx.status(400).json({ error: 'Invalid email' });
    }
    
    const user = {
      id: Date.now().toString(),
      name,
      email,
      createdAt: new Date().toISOString()
    };
    
    this.users.set(user.id, user);
    
    // Notify notification service
    await this.callService('notification-service', 'POST', '/notify', {
      type: 'user-created',
      userId: user.id,
      email: user.email
    });
    
    ctx.status(201).json({ user });
  }
  
  async updateUser(ctx) {
    const user = this.users.get(ctx.params.id);
    if (!user) {
      return ctx.status(404).json({ error: 'User not found' });
    }
    
    const updatedUser = {
      ...user,
      ...ctx.body,
      updatedAt: new Date().toISOString()
    };
    
    this.users.set(user.id, updatedUser);
    ctx.json({ user: updatedUser });
  }
  
  async deleteUser(ctx) {
    const user = this.users.get(ctx.params.id);
    if (!user) {
      return ctx.status(404).json({ error: 'User not found' });
    }
    
    this.users.delete(ctx.params.id);
    
    // Notify notification service
    await this.callService('notification-service', 'POST', '/notify', {
      type: 'user-deleted',
      userId: user.id,
      email: user.email
    });
    
    ctx.status(204).end();
  }
  
  async callService(serviceName, method, path, data = null) {
    const service = this.dependencies.find(dep => dep.name === serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const response = await fetch(`${service.url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': this.generateRequestId()
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    return response.json();
  }
}
```

### 2. Event-Driven Architecture

```javascript
// Event bus for microservices communication
class EventBus {
  constructor(options = {}) {
    this.events = new Map();
    this.handlers = new Map();
    this.retryPolicy = options.retryPolicy || { maxRetries: 3, delay: 1000 };
    this.persistence = options.persistence || new InMemoryPersistence();
  }
  
  async publish(event) {
    const eventId = this.generateEventId();
    const enrichedEvent = {
      ...event,
      id: eventId,
      timestamp: Date.now(),
      version: event.version || '1.0.0'
    };
    
    // Persist event
    await this.persistence.store(enrichedEvent);
    
    // Get handlers for this event type
    const handlers = this.handlers.get(event.type) || [];
    
    // Publish to all handlers
    const promises = handlers.map(handler => 
      this.deliverEvent(enrichedEvent, handler)
    );
    
    await Promise.all(promises);
    
    return eventId;
  }
  
  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    this.handlers.get(eventType).push(handler);
    
    return () => {
      const handlers = this.handlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }
  
  async deliverEvent(event, handler) {
    let attempts = 0;
    
    while (attempts < this.retryPolicy.maxRetries) {
      try {
        await handler(event);
        return;
      } catch (error) {
        attempts++;
        console.error(`Event delivery failed (attempt ${attempts}):`, error);
        
        if (attempts < this.retryPolicy.maxRetries) {
          await this.delay(this.retryPolicy.delay * attempts);
        }
      }
    }
    
    // Send to dead letter queue
    await this.sendToDeadLetterQueue(event, handler);
  }
  
  async sendToDeadLetterQueue(event, handler) {
    console.error('Sending event to dead letter queue:', event);
    // Implementation depends on your dead letter queue system
  }
  
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Event-driven user service
class EventDrivenUserService extends BaseService {
  constructor(eventBus) {
    super({
      name: 'user-service',
      version: '1.0.0',
      port: 3001
    });
    
    this.eventBus = eventBus;
    this.users = new Map();
    this.setupEventHandlers();
    this.setupRoutes();
  }
  
  setupEventHandlers() {
    // Listen for user-related events
    this.eventBus.subscribe('user.created', this.handleUserCreated.bind(this));
    this.eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this));
    this.eventBus.subscribe('user.deleted', this.handleUserDeleted.bind(this));
  }
  
  async handleUserCreated(event) {
    console.log('User created event received:', event);
    // Update any derived data or trigger workflows
  }
  
  async handleUserUpdated(event) {
    console.log('User updated event received:', event);
    // Update search indexes, cache, etc.
  }
  
  async handleUserDeleted(event) {
    console.log('User deleted event received:', event);
    // Cleanup related data
  }
  
  async createUser(ctx) {
    const { name, email } = ctx.body;
    
    const user = {
      id: Date.now().toString(),
      name,
      email,
      createdAt: new Date().toISOString()
    };
    
    this.users.set(user.id, user);
    
    // Publish event
    await this.eventBus.publish({
      type: 'user.created',
      data: { user },
      source: 'user-service'
    });
    
    ctx.status(201).json({ user });
  }
}
```

## Service Discovery and Registry

### 1. Service Registry Implementation

```javascript
// Service registry with health checking
class ServiceRegistry {
  constructor(options = {}) {
    this.services = new Map();
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.serviceTimeout = options.serviceTimeout || 90000;
    this.loadBalancer = options.loadBalancer || 'round-robin';
    
    this.startHealthChecking();
  }
  
  async register(serviceInfo) {
    const service = {
      ...serviceInfo,
      lastSeen: Date.now(),
      healthy: true,
      instances: serviceInfo.instances || 1
    };
    
    if (!this.services.has(service.name)) {
      this.services.set(service.name, new Map());
    }
    
    const serviceInstances = this.services.get(service.name);
    serviceInstances.set(service.id || `${service.name}-${service.port}`, service);
    
    console.log(`Service registered: ${service.name} at ${service.host}:${service.port}`);
  }
  
  async deregister(serviceName, serviceId) {
    const serviceInstances = this.services.get(serviceName);
    if (serviceInstances) {
      serviceInstances.delete(serviceId);
      
      if (serviceInstances.size === 0) {
        this.services.delete(serviceName);
      }
    }
  }
  
  async discover(serviceName) {
    const serviceInstances = this.services.get(serviceName);
    if (!serviceInstances) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const healthyInstances = Array.from(serviceInstances.values())
      .filter(service => service.healthy);
    
    if (healthyInstances.length === 0) {
      throw new Error(`No healthy instances of ${serviceName} available`);
    }
    
    return this.selectInstance(healthyInstances);
  }
  
  selectInstance(instances) {
    switch (this.loadBalancer) {
      case 'round-robin':
        return this.roundRobinSelection(instances);
      case 'random':
        return instances[Math.floor(Math.random() * instances.length)];
      case 'least-load':
        return instances.reduce((least, current) => 
          current.load < least.load ? current : least);
      default:
        return instances[0];
    }
  }
  
  roundRobinSelection(instances) {
    const serviceName = instances[0].name;
    
    if (!this.roundRobinCounters) {
      this.roundRobinCounters = new Map();
    }
    
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    this.roundRobinCounters.set(serviceName, (counter + 1) % instances.length);
    
    return instances[counter];
  }
  
  startHealthChecking() {
    setInterval(async () => {
      await this.checkAllServices();
    }, this.healthCheckInterval);
  }
  
  async checkAllServices() {
    const now = Date.now();
    
    for (const [serviceName, serviceInstances] of this.services) {
      for (const [instanceId, service] of serviceInstances) {
        // Check if service is stale
        if (now - service.lastSeen > this.serviceTimeout) {
          service.healthy = false;
          serviceInstances.delete(instanceId);
          continue;
        }
        
        // Health check
        try {
          const response = await fetch(`http://${service.host}:${service.port}/health`, {
            timeout: 5000
          });
          
          service.healthy = response.ok;
          service.lastHealthCheck = now;
        } catch (error) {
          service.healthy = false;
          service.lastHealthCheck = now;
        }
      }
    }
  }
  
  getServices() {
    const result = {};
    
    for (const [serviceName, serviceInstances] of this.services) {
      result[serviceName] = Array.from(serviceInstances.values());
    }
    
    return result;
  }
  
  // Middleware for service discovery
  middleware() {
    return async (ctx, next) => {
      ctx.serviceRegistry = this;
      
      ctx.callService = async (serviceName, method, path, data) => {
        const service = await this.discover(serviceName);
        
        const response = await fetch(`http://${service.host}:${service.port}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': ctx.requestId
          },
          body: data ? JSON.stringify(data) : undefined
        });
        
        if (!response.ok) {
          throw new Error(`Service call failed: ${response.status}`);
        }
        
        return response.json();
      };
      
      return next();
    };
  }
}
```

### 2. API Gateway Implementation

```javascript
// API Gateway with routing and middleware
class APIGateway {
  constructor(options = {}) {
    this.routes = new Map();
    this.serviceRegistry = options.serviceRegistry;
    this.middleware = [];
    this.rateLimiter = options.rateLimiter;
    this.auth = options.auth;
    this.app = new Spark();
    
    this.setupDefaultMiddleware();
  }
  
  setupDefaultMiddleware() {
    // Request ID
    this.app.use((ctx, next) => {
      ctx.requestId = this.generateRequestId();
      ctx.set('X-Request-ID', ctx.requestId);
      return next();
    });
    
    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(this.rateLimiter.middleware());
    }
    
    // Authentication
    if (this.auth) {
      this.app.use(this.auth.middleware());
    }
    
    // Service discovery
    if (this.serviceRegistry) {
      this.app.use(this.serviceRegistry.middleware());
    }
    
    // Request logging
    this.app.use((ctx, next) => {
      console.log(`[${ctx.requestId}] ${ctx.method} ${ctx.path}`);
      return next();
    });
  }
  
  addRoute(path, serviceName, options = {}) {
    this.routes.set(path, {
      serviceName,
      stripPrefix: options.stripPrefix !== false,
      timeout: options.timeout || 10000,
      retries: options.retries || 2
    });
  }
  
  setupRoutes() {
    // Dynamic route handling
    this.app.use(async (ctx, next) => {
      const route = this.findRoute(ctx.path);
      
      if (!route) {
        return next();
      }
      
      try {
        await this.proxyRequest(ctx, route);
      } catch (error) {
        console.error(`Gateway error: ${error.message}`);
        ctx.status(502).json({
          error: 'Bad Gateway',
          message: 'Service temporarily unavailable'
        });
      }
    });
    
    // 404 handler
    this.app.use((ctx) => {
      ctx.status(404).json({
        error: 'Not Found',
        message: 'Route not found'
      });
    });
  }
  
  findRoute(path) {
    for (const [routePath, route] of this.routes) {
      if (path.startsWith(routePath)) {
        return { ...route, matchedPath: routePath };
      }
    }
    return null;
  }
  
  async proxyRequest(ctx, route) {
    const service = await this.serviceRegistry.discover(route.serviceName);
    
    // Transform path
    let targetPath = ctx.path;\n    if (route.stripPrefix) {\n      targetPath = ctx.path.replace(route.matchedPath, '');\n    }\n    \n    // Add query parameters\n    if (ctx.query && Object.keys(ctx.query).length > 0) {\n      const queryString = new URLSearchParams(ctx.query).toString();\n      targetPath += `?${queryString}`;\n    }\n    \n    const url = `http://${service.host}:${service.port}${targetPath}`;\n    \n    // Proxy request with retries\n    let lastError;\n    for (let attempt = 0; attempt <= route.retries; attempt++) {\n      try {\n        const response = await fetch(url, {\n          method: ctx.method,\n          headers: {\n            ...ctx.headers,\n            'X-Request-ID': ctx.requestId,\n            'X-Forwarded-For': ctx.ip,\n            'X-Gateway': 'spark-gateway'\n          },\n          body: ctx.body ? JSON.stringify(ctx.body) : undefined,\n          timeout: route.timeout\n        });\n        \n        // Forward response\n        ctx.status(response.status);\n        \n        // Forward headers\n        for (const [key, value] of response.headers) {\n          if (!key.startsWith('x-')) {\n            ctx.set(key, value);\n          }\n        }\n        \n        const data = await response.json();\n        return ctx.json(data);\n      } catch (error) {\n        lastError = error;\n        \n        if (attempt < route.retries) {\n          await this.delay(1000 * (attempt + 1));\n        }\n      }\n    }\n    \n    throw lastError;\n  }\n  \n  generateRequestId() {\n    return `gw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n  \n  delay(ms) {\n    return new Promise(resolve => setTimeout(resolve, ms));\n  }\n  \n  start(port = 3000) {\n    this.setupRoutes();\n    \n    return this.app.listen(port, () => {\n      console.log(`API Gateway running on port ${port}`);\n    });\n  }\n}\n\n// Usage example\nconst gateway = new APIGateway({\n  serviceRegistry: new ServiceRegistry(),\n  rateLimiter: new RateLimiter({ max: 1000 }),\n  auth: new AuthMiddleware()\n});\n\n// Configure routes\ngateway.addRoute('/api/users', 'user-service');\ngateway.addRoute('/api/orders', 'order-service');\ngateway.addRoute('/api/products', 'product-service');\n\ngateway.start(3000);"],
["```

## Distributed Tracing

### 1. Request Tracing Implementation

```javascript
// Distributed tracing system
class DistributedTracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unknown-service';
    this.traces = new Map();
    this.spans = new Map();
    this.reporter = options.reporter || new ConsoleReporter();
    this.samplingRate = options.samplingRate || 1.0;
  }
  
  startTrace(traceId = null) {
    const trace = {
      traceId: traceId || this.generateTraceId(),
      startTime: Date.now(),
      spans: [],
      sampled: Math.random() < this.samplingRate
    };
    
    this.traces.set(trace.traceId, trace);
    return trace;
  }
  
  startSpan(traceId, operationName, parentSpanId = null) {
    const span = {
      spanId: this.generateSpanId(),
      traceId,
      parentSpanId,
      operationName,
      serviceName: this.serviceName,
      startTime: Date.now(),
      endTime: null,
      tags: {},
      logs: []
    };
    
    this.spans.set(span.spanId, span);
    
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }
    
    return span;
  }
  
  finishSpan(span, error = null) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (error) {
      span.tags.error = true;
      span.logs.push({
        timestamp: Date.now(),
        level: 'error',
        message: error.message,
        stack: error.stack
      });
    }
    
    const trace = this.traces.get(span.traceId);
    if (trace && trace.sampled) {
      this.reporter.report(span);
    }
  }
  
  addTag(span, key, value) {
    span.tags[key] = value;
  }
  
  addLog(span, level, message, data = {}) {
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data
    });
  }
  
  generateTraceId() {
    return Math.random().toString(36).substr(2, 16);
  }
  
  generateSpanId() {
    return Math.random().toString(36).substr(2, 8);
  }
  
  middleware() {
    return async (ctx, next) => {
      // Extract trace context from headers
      const traceId = ctx.get('X-Trace-ID') || null;
      const parentSpanId = ctx.get('X-Parent-Span-ID') || null;
      
      // Start or continue trace
      const trace = traceId ? 
        this.traces.get(traceId) || this.startTrace(traceId) : 
        this.startTrace();
      
      // Start span for this request
      const span = this.startSpan(
        trace.traceId,
        `${ctx.method} ${ctx.path}`,
        parentSpanId
      );
      
      // Add request tags
      this.addTag(span, 'http.method', ctx.method);
      this.addTag(span, 'http.url', ctx.path);
      this.addTag(span, 'http.user_agent', ctx.get('user-agent'));
      
      // Add trace context to request
      ctx.trace = trace;
      ctx.span = span;
      
      // Set headers for downstream services
      ctx.set('X-Trace-ID', trace.traceId);
      ctx.set('X-Parent-Span-ID', span.spanId);
      
      try {
        await next();
        
        // Add response tags
        this.addTag(span, 'http.status_code', ctx.statusCode);
        
        if (ctx.statusCode >= 400) {
          this.addTag(span, 'error', true);
        }
      } catch (error) {
        this.finishSpan(span, error);
        throw error;
      }
      
      this.finishSpan(span);
    };
  }
}

// Console reporter for development
class ConsoleReporter {
  report(span) {
    console.log(`[TRACE] ${span.traceId} | ${span.operationName} | ${span.duration}ms`);
  }
}

// HTTP reporter for production
class HttpReporter {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.buffer = [];
    this.batchSize = 100;
    this.flushInterval = 5000;
    
    this.startFlushing();
  }
  
  report(span) {
    this.buffer.push(span);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }
  
  startFlushing() {
    setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }
  
  async flush() {
    const spans = this.buffer.splice(0);
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spans })
      });
    } catch (error) {
      console.error('Failed to report spans:', error);
    }
  }
}
```

## Circuit Breaker Pattern

### 1. Advanced Circuit Breaker

```javascript
// Advanced circuit breaker with statistics
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    this.slowCallThreshold = options.slowCallThreshold || 5000;
    this.slowCallRateThreshold = options.slowCallRateThreshold || 0.5;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.stats = {
      totalCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      successfulCalls: 0
    };
    
    this.callHistory = [];
  }
  
  async execute(operation, fallback = null) {
    const callStart = Date.now();
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker moved to HALF_OPEN state');
      } else {
        this.recordCall('circuit_open', 0);
        return fallback ? fallback() : this.throwCircuitOpenError();
      }
    }
    
    try {
      const result = await operation();
      const duration = Date.now() - callStart;
      
      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - callStart;
      this.onFailure(duration);
      throw error;
    }
  }
  
  onSuccess(duration) {
    this.failureCount = 0;
    this.recordCall('success', duration);
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('Circuit breaker moved to CLOSED state');
    }
  }
  
  onFailure(duration) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.recordCall('failure', duration);
    
    if (this.shouldTripCircuit()) {
      this.state = 'OPEN';
      console.log('Circuit breaker moved to OPEN state');
    }
  }
  
  shouldTripCircuit() {
    if (this.failureCount >= this.failureThreshold) {
      return true;
    }
    
    // Check slow call rate
    const recentCalls = this.getRecentCalls();
    if (recentCalls.length >= 10) {
      const slowCalls = recentCalls.filter(call => 
        call.duration > this.slowCallThreshold
      );
      
      const slowCallRate = slowCalls.length / recentCalls.length;
      return slowCallRate > this.slowCallRateThreshold;
    }
    
    return false;
  }
  
  recordCall(type, duration) {
    this.stats.totalCalls++;
    
    switch (type) {
      case 'success':
        this.stats.successfulCalls++;
        break;
      case 'failure':
        this.stats.failedCalls++;
        break;
      case 'circuit_open':
        // Not counted in other stats
        break;
    }
    
    if (duration > this.slowCallThreshold) {
      this.stats.slowCalls++;
    }
    
    this.callHistory.push({
      timestamp: Date.now(),
      type,
      duration
    });
    
    // Keep only recent history
    this.callHistory = this.callHistory.filter(call => 
      Date.now() - call.timestamp < this.monitoringPeriod
    );
  }
  
  getRecentCalls() {
    const cutoff = Date.now() - this.monitoringPeriod;
    return this.callHistory.filter(call => call.timestamp > cutoff);
  }
  
  throwCircuitOpenError() {
    const error = new Error('Circuit breaker is OPEN');
    error.code = 'CIRCUIT_OPEN';
    error.retryAfter = Math.ceil(this.resetTimeout / 1000);
    throw error;
  }
  
  getStats() {
    const recentCalls = this.getRecentCalls();
    
    return {
      state: this.state,
      ...this.stats,
      failureRate: this.stats.totalCalls > 0 ? 
        this.stats.failedCalls / this.stats.totalCalls : 0,
      slowCallRate: this.stats.totalCalls > 0 ? 
        this.stats.slowCalls / this.stats.totalCalls : 0,
      recentCalls: recentCalls.length,
      lastFailureTime: this.lastFailureTime
    };
  }
  
  middleware() {
    return async (ctx, next) => {
      try {
        await this.execute(() => next());
      } catch (error) {
        if (error.code === 'CIRCUIT_OPEN') {
          ctx.status(503).json({
            error: 'Service unavailable',
            message: 'Circuit breaker is open',
            retryAfter: error.retryAfter
          });
        } else {
          throw error;
        }
      }
    };
  }
}
```

## Deployment and Orchestration

### 1. Docker Configuration

```dockerfile
# Dockerfile for microservice
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S spark -u 1001

# Change ownership
RUN chown -R spark:nodejs /app

USER spark

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "src/index.js"]
```

### 2. Kubernetes Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: SERVICE_NAME
          value: "user-service"
        - name: PORT
          value: "3000"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

### 3. Service Mesh Integration

```javascript
// Service mesh integration
class ServiceMesh {
  constructor(options = {}) {
    this.serviceName = options.serviceName;
    this.meshConfig = options.meshConfig || {};
    this.sidecarProxy = options.sidecarProxy;
  }
  
  middleware() {
    return async (ctx, next) => {
      // Add service mesh headers
      ctx.set('X-Service-Name', this.serviceName);
      ctx.set('X-Service-Version', process.env.SERVICE_VERSION || '1.0.0');
      
      // Extract mesh context
      const meshContext = {
        traceId: ctx.get('X-Trace-ID'),
        spanId: ctx.get('X-Span-ID'),
        userId: ctx.get('X-User-ID'),
        requestId: ctx.get('X-Request-ID')
      };
      
      ctx.meshContext = meshContext;
      
      // Add security headers
      if (this.meshConfig.mtls) {
        ctx.set('X-Forwarded-Client-Cert', ctx.get('X-Forwarded-Client-Cert'));
      }
      
      await next();
    };
  }
  
  async callService(serviceName, request) {
    // Use service mesh for inter-service communication
    const meshHeaders = {
      'X-Service-Name': this.serviceName,
      'X-Request-ID': request.context.requestId,
      'X-Trace-ID': request.context.traceId
    };
    
    // Route through mesh proxy
    const proxyUrl = this.sidecarProxy || 'http://localhost:15001';
    const response = await fetch(`${proxyUrl}/${serviceName}${request.path}`, {
      method: request.method,
      headers: { ...request.headers, ...meshHeaders },
      body: request.body
    });
    
    return response;
  }
}
```

## Best Practices Summary

1. **Service Boundaries**: Design services around business capabilities
2. **Event-Driven Communication**: Use events for loose coupling
3. **Circuit Breakers**: Implement fault tolerance patterns
4. **Distributed Tracing**: Monitor request flows across services
5. **Service Discovery**: Automate service registration and discovery
6. **API Gateway**: Centralize cross-cutting concerns
7. **Health Checks**: Implement comprehensive health monitoring
8. **Graceful Degradation**: Design for partial failures
9. **Observability**: Implement logging, metrics, and tracing
10. **Security**: Secure service-to-service communication

You now have the foundation to build scalable, resilient microservices architectures with Spark!

## What's Next?

👉 **Next Guide:** [Advanced Security Patterns](03-advanced-security.md)

You'll learn:
- OAuth 2.0 and OpenID Connect
- JWT security best practices
- API security patterns
- Zero-trust architecture

Build secure, enterprise-grade applications! 🔒