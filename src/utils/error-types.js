/**
 * Custom error classes for Spark framework
 */

class SparkError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'SparkError';
    this.status = status;
    this.statusCode = status;
    if (code) {
      this.code = code;
    }
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      stack: this.stack
    };
  }
}

class ValidationError extends SparkError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

class AuthenticationError extends SparkError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends SparkError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends SparkError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends SparkError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

class RateLimitError extends SparkError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class PayloadTooLargeError extends SparkError {
  constructor(message = 'Payload too large') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
    this.name = 'PayloadTooLargeError';
  }
}

class TimeoutError extends SparkError {
  constructor(message = 'Request timeout') {
    super(message, 408, 'REQUEST_TIMEOUT');
    this.name = 'TimeoutError';
  }
}

class InternalServerError extends SparkError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

class ServiceUnavailableError extends SparkError {
  constructor(message = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

class BadGatewayError extends SparkError {
  constructor(message = 'Bad gateway') {
    super(message, 502, 'BAD_GATEWAY');
    this.name = 'BadGatewayError';
  }
}

class GatewayTimeoutError extends SparkError {
  constructor(message = 'Gateway timeout') {
    super(message, 504, 'GATEWAY_TIMEOUT');
    this.name = 'GatewayTimeoutError';
  }
}

module.exports = {
  SparkError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  PayloadTooLargeError,
  TimeoutError,
  InternalServerError,
  ServiceUnavailableError,
  BadGatewayError,
  GatewayTimeoutError
};