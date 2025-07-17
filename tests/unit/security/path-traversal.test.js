const { describe, it, expect, beforeEach } = require('../../../test-helper');
const staticFiles = require('../../../src/middleware/static');
const path = require('path');

describe('Path Traversal Protection', () => {
  let ctx;
  let next;
  let middleware;
  
  beforeEach(() => {
    const testRoot = path.join(__dirname, '../../fixtures/static');
    middleware = staticFiles(testRoot);
    
    next = jest.fn();
    ctx = {
      method: 'GET',
      path: '/test.txt',
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
  });

  it('should block path traversal attempts with ../', async () => {
    ctx.path = '/../../../etc/passwd';
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block path traversal attempts with encoded ../', async () => {
    ctx.path = '/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd';
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block null byte injection', async () => {
    ctx.path = '/test.txt%00.evil';
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block Windows path traversal attempts', async () => {
    ctx.path = '/..\\..\\..\\windows\\system32\\drivers\\etc\\hosts';
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle malformed URL encoding gracefully', async () => {
    ctx.path = '/test%';
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(400);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Invalid URL encoding' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow legitimate file requests', async () => {
    ctx.path = '/test.txt';
    
    // Mock file system response
    const fs = require('fs');
    const originalStat = fs.stat;
    const originalReadFile = fs.readFile;
    
    fs.stat = jest.fn().mockImplementation((path, cb) => {
      cb(null, { isFile: () => true, isDirectory: () => false, size: 100, mtime: new Date() });
    });
    
    fs.readFile = jest.fn().mockImplementation((path, cb) => {
      cb(null, 'test content');
    });
    
    await middleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(200);
    expect(ctx.send).toHaveBeenCalledWith('test content');
    
    // Restore original functions
    fs.stat = originalStat;
    fs.readFile = originalReadFile;
  });

  it('should ensure resolved path is within root directory', async () => {
    const testRoot = '/var/www/html';
    const maliciousMiddleware = staticFiles(testRoot);
    
    ctx.path = '/../../../../etc/passwd';
    
    await maliciousMiddleware(ctx, next);
    
    expect(ctx.status).toHaveBeenCalledWith(403);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });
});