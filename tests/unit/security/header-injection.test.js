const { describe, it, expect, beforeEach } = require('../../../test-helper');
const Context = require('../../../src/core/context');

describe('Header Injection Protection', () => {
  let ctx;
  let req;
  let res;
  let app;
  
  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      headers: { host: 'localhost' },
      connection: { encrypted: false }
    };
    
    res = {
      setHeader: jest.fn(),
      statusCode: 200,
      end: jest.fn()
    };
    
    app = {};
    
    ctx = new Context(req, res, app);
  });

  describe('Header Value Validation', () => {
    it('should reject headers with CRLF characters', () => {
      expect(() => {
        ctx.set('X-Test', 'value\r\nX-Injected: evil');
      }).toThrow('Header value cannot contain CRLF or null characters');
    });

    it('should reject headers with null bytes', () => {
      expect(() => {
        ctx.set('X-Test', 'value\x00evil');
      }).toThrow('Header value cannot contain CRLF or null characters');
    });

    it('should reject headers that are too long', () => {
      const longValue = 'a'.repeat(8193);
      
      expect(() => {
        ctx.set('X-Test', longValue);
      }).toThrow('Header value too long (max 8192 characters)');
    });

    it('should allow legitimate header values', () => {
      expect(() => {
        ctx.set('X-Test', 'legitimate-value');
      }).not.toThrow();
    });
  });

  describe('Header Name Validation', () => {
    it('should reject invalid header names', () => {
      expect(() => {
        ctx.set('X-Test\r\n', 'value');
      }).toThrow('Invalid header name');
    });

    it('should reject empty header names', () => {
      expect(() => {
        ctx.set('', 'value');
      }).toThrow('Header name must be a non-empty string');
    });

    it('should reject non-string header names', () => {
      expect(() => {
        ctx.set(null, 'value');
      }).toThrow('Header name must be a non-empty string');
    });

    it('should allow valid header names', () => {
      expect(() => {
        ctx.set('X-Valid-Header', 'value');
      }).not.toThrow();
    });
  });

  describe('Cookie Injection Protection', () => {
    it('should reject cookie names with control characters', () => {
      expect(() => {
        ctx.setCookie('test\x00', 'value');
      }).toThrow('Cookie name cannot contain control characters');
    });

    it('should reject cookie values with control characters', () => {
      expect(() => {
        ctx.setCookie('test', 'value\x00');
      }).toThrow('Cookie value cannot contain control characters');
    });

    it('should reject invalid cookie names', () => {
      expect(() => {
        ctx.setCookie('test\r\n', 'value');
      }).toThrow('Invalid cookie name');
    });

    it('should allow legitimate cookies', () => {
      expect(() => {
        ctx.setCookie('sessionId', 'abc123');
      }).not.toThrow();
    });

    it('should validate SameSite attribute', () => {
      expect(() => {
        ctx.setCookie('test', 'value', { sameSite: 'invalid' });
      }).toThrow('Invalid SameSite value');
    });

    it('should allow valid SameSite values', () => {
      expect(() => {
        ctx.setCookie('test', 'value', { sameSite: 'strict' });
      }).not.toThrow();
      
      expect(() => {
        ctx.setCookie('test', 'value', { sameSite: 'lax' });
      }).not.toThrow();
      
      expect(() => {
        ctx.setCookie('test', 'value', { sameSite: 'none' });
      }).not.toThrow();
    });
  });

  describe('Response Header Security', () => {
    it('should properly encode cookie values', () => {
      ctx.setCookie('test', 'value with spaces');
      
      const cookieHeader = ctx.responseHeaders['set-cookie'];
      expect(cookieHeader).toContain('test=value%20with%20spaces');
    });

    it('should handle multiple cookies', () => {
      ctx.setCookie('cookie1', 'value1');
      ctx.setCookie('cookie2', 'value2');
      
      const cookieHeader = ctx.responseHeaders['set-cookie'];
      expect(Array.isArray(cookieHeader)).toBe(true);
      expect(cookieHeader.length).toBe(2);
    });

    it('should preserve header case sensitivity', () => {
      ctx.set('X-Custom-Header', 'value');
      
      expect(ctx.responseHeaders['x-custom-header']).toBe('value');
    });
  });
});