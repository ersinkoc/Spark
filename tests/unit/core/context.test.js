const assert = require('assert');
const http = require('http');
const Context = require('../../../src/core/context');
const TestHelper = require('../../test-helper');

describe('Context', () => {
  let ctx;
  let req;
  let res;
  
  beforeEach(() => {
    req = {
      url: '/test?foo=bar',
      method: 'GET',
      headers: {
        'host': 'localhost:3000',
        'user-agent': 'test-agent',
        'cookie': 'session=abc123; theme=dark',
        'content-type': 'application/json'
      },
      connection: {
        encrypted: false,
        remoteAddress: '127.0.0.1'
      },
      socket: {
        remoteAddress: '127.0.0.1'
      }
    };
    
    res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(data) {
        this.data = data;
        this.ended = true;
      }
    };
    
    ctx = new Context(req, res, {});
  });
  
  describe('URL Parsing', () => {
    it('should parse URL correctly', () => {
      assert.strictEqual(ctx.path, '/test');
      assert.strictEqual(ctx.originalUrl, '/test?foo=bar');
      assert.deepStrictEqual(ctx.query, { foo: 'bar' });
    });
    
    it('should handle malformed URLs', () => {
      req.url = '/%%%%%';
      const badCtx = new Context(req, res, {});
      assert.strictEqual(badCtx.path, '/');
    });
    
    it('should parse complex query strings', () => {
      req.url = '/test?a=1&b=2&c=3&d=hello%20world';
      const complexCtx = new Context(req, res, {});
      assert.deepStrictEqual(complexCtx.query, {
        a: '1',
        b: '2',
        c: '3',
        d: 'hello world'
      });
    });
  });
  
  describe('Headers', () => {
    it('should get request headers', () => {
      assert.strictEqual(ctx.get('user-agent'), 'test-agent');
      assert.strictEqual(ctx.get('User-Agent'), 'test-agent');
      assert.strictEqual(ctx.get('nonexistent'), undefined);
    });
    
    it('should set response headers with validation', () => {
      ctx.set('Content-Type', 'text/html');
      assert.strictEqual(ctx.responseHeaders['content-type'], 'text/html');
    });
    
    it('should reject invalid header names', () => {
      assert.throws(() => ctx.set('', 'value'), /Header name must be a non-empty string/);
      assert.throws(() => ctx.set('bad header', 'value'), /Invalid header name/);
      assert.throws(() => ctx.set('bad\nheader', 'value'), /Invalid header name/);
    });
    
    it('should reject invalid header values', () => {
      assert.throws(() => ctx.set('test', 'bad\r\nvalue'), /cannot contain CRLF/);
    });
    
    it('should remove headers', () => {
      ctx.set('X-Custom', 'value');
      ctx.removeHeader('X-Custom');
      assert.strictEqual(ctx.responseHeaders['x-custom'], undefined);
    });
  });
  
  describe('Cookies', () => {
    it('should parse cookies correctly', () => {
      assert.strictEqual(ctx.cookies.session, 'abc123');
      assert.strictEqual(ctx.cookies.theme, 'dark');
    });
    
    it('should handle malformed cookies', () => {
      req.headers.cookie = 'valid=value; bad=%ZZ; good=test';
      const cookieCtx = new Context(req, res, {});
      assert.strictEqual(cookieCtx.cookies.valid, 'value');
      assert.strictEqual(cookieCtx.cookies.bad, undefined);
      assert.strictEqual(cookieCtx.cookies.good, 'test');
    });
    
    it('should set cookies with options', () => {
      ctx.setCookie('test', 'value', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 3600,
        path: '/',
        domain: '.example.com'
      });
      
      const setCookie = ctx.responseHeaders['set-cookie'];
      assert(Array.isArray(setCookie));
      const cookie = setCookie[0];
      assert(cookie.includes('test=value'));
      assert(cookie.includes('HttpOnly'));
      assert(cookie.includes('Secure'));
      assert(cookie.includes('SameSite=Strict'));
      assert(cookie.includes('Max-Age=3600'));
      assert(cookie.includes('Path=/'));
      assert(cookie.includes('Domain=.example.com'));
    });
    
    it('should validate cookie names', () => {
      assert.throws(() => ctx.setCookie('', 'value'), /Cookie name must be a non-empty string/);
      assert.throws(() => ctx.setCookie('bad name', 'value'), /Invalid cookie name/);
      assert.throws(() => ctx.setCookie('bad;name', 'value'), /Invalid cookie name/);
    });
    
    it('should validate SameSite values', () => {
      assert.throws(() => ctx.setCookie('test', 'value', { sameSite: 'invalid' }), 
        /Invalid SameSite value/);
    });
    
    it('should clear cookies', () => {
      ctx.clearCookie('session', { path: '/' });
      const setCookie = ctx.responseHeaders['set-cookie'];
      assert(setCookie[0].includes('session='));
      assert(setCookie[0].includes('Max-Age=0'));
      assert(setCookie[0].includes('Expires=Thu, 01 Jan 1970'));
    });
  });
  
  describe('Status Codes', () => {
    it('should set valid status codes', () => {
      ctx.status(404);
      assert.strictEqual(ctx.statusCode, 404);
    });
    
    it('should reject invalid status codes', () => {
      assert.throws(() => ctx.status(99), /Invalid status code/);
      assert.throws(() => ctx.status(600), /Invalid status code/);
      assert.throws(() => ctx.status('200'), /Invalid status code/);
      assert.throws(() => ctx.status(NaN), /Invalid status code/);
    });
    
    it('should chain status method', () => {
      const result = ctx.status(201);
      assert.strictEqual(result, ctx);
    });
  });
  
  describe('Response Methods', () => {
    it('should send JSON response', () => {
      ctx.json({ message: 'test' });
      assert.strictEqual(ctx.responseHeaders['content-type'], 'application/json');
      assert.strictEqual(res.data, '{"message":"test"}');
      assert(ctx.responded);
    });
    
    it('should send text response', () => {
      ctx.text('Hello World');
      assert.strictEqual(ctx.responseHeaders['content-type'], 'text/plain');
      assert.strictEqual(res.data, 'Hello World');
    });
    
    it('should send HTML response', () => {
      ctx.html('<h1>Hello</h1>');
      assert.strictEqual(ctx.responseHeaders['content-type'], 'text/html');
      assert.strictEqual(res.data, '<h1>Hello</h1>');
    });
    
    it('should handle Buffer responses', () => {
      const buffer = Buffer.from('binary data');
      ctx.send(buffer);
      assert.strictEqual(res.data, buffer);
    });
    
    it('should prevent multiple responses', () => {
      ctx.send('first');
      ctx.send('second');
      assert.strictEqual(res.data, 'first');
    });
    
    it('should handle empty responses', () => {
      ctx.end();
      assert.strictEqual(res.data, undefined);
      assert(res.ended);
    });
    
    it('should redirect', () => {
      ctx.redirect('/login', 301);
      assert.strictEqual(ctx.statusCode, 301);
      assert.strictEqual(ctx.responseHeaders['location'], '/login');
      assert(ctx.responded);
    });
  });
  
  describe('Request Properties', () => {
    it('should detect secure connections', () => {
      assert.strictEqual(ctx.secure(), false);
      req.connection.encrypted = true;
      assert.strictEqual(ctx.secure(), true);
    });
    
    it('should detect XHR requests', () => {
      assert.strictEqual(ctx.xhr(), false);
      req.headers['x-requested-with'] = 'XMLHttpRequest';
      assert.strictEqual(ctx.xhr(), true);
    });
    
    it('should get IP address', () => {
      assert.strictEqual(ctx.ip(), '127.0.0.1');
      
      req.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1';
      assert.strictEqual(ctx.ip(), '10.0.0.1, 192.168.1.1');
    });
    
    it('should get IP list', () => {
      req.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1, 172.16.0.1';
      assert.deepStrictEqual(ctx.ips(), ['10.0.0.1', '192.168.1.1', '172.16.0.1']);
    });
    
    it('should get protocol', () => {
      assert.strictEqual(ctx.protocol(), 'http');
      req.connection.encrypted = true;
      assert.strictEqual(ctx.protocol(), 'https');
    });
    
    it('should parse host and port', () => {
      assert.strictEqual(ctx.host(), 'localhost:3000');
      assert.strictEqual(ctx.hostname(), 'localhost');
      assert.strictEqual(ctx.port(), 3000);
      
      req.headers.host = 'example.com';
      assert.strictEqual(ctx.port(), 80);
      
      req.connection.encrypted = true;
      assert.strictEqual(ctx.port(), 443);
    });
    
    it('should extract subdomains', () => {
      req.headers.host = 'api.v2.example.com';
      assert.deepStrictEqual(ctx.subdomains(), ['v2', 'api']);
    });
  });
  
  describe('Content Type', () => {
    it('should check content type', () => {
      assert(ctx.is('json'));
      assert(ctx.is('application/json'));
      assert(!ctx.is('xml'));
      
      req.headers['content-type'] = 'text/html; charset=utf-8';
      assert(ctx.is('html'));
      assert(ctx.is('text/html'));
    });
    
    it('should get content type and charset', () => {
      assert.strictEqual(ctx.type(), 'application/json');
      assert.strictEqual(ctx.charset(), '');
      
      req.headers['content-type'] = 'text/html; charset=utf-8';
      assert.strictEqual(ctx.type(), 'text/html');
      assert.strictEqual(ctx.charset(), 'utf-8');
    });
    
    it('should check accepted types', () => {
      req.headers.accept = 'text/html, application/json';
      assert.strictEqual(ctx.accepts(['json', 'html']), 'json');
      assert.strictEqual(ctx.accepts('xml'), false);
      
      req.headers.accept = '*/*';
      assert.strictEqual(ctx.accepts('anything'), 'anything');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle missing headers gracefully', () => {
      delete req.headers.host;
      delete req.headers.cookie;
      const edgeCtx = new Context(req, res, {});
      
      assert.strictEqual(edgeCtx.host(), 'localhost');
      assert.deepStrictEqual(edgeCtx.cookies, {});
    });
    
    it('should handle toString and toJSON', () => {
      const str = ctx.toString();
      assert.strictEqual(str, 'GET /test?foo=bar');
      
      const json = ctx.toJSON();
      assert.strictEqual(json.method, 'GET');
      assert.strictEqual(json.url, '/test?foo=bar');
      assert.deepStrictEqual(json.query, { foo: 'bar' });
    });
    
    it('should handle freshness checks', () => {
      assert(ctx.fresh());
      assert(!ctx.stale());
      
      ctx.method = 'POST';
      assert(!ctx.fresh());
      assert(ctx.stale());
    });
    
    it('should get content length', () => {
      assert.strictEqual(ctx.length(), 0);
      
      req.headers['content-length'] = '1024';
      assert.strictEqual(ctx.length(), 1024);
    });
  });
  
  describe('URL Encoding Edge Cases', () => {
    it('should handle unicode in URLs', () => {
      req.url = '/test/你好/世界?name=测试';
      const unicodeCtx = new Context(req, res, {});
      assert(unicodeCtx.path.includes('你好'));
      assert(unicodeCtx.query.name === '测试');
    });
    
    it('should handle special characters in query', () => {
      req.url = '/test?email=test@example.com&url=https://example.com';
      const specialCtx = new Context(req, res, {});
      assert.strictEqual(specialCtx.query.email, 'test@example.com');
      assert.strictEqual(specialCtx.query.url, 'https://example.com');
    });
  });
});

module.exports = describe;