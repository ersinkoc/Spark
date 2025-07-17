/**
 * @fileoverview Main entry point for the Spark Web Framework
 * @author Spark Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

const Application = require('./core/application');
const Router = require('./router/router');
const Context = require('./core/context');

const bodyParser = require('./middleware/body-parser');
const cors = require('./middleware/cors');
const compression = require('./middleware/compression');
const staticFiles = require('./middleware/static');
const session = require('./middleware/session');
const rateLimit = require('./middleware/rate-limit');
const security = require('./middleware/security');
const healthCheck = require('./middleware/health');
const metrics = require('./middleware/metrics');
const logger = require('./middleware/logger');

// Error handling utilities
const { asyncHandler, errorHandler, createError, errors } = require('./utils/async-handler');

// Utility classes
const ContextPool = require('./utils/context-pool');
const { RegexValidator, SafeRegexCache } = require('./utils/regex-validator');

/**
 * Spark Web Framework - A fast, secure, and modern Node.js web framework
 * 
 * Spark extends the base Application class to provide a complete web framework
 * with built-in security, middleware support, and modern development features.
 * 
 * @class Spark
 * @extends Application
 * @since 1.0.0
 * 
 * @example
 * // Basic usage
 * const { Spark } = require('spark-framework');
 * 
 * const app = new Spark({
 *   port: 3000,
 *   security: {
 *     cors: { origin: true },
 *     rateLimit: { max: 100, window: 60000 }
 *   }
 * });
 * 
 * app.get('/', (ctx) => {
 *   ctx.json({ message: 'Hello Spark!' });
 * });
 * 
 * app.listen();
 * 
 * @example
 * // With middleware
 * const app = new Spark();
 * 
 * app.use(bodyParser.json());
 * app.use(cors({ origin: 'https://example.com' }));
 * 
 * app.post('/api/users', (ctx) => {
 *   const userData = ctx.body;
 *   ctx.json({ success: true, data: userData });
 * });
 * 
 * app.listen(8080);
 */
class Spark extends Application {
  /**
   * Create a new Spark application instance
   * 
   * @param {Object} [options={}] - Configuration options for the application
   * @param {number} [options.port=3000] - Port number to listen on
   * @param {string} [options.host='127.0.0.1'] - Host address to bind to
   * @param {boolean} [options.cluster=false] - Enable cluster mode
   * @param {Object} [options.security] - Security configuration
   * @param {Object} [options.https] - HTTPS configuration with key and cert
   * 
   * @since 1.0.0
   * 
   * @example
   * const app = new Spark({
   *   port: 8080,
   *   host: '0.0.0.0',
   *   security: {
   *     cors: { origin: ['https://example.com'] },
   *     rateLimit: { max: 200, window: 60000 }
   *   }
   * });
   */
  constructor(options) {
    super(options);
  }
}

// Export both Spark and App for backwards compatibility
const App = Spark;

/**
 * Main exports for the Spark Web Framework
 * 
 * @namespace SparkExports
 * @since 1.0.0
 * 
 * @example
 * // ES6 destructuring
 * const { Spark, Router, bodyParser } = require('spark-framework');
 * 
 * @example
 * // CommonJS
 * const Spark = require('spark-framework').Spark;
 * 
 * @example
 * // Access middleware
 * const { middleware } = require('spark-framework');
 * app.use(middleware.bodyParser.json());
 */
module.exports = {
  /**
   * Main Spark application class
   * @type {typeof Spark}
   */
  Spark,
  
  /**
   * Backwards compatibility alias for Spark
   * @deprecated Use Spark instead
   * @type {typeof Spark}
   */
  App, // Deprecated: Use Spark instead
  
  /**
   * Base Application class
   * @type {typeof Application}
   */
  Application,
  
  /**
   * Router class for handling routes
   * @type {typeof Router}
   */
  Router,
  
  /**
   * Context class for request/response handling
   * @type {typeof Context}
   */
  Context,
  
  /**
   * Middleware collection
   * @namespace middleware
   * @property {Function} bodyParser - Body parsing middleware
   * @property {Function} cors - CORS middleware
   * @property {Function} compression - Response compression middleware
   * @property {Function} static - Static file serving middleware
   * @property {Function} session - Session management middleware
   * @property {Function} rateLimit - Rate limiting middleware
   * @property {Function} security - Security headers middleware
   * @property {Function} healthCheck - Health check endpoint middleware
   * @property {Function} metrics - Metrics collection middleware
   * @property {Function} logger - Request logging middleware
   */
  middleware: {
    bodyParser,
    cors,
    compression,
    static: staticFiles,
    session,
    rateLimit,
    security,
    helmet: security.helmet || security, // Alias for security middleware
    healthCheck,
    health: healthCheck, // Alias
    metrics,
    logger,
    cache: require('./middleware/cache'), // Add cache middleware
    compress: compression // Alias for compression
  },
  
  /**
   * Body parsing middleware - Direct export
   * @type {Function}
   */
  bodyParser,
  
  /**
   * CORS middleware - Direct export
   * @type {Function}
   */
  cors,
  
  /**
   * Compression middleware - Direct export
   * @type {Function}
   */
  compression,
  
  /**
   * Static file middleware - Direct export
   * @type {Function}
   */
  static: staticFiles,
  
  /**
   * Session middleware - Direct export
   * @type {Function}
   */
  session,
  
  /**
   * Rate limiting middleware - Direct export
   * @type {Function}
   */
  rateLimit,
  
  /**
   * Security headers middleware - Direct export
   * @type {Function}
   */
  security,
  
  /**
   * Health check middleware - Direct export
   * @type {Function}
   */
  healthCheck,
  
  /**
   * Metrics collection middleware - Direct export
   * @type {Function}
   */
  metrics,
  
  /**
   * Logger middleware - Direct export
   * @type {Function}
   */
  logger,
  
  /**
   * Error handling utilities
   * @namespace errorHandling
   * @property {Function} asyncHandler - Wraps async functions for error handling
   * @property {Function} errorHandler - Global error handler middleware
   * @property {Function} createError - Creates custom errors with status codes
   * @property {Object} errors - Predefined error types
   */
  errorHandling: {
    asyncHandler,
    errorHandler,
    createError,
    errors
  },
  
  /**
   * Utility classes and functions
   * @namespace utils
   * @property {Class} ContextPool - Object pool for Context instances
   * @property {Class} RegexValidator - Regex validation utilities
   * @property {Class} SafeRegexCache - Safe regex caching system
   */
  utils: {
    ContextPool,
    RegexValidator,
    SafeRegexCache
  }
};

/**
 * Default export for ES6 compatibility
 * @type {Object}
 */
module.exports.default = module.exports;