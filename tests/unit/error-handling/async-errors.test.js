const { describe, it, expect, beforeEach } = require('../../../test-helper');
const { asyncHandler, errorHandler, createError, errors } = require('../../../src/utils/async-handler');

describe('Async Error Handling', () => {
  let ctx;
  let next;
  
  beforeEach(() => {
    ctx = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      responded: false
    };
    
    next = jest.fn();
  });

  describe('asyncHandler', () => {
    it('should handle async functions that resolve', async () => {
      const asyncFn = async (ctx, next) => {
        ctx.body = 'success';
        return 'result';
      };
      
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(ctx, next);
      
      expect(ctx.body).toBe('success');
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch async function errors', async () => {
      const asyncFn = async (ctx, next) => {
        throw new Error('Async error');
      };
      
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(ctx, next);
      
      expect(next).toHaveBeenCalledWith(new Error('Async error'));
    });

    it('should handle promise rejections', async () => {
      const asyncFn = (ctx, next) => {
        return Promise.reject(new Error('Promise rejection'));
      };
      
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(ctx, next);
      
      expect(next).toHaveBeenCalledWith(new Error('Promise rejection'));
    });

    it('should handle sync functions without issues', async () => {
      const syncFn = (ctx, next) => {
        ctx.body = 'sync success';
      };
      
      const wrappedFn = asyncHandler(syncFn);
      
      await wrappedFn(ctx, next);
      
      expect(ctx.body).toBe('sync success');
    });

    it('should handle sync functions that throw', async () => {
      const syncFn = (ctx, next) => {
        throw new Error('Sync error');
      };
      
      const wrappedFn = asyncHandler(syncFn);
      
      await expect(wrappedFn(ctx, next)).rejects.toThrow('Sync error');
    });
  });

  describe('errorHandler', () => {
    it('should handle basic errors', () => {
      const error = new Error('Test error');
      
      errorHandler(error, ctx, next);
      
      expect(ctx.status).toHaveBeenCalledWith(500);
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Test error',
        status: 500
      });
    });

    it('should handle errors with status codes', () => {
      const error = new Error('Not found');
      error.status = 404;
      
      errorHandler(error, ctx, next);
      
      expect(ctx.status).toHaveBeenCalledWith(404);
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Not found',
        status: 404
      });
    });

    it('should handle errors with custom codes', () => {
      const error = new Error('Validation failed');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      
      errorHandler(error, ctx, next);
      
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        status: 400,
        code: 'VALIDATION_ERROR'
      });
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      errorHandler(error, ctx, next);
      
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Test error',
        status: 500,
        stack: 'Error stack trace'
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      errorHandler(error, ctx, next);
      
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Test error',
        status: 500
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip if response already sent', () => {
      ctx.responded = true;
      
      const error = new Error('Test error');
      
      errorHandler(error, ctx, next);
      
      expect(ctx.status).not.toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });

    it('should handle error details', () => {
      const error = new Error('Validation error');
      error.status = 400;
      error.details = { field: 'email', message: 'Invalid format' };
      
      errorHandler(error, ctx, next);
      
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Validation error',
        status: 400,
        details: { field: 'email', message: 'Invalid format' }
      });
    });
  });

  describe('createError', () => {
    it('should create error with default status', () => {
      const error = createError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.code).toBeNull();
    });

    it('should create error with custom status', () => {
      const error = createError('Not found', 404);
      
      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
    });

    it('should create error with custom code', () => {
      const error = createError('Validation failed', 400, 'VALIDATION_ERROR');
      
      expect(error.message).toBe('Validation failed');
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('errors object', () => {
    it('should create badRequest error', () => {
      const error = errors.badRequest('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should create unauthorized error', () => {
      const error = errors.unauthorized();
      
      expect(error.message).toBe('Unauthorized');
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create forbidden error', () => {
      const error = errors.forbidden('Access denied');
      
      expect(error.message).toBe('Access denied');
      expect(error.status).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create notFound error', () => {
      const error = errors.notFound('Resource not found');
      
      expect(error.message).toBe('Resource not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create tooManyRequests error', () => {
      const error = errors.tooManyRequests('Rate limit exceeded');
      
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.status).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should create internalServerError', () => {
      const error = errors.internalServerError('Server error');
      
      expect(error.message).toBe('Server error');
      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Integration with middleware', () => {
    it('should work with async middleware', async () => {
      const middleware = asyncHandler(async (ctx, next) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async middleware error');
      });
      
      await middleware(ctx, next);
      
      expect(next).toHaveBeenCalledWith(new Error('Async middleware error'));
    });

    it('should work with promise-based middleware', async () => {
      const middleware = asyncHandler((ctx, next) => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Promise middleware error'));
          }, 10);
        });
      });
      
      await middleware(ctx, next);
      
      expect(next).toHaveBeenCalledWith(new Error('Promise middleware error'));
    });

    it('should handle multiple error types', async () => {
      const errors = [
        new Error('Generic error'),
        errors.badRequest('Bad request'),
        errors.unauthorized(),
        errors.internalServerError('Server error')
      ];
      
      for (const error of errors) {
        const middleware = asyncHandler(async (ctx, next) => {
          throw error;
        });
        
        await middleware(ctx, next);
        
        expect(next).toHaveBeenCalledWith(error);
      }
    });
  });
});