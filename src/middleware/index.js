'use strict';

/**
 * Middleware exports for @oxog/spark
 * Aggregates all built-in middleware for convenient importing
 */

module.exports = {
  bodyParser: require('./body-parser'),
  cache: require('./cache'),
  compression: require('./compression'),
  cors: require('./cors'),
  health: require('./health'),
  healthCheck: require('./health'), // alias
  logger: require('./logger'),
  metrics: require('./metrics'),
  rateLimit: require('./rate-limit'),
  security: require('./security'),
  helmet: require('./security'), // alias for security
  session: require('./session'),
  static: require('./static'),
  serveStatic: require('./static') // alias
};