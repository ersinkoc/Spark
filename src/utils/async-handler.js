/**
 * Wraps async route handlers to properly catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function that catches errors
 */
function asyncHandler(fn) {
  return (ctx, next) => {
    const result = fn(ctx, next);
    
    // If it's a promise, catch any errors
    if (result && typeof result.then === 'function') {
      return result.catch((error) => {
        // Pass error to the next middleware
        return next(error);
      });
    }
    
    return result;
  };
}

/**
 * Wraps all methods of a router or controller
 * @param {Object} target - Object with methods to wrap
 * @returns {Object} Object with wrapped methods
 */
function wrapAsync(target) {
  const wrapped = {};
  
  for (const key in target) {
    if (typeof target[key] === 'function') {
      wrapped[key] = asyncHandler(target[key]);
    } else {
      wrapped[key] = target[key];
    }
  }
  
  return wrapped;
}

/**
 * Error handler middleware that can work as both regular middleware and error handler
 * @param {Error|Context} errOrCtx - Error object or Context (when used as regular middleware)
 * @param {Context|Function} ctxOrNext - Context or next function
 * @param {Function} [next] - Next middleware function
 */
function errorHandler(errOrCtx, ctxOrNext, next) {
  // Check if this is being used as error handler (3 args) or regular middleware (2 args)
  if (next && typeof next === 'function') {
    // This is an error handler (err, ctx, next)
    const err = errOrCtx;
    const ctx = ctxOrNext;
    
    // Skip if response already sent
    if (ctx.responded) {
      return;
    }
    
    // Log error for debugging
    console.error('Error handler caught:', err);
    
    // Set status code
    const status = err.status || err.statusCode || 500;
    ctx.status(status);
    
    handleErrorResponse(err, ctx, status);
  } else {
    // This is regular middleware (ctx, next)
    const ctx = errOrCtx;
    const nextFn = ctxOrNext;
    
    // Just pass through - this shouldn't normally happen
    return nextFn();
  }
}

function handleErrorResponse(err, ctx, status) {
  // Prepare error response
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    status: status
  };
  
  // Add stack trace in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
  }
  
  // Add any additional error properties
  if (err.code) {
    errorResponse.code = err.code;
  }
  
  if (err.details) {
    errorResponse.details = err.details;
  }
  
  // Send error response
  ctx.json(errorResponse);
}

/**
 * Creates a custom error with status code
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @returns {Error} Custom error object
 */
function createError(message, status = 500, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
}

/**
 * Common HTTP errors
 */
const errors = {
  badRequest: (message = 'Bad Request') => createError(message, 400, 'BAD_REQUEST'),
  unauthorized: (message = 'Unauthorized') => createError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') => createError(message, 403, 'FORBIDDEN'),
  notFound: (message = 'Not Found') => createError(message, 404, 'NOT_FOUND'),
  methodNotAllowed: (message = 'Method Not Allowed') => createError(message, 405, 'METHOD_NOT_ALLOWED'),
  conflict: (message = 'Conflict') => createError(message, 409, 'CONFLICT'),
  gone: (message = 'Gone') => createError(message, 410, 'GONE'),
  unprocessableEntity: (message = 'Unprocessable Entity') => createError(message, 422, 'UNPROCESSABLE_ENTITY'),
  tooManyRequests: (message = 'Too Many Requests') => createError(message, 429, 'TOO_MANY_REQUESTS'),
  internalServerError: (message = 'Internal Server Error') => createError(message, 500, 'INTERNAL_SERVER_ERROR'),
  notImplemented: (message = 'Not Implemented') => createError(message, 501, 'NOT_IMPLEMENTED'),
  badGateway: (message = 'Bad Gateway') => createError(message, 502, 'BAD_GATEWAY'),
  serviceUnavailable: (message = 'Service Unavailable') => createError(message, 503, 'SERVICE_UNAVAILABLE'),
  gatewayTimeout: (message = 'Gateway Timeout') => createError(message, 504, 'GATEWAY_TIMEOUT')
};

module.exports = {
  asyncHandler,
  wrapAsync,
  errorHandler,
  createError,
  errors
};