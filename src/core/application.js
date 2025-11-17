'use strict';

/**
 * @fileoverview Core Application class for the Spark Web Framework
 * @author Spark Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');
const cluster = require('cluster');
const os = require('os');
const EventEmitter = require('events');
const { URL } = require('url');

const Context = require('./context');
const Router = require('../router/router');
const { createMiddleware } = require('./middleware');
const { errorHandler } = require('../utils/async-handler');

/**
 * Core Application class that extends EventEmitter to provide a web server framework
 * 
 * The Application class is the foundation of the Spark framework, providing HTTP/HTTPS server
 * capabilities, middleware support, routing, error handling, and graceful shutdown mechanisms.
 * It supports both single-process and cluster modes for high-performance applications.
 * 
 * @class Application
 * @extends EventEmitter
 * @since 1.0.0
 * 
 * @fires Application#error - Emitted when an application error occurs
 * @fires Application#listening - Emitted when the server starts listening
 * @fires Application#close - Emitted when the server closes
 * @fires Application#uncaughtException - Emitted when an uncaught exception occurs
 * @fires Application#unhandledRejection - Emitted when an unhandled promise rejection occurs
 * 
 * @example
 * // Basic HTTP server
 * const app = new Application({ port: 3000 });
 * 
 * app.use((ctx, next) => {
 *   // Console.log removed for production
 *   return next();
 * });
 * 
 * app.get('/', (ctx) => {
 *   ctx.json({ message: 'Hello World!' });
 * });
 * 
 * app.listen();
 * 
 * @example
 * // HTTPS server with security options
 * const fs = require('fs');
 * const app = new Application({
 *   port: 443,
 *   https: {
 *     key: fs.readFileSync('private-key.pem'),
 *     cert: fs.readFileSync('certificate.pem')
 *   },
 *   security: {
 *     cors: { origin: 'https://example.com' },
 *     rateLimit: { max: 100, window: 60000 }
 *   }
 * });
 * 
 * app.listen();
 * 
 * @example
 * // Cluster mode for multi-core systems
 * const app = new Application({
 *   port: 8080,
 *   cluster: true
 * });
 * 
 * app.listen();
 */
class Application extends EventEmitter {
  /**
   * Create a new Application instance
   * 
   * @param {Object} [options={}] - Configuration options for the application
   * @param {number} [options.port=3000] - Port number to listen on (also reads from PORT env var)
   * @param {string} [options.host='127.0.0.1'] - Host address to bind to (also reads from HOST env var)
   * @param {boolean} [options.cluster=false] - Enable cluster mode for multi-core systems
   * @param {boolean} [options.compression=true] - Enable response compression
   * @param {Object} [options.https] - HTTPS configuration with key and cert properties
   * @param {Object} [options.security] - Security configuration options
   * @param {Object} [options.security.cors] - CORS configuration
   * @param {Object} [options.security.rateLimit] - Rate limiting configuration
   * @param {boolean} [options.security.csrf=true] - Enable CSRF protection
   * @param {boolean} [options.security.helmet=true] - Enable security headers
   * @param {boolean} [options.exitOnUncaughtException=true] - Exit process on uncaught exceptions
   * @param {boolean} [options.exitOnUnhandledRejection=false] - Exit process on unhandled rejections
   * 
   * @since 1.0.0
   * 
   * @example
   * // Basic configuration
   * const app = new Application({
   *   port: 8080,
   *   host: '0.0.0.0'
   * });
   * 
   * @example
   * // With security options
   * const app = new Application({
   *   port: 443,
   *   security: {
   *     cors: { origin: ['https://example.com'] },
   *     rateLimit: { max: 200, window: 60000 },
   *     csrf: true
   *   }
   * });
   */
  constructor(options = {}) {
    super();
    
    // Set max event listeners to prevent warning
    this.setMaxListeners(50);
    
    this.options = {
      port: process.env.PORT || 3000,
      host: process.env.HOST || '127.0.0.1',  // Secure default: localhost only
      cluster: false,
      compression: true,
      security: {
        cors: { 
          origin: false,  // Secure default: CORS disabled
          credentials: true,
          maxAge: 86400
        },
        rateLimit: { max: 100, window: 60000 },  // More restrictive default
        csrf: true,  // Secure default: CSRF protection enabled
        helmet: true,  // Enable security headers by default
        contentSecurityPolicy: true,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      },
      ...options
    };

    /**
     * Array of middleware functions
     * @type {Function[]}
     * @private
     */
    this.middlewares = [];
    
    /**
     * Router instance for handling routes
     * @type {Router}
     * @private
     */
    this.router = new Router();
    
    /**
     * HTTP/HTTPS server instance
     * @type {http.Server|https.Server|null}
     * @private
     */
    this.server = null;
    
    /**
     * Whether the server is currently listening
     * @type {boolean}
     * @private
     */
    this.listening = false;
    
    /**
     * Array of cleanup handler functions
     * @type {Function[]}
     * @private
     */
    this.cleanupHandlers = [];
    
    /**
     * Middleware factory instance
     * @type {Object}
     * @private
     */
    this.middleware = createMiddleware(this);
    
    this.setupErrorHandling();
    this.setupShutdownHandlers();
  }

  /**
   * Set up error handling for the application
   * 
   * Configures event listeners for application errors, uncaught exceptions,
   * and unhandled promise rejections. Provides graceful error handling
   * and optional automatic shutdown on critical errors.
   * 
   * @private
   * @since 1.0.0
   */
  setupErrorHandling() {
    this.on('error', (error) => {
      console.error('Application error:', error);
    });

    // Handle uncaught exceptions with recovery option
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      
      // Emit error event for application-level handling
      this.emit('uncaughtException', error);
      
      // Only shutdown if explicitly configured or error is critical
      if (this.options.exitOnUncaughtException !== false) {
        console.error('Shutting down due to uncaught exception...');
        this.gracefulShutdown();
      } else {
        console.error('Continuing after uncaught exception (not recommended for production)');
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Emit error event for application-level handling
      this.emit('unhandledRejection', reason, promise);
      
      // Only shutdown if explicitly configured
      if (this.options.exitOnUnhandledRejection === true) {
        console.error('Shutting down due to unhandled rejection...');
        this.gracefulShutdown();
      }
    });
  }

  /**
   * Set up graceful shutdown handlers for process signals
   * 
   * Configures signal handlers for SIGTERM, SIGINT, and SIGBREAK (Windows)
   * to enable graceful shutdown of the application when receiving termination signals.
   * 
   * @private
   * @since 1.0.0
   */
  setupShutdownHandlers() {
    // Graceful shutdown on SIGTERM and SIGINT
    // BUG FIX: Store signal handler references for cleanup
    this._signalHandlers = new Map();

    const shutdownHandler = (signal) => {
      // Console.log removed for production
      this.gracefulShutdown();
    };

    const sigtermHandler = () => shutdownHandler('SIGTERM');
    const sigintHandler = () => shutdownHandler('SIGINT');

    this._signalHandlers.set('SIGTERM', sigtermHandler);
    this._signalHandlers.set('SIGINT', sigintHandler);

    process.once('SIGTERM', sigtermHandler);
    process.once('SIGINT', sigintHandler);

    // Windows-specific shutdown handling
    if (process.platform === 'win32') {
      const sigbreakHandler = () => shutdownHandler('SIGBREAK');
      this._signalHandlers.set('SIGBREAK', sigbreakHandler);
      process.once('SIGBREAK', sigbreakHandler);
    }
  }

  /**
   * Add middleware to the application
   * 
   * Middleware functions are executed in the order they are added. Each middleware
   * function receives the context object and a next function to continue to the next middleware.
   * 
   * @param {string|Function|Router} pathOrMiddleware - Path prefix, middleware function, or router instance
   * @param {Function} [middleware] - Middleware function when first parameter is a path
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Global middleware
   * app.use((ctx, next) => {
   *   // Console.log removed for production
   *   return next();
   * });
   * 
   * @example
   * // Path-specific middleware
   * app.use('/api', (ctx, next) => {
   *   ctx.set('X-API-Version', '1.0');
   *   return next();
   * });
   * 
   * @example
   * // Router middleware
   * const router = new Router();
   * router.get('/users', (ctx) => ctx.json({ users: [] }));
   * app.use('/api', router);
   */
  use(pathOrMiddleware, middleware) {
    if (typeof pathOrMiddleware === 'function') {
      this.middlewares.push(pathOrMiddleware);
      
      // Register cleanup handler if middleware has one
      if (pathOrMiddleware.cleanup) {
        this.cleanupHandlers.push(pathOrMiddleware.cleanup);
      }
    } else if (typeof middleware === 'function') {
      const wrappedMiddleware = async (ctx, next) => {
        if (ctx.path.startsWith(pathOrMiddleware)) {
          // Store the original path and prefix
          const originalPath = ctx.path;
          const strippedPath = ctx.path.slice(pathOrMiddleware.length) || '/';
          
          // Set the path for the middleware
          ctx.path = strippedPath;
          ctx.mountpath = pathOrMiddleware;
          
          try {
            await middleware(ctx, next);
          } finally {
            // Restore the original state
            ctx.path = originalPath;
            delete ctx.mountpath;
          }
        } else {
          await next();
        }
      };
      this.middlewares.push(wrappedMiddleware);
      
      // Register cleanup handler if middleware has one
      if (middleware.cleanup) {
        this.cleanupHandlers.push(middleware.cleanup);
      }
    } else if (typeof pathOrMiddleware === 'string' && middleware && typeof middleware === 'object' && middleware.handle) {
      // This is a router being mounted with a path prefix
      const mountPath = pathOrMiddleware;
      const router = middleware;
      this.middlewares.push((ctx, next) => {
        if (ctx.path.startsWith(mountPath)) {
          // Temporarily modify the path for the router
          const originalPath = ctx.path;
          ctx.path = ctx.path.slice(mountPath.length) || '/';
          
          return router.handle(ctx, next).finally(() => {
            // Restore original path
            ctx.path = originalPath;
          });
        }
        return next();
      });
    } else if (pathOrMiddleware && typeof pathOrMiddleware === 'object' && pathOrMiddleware.handle) {
      // This is a router being mounted without path prefix
      const router = pathOrMiddleware;
      this.middlewares.push((ctx, next) => {
        return router.handle(ctx, next);
      });
    }
    return this;
  }

  /**
   * Register a GET route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.get('/', (ctx) => {
   *   ctx.json({ message: 'Hello World!' });
   * });
   * 
   * @example
   * // With middleware
   * app.get('/protected', authenticate, (ctx) => {
   *   ctx.json({ user: ctx.user });
   * });
   */
  get(path, ...handlers) {
    this.router.get(path, ...handlers);
    return this;
  }

  /**
   * Register a POST route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.post('/users', (ctx) => {
   *   const userData = ctx.body;
   *   ctx.json({ id: 123, ...userData });
   * });
   */
  post(path, ...handlers) {
    this.router.post(path, ...handlers);
    return this;
  }

  /**
   * Register a PUT route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.put('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   const userData = ctx.body;
   *   ctx.json({ id, ...userData });
   * });
   */
  put(path, ...handlers) {
    this.router.put(path, ...handlers);
    return this;
  }

  /**
   * Register a DELETE route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.delete('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   // Delete user logic here
   *   ctx.status(204).end();
   * });
   */
  delete(path, ...handlers) {
    this.router.delete(path, ...handlers);
    return this;
  }

  /**
   * Register a PATCH route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.patch('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   const updates = ctx.body;
   *   ctx.json({ id, ...updates });
   * });
   */
  patch(path, ...handlers) {
    this.router.patch(path, ...handlers);
    return this;
  }

  /**
   * Register a HEAD route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.head('/users/:id', (ctx) => {
   *   // Check if user exists
   *   ctx.status(200).end();
   * });
   */
  head(path, ...handlers) {
    this.router.head(path, ...handlers);
    return this;
  }

  /**
   * Register an OPTIONS route handler
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.options('/api/*', (ctx) => {
   *   ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
   *   ctx.status(200).end();
   * });
   */
  options(path, ...handlers) {
    this.router.options(path, ...handlers);
    return this;
  }

  /**
   * Register a route handler for all HTTP methods
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - One or more handler functions
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * app.all('/api/*', (ctx, next) => {
   *   ctx.set('X-API-Version', '1.0');
   *   return next();
   * });
   */
  all(path, ...handlers) {
    this.router.all(path, ...handlers);
    return this;
  }

  /**
   * Handle an incoming HTTP request
   * 
   * Creates a new context object and executes the middleware chain.
   * Catches and handles any errors that occur during request processing.
   * 
   * @param {http.IncomingMessage} req - The HTTP request object
   * @param {http.ServerResponse} res - The HTTP response object
   * @returns {Promise<void>}
   * 
   * @private
   * @since 1.0.0
   */
  async handleRequest(req, res) {
    const ctx = new Context(req, res, this);
    
    try {
      await this.executeMiddleware(ctx);
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  /**
   * Execute the middleware chain for a request
   * 
   * Runs all registered middleware functions in order, followed by the router.
   * If no middleware handles the request, returns a 404 Not Found response.
   * 
   * @param {Context} ctx - The request context object
   * @returns {Promise<void>}
   * 
   * @private
   * @since 1.0.0
   */
  async executeMiddleware(ctx) {
    const middlewares = [...this.middlewares];

    middlewares.push((ctx, next) => {
      return this.router.handle(ctx, next);
    });

    let index = 0;

    const next = async (error) => {
      // If an error is passed, handle it
      if (error) {
        await this.handleError(error, ctx);
        return;
      }

      if (index >= middlewares.length) {
        if (!ctx.responded) {
          ctx.status(404).json({ error: 'Not Found' });
        }
        return;
      }

      const middleware = middlewares[index++];
      await middleware(ctx, next);
    };

    await next();
  }

  /**
   * Handle errors that occur during request processing
   * 
   * Emits an 'error' event and sends an appropriate error response to the client.
   * In development mode, includes the error message in the response.
   * 
   * @param {Error} error - The error that occurred
   * @param {Context} ctx - The request context object
   * @returns {Promise<void>}
   * 
   * @private
   * @since 1.0.0
   */
  async handleError(error, ctx) {
    // Only emit error event if not in test mode
    if (!process.env.TEST_MODE) {
      this.emit('error', error, ctx);
    }
    
    if (!ctx.responded) {
      try {
        // Get status code from error or default to 500
        const statusCode = error.status || error.statusCode || 500;
        
        // Prepare error response
        const errorResponse = {
          error: error.message || 'Internal Server Error',
          status: statusCode
        };
        
        // Add additional error properties if they exist
        if (error.code) {
          errorResponse.code = error.code;
        }
        
        if (error.details) {
          errorResponse.details = error.details;
        }
        
        // Add stack trace in development
        if (process.env.NODE_ENV === 'development') {
          errorResponse.stack = error.stack;
        }
        
        ctx.status(statusCode).json(errorResponse);
      } catch (responseError) {
        console.error('Error sending error response:', responseError);
      }
    }
  }

  /**
   * Create an HTTP or HTTPS server instance
   * 
   * Creates either an HTTP or HTTPS server based on the configuration.
   * Sets up error handling for server and client errors.
   * 
   * @returns {http.Server|https.Server} The created server instance
   * 
   * @private
   * @since 1.0.0
   */
  createServer() {
    if (this.options.https) {
      this.server = https.createServer(this.options.https, (req, res) => {
        this.handleRequest(req, res);
      });
    } else {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });
    }

    this.server.on('error', (error) => {
      this.emit('error', error);
    });

    this.server.on('clientError', (error, socket) => {
      if (error.code === 'ECONNRESET' || !socket.writable) {
        return;
      }
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    return this.server;
  }

  /**
   * Start listening for incoming requests
   * 
   * Starts the server in either cluster mode (if configured) or single-process mode.
   * Supports various parameter combinations for flexibility.
   * 
   * @param {number|Function} [port] - Port number or callback function
   * @param {string|Function} [host] - Host address or callback function
   * @param {Function} [callback] - Callback function called when server starts listening
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Use default port and host
   * app.listen();
   * 
   * @example
   * // Specify port
   * app.listen(8080);
   * 
   * @example
   * // Specify port and host
   * app.listen(8080, '0.0.0.0');
   * 
   * @example
   * // With callback
   * app.listen(3000, () => {
   *   // Console.log removed for production
   * });
   */
  listen(port, host, callback) {
    if (typeof port === 'function') {
      callback = port;
      port = this.options.port;
      host = this.options.host;
    } else if (typeof host === 'function') {
      callback = host;
      host = this.options.host;
    }

    port = port !== undefined ? port : this.options.port;
    host = host || this.options.host;

    // Use isPrimary (Node.js v16+) with fallback to isMaster for older versions
    const isPrimary = cluster.isPrimary !== undefined ? cluster.isPrimary : cluster.isMaster;

    if (this.options.cluster && isPrimary) {
      return this.startCluster(port, host, callback);
    }

    return this.startServer(port, host, callback);
  }

  /**
   * Start the application in cluster mode
   * 
   * Creates worker processes equal to the number of CPU cores.
   * Automatically restarts workers if they die.
   * 
   * @param {number} port - Port number to listen on
   * @param {string} host - Host address to bind to
   * @param {Function} [callback] - Callback function called when cluster starts
   * @returns {Application} The application instance for method chaining
   * 
   * @private
   * @since 1.0.0
   */
  startCluster(port, host, callback) {
    const numCPUs = os.cpus().length;
    
    // Console.log removed for production
    
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      // Console.log removed for production
      cluster.fork();
    });

    if (callback) {
      callback();
    }

    return this;
  }

  /**
   * Start the server in single-process mode
   * 
   * Creates the server and starts listening on the specified port and host.
   * Emits a 'listening' event when the server is ready.
   * 
   * @param {number} port - Port number to listen on
   * @param {string} host - Host address to bind to
   * @param {Function} [callback] - Callback function called when server starts listening
   * @returns {Application} The application instance for method chaining
   * 
   * @throws {Error} Throws an error if the server is already listening
   * 
   * @private
   * @since 1.0.0
   */
  startServer(port, host, callback) {
    if (this.listening) {
      throw new Error('Server is already listening');
    }

    this.createServer();

    this.server.listen(port, host, () => {
      this.listening = true;
      const address = this.server.address();
      // Console.log removed for production
      
      if (callback) {
        callback();
      }
      
      this.emit('listening');
    });

    return this;
  }

  /**
   * Close the server and clean up resources
   * 
   * Runs all registered cleanup handlers and gracefully closes the server.
   * Forces connection termination after a timeout to prevent hanging.
   * 
   * @returns {Promise<void>} Promise that resolves when the server is closed
   * 
   * @since 1.0.0
   * 
   * @example
   * // Graceful shutdown
   * await app.close();
   * // Console.log removed for production
   */
  async close() {
    if (!this.server) {
      return;
    }

    // BUG FIX: Remove signal handlers to prevent memory leaks
    if (this._signalHandlers) {
      for (const [signal, handler] of this._signalHandlers) {
        process.removeListener(signal, handler);
      }
      this._signalHandlers.clear();
    }

    // Run all cleanup handlers
    await this.runCleanupHandlers();

    return new Promise((resolve, reject) => {
      // Set a timeout for server close
      const closeTimeout = setTimeout(() => {
        console.error('Server close timeout, forcing shutdown...');
        resolve();
      }, 30000); // 30 seconds timeout
      
      this.server.close((error) => {
        clearTimeout(closeTimeout);
        
        if (error) {
          reject(error);
        } else {
          this.listening = false;
          this.emit('close');
          resolve();
        }
      });
      
      // Force close all connections after 10 seconds
      setTimeout(() => {
        if (this.server && this.server.listening) {
          // Console.log removed for production
          this.server.unref();
        }
      }, 10000);
    });
  }

  /**
   * Run all registered cleanup handlers
   * 
   * Executes cleanup functions registered by middleware in the order they were added.
   * Errors in cleanup handlers are logged but do not prevent other handlers from running.
   * 
   * @returns {Promise<void>}
   * 
   * @private
   * @since 1.0.0
   */
  async runCleanupHandlers() {
    // Console.log removed for production
    
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Error in cleanup handler:', error);
      }
    }
    
    // Clear the handlers array
    this.cleanupHandlers = [];
  }

  /**
   * Perform a graceful shutdown of the application
   * 
   * Stops accepting new connections, waits for existing requests to complete,
   * runs cleanup handlers, and exits the process. Prevents multiple shutdown attempts.
   * 
   * @returns {Promise<void>}
   * 
   * @since 1.0.0
   * 
   * @example
   * // Trigger graceful shutdown
   * process.on('SIGTERM', () => {
   *   app.gracefulShutdown();
   * });
   */
  async gracefulShutdown() {
    // Console.log removed for production
    
    // Prevent multiple shutdown attempts
    if (this.shuttingDown) {
      // Console.log removed for production
      return;
    }
    this.shuttingDown = true;

    try {
      // Give ongoing requests time to complete
      // The close() method will handle stopping new connections
      await Promise.race([
        this.close(),
        new Promise(resolve => setTimeout(resolve, 30000)) // 30 seconds max
      ]);
      
      // Console.log removed for production
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Register a cleanup handler for application shutdown
   * 
   * Cleanup handlers are called during graceful shutdown to clean up resources
   * like database connections, file handles, or external service connections.
   * 
   * @param {Function} handler - Async function to call during shutdown
   * @returns {Application} The application instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Register database cleanup
   * app.onShutdown(async () => {
   *   await database.close();
   *   // Console.log removed for production
   * });
   * 
   * @example
   * // Register multiple cleanup handlers
   * app.onShutdown(() => cache.disconnect())
   *    .onShutdown(() => logger.flush());
   */
  onShutdown(handler) {
    if (typeof handler === 'function') {
      this.cleanupHandlers.push(handler);
    }
    return this;
  }

}

module.exports = Application;