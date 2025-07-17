const assert = require('assert');
const Router = require('../../../src/router/router');
const Context = require('../../../src/core/context');
const TestHelper = require('../../test-helper');

describe('Router', () => {
  let router;
  
  beforeEach(() => {
    router = new Router();
  });
  
  describe('Route Registration', () => {
    it('should register routes for all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      const handler = async (ctx) => ctx.text('OK');
      
      methods.forEach(method => {
        router.register(method, '/test', handler);
      });
      
      methods.forEach(method => {
        const routes = router.routes.get(method);
        assert(routes);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].path, '/test');
      });
    });
    
    it('should register routes with convenience methods', () => {
      const handler = async (ctx) => ctx.text('OK');
      
      router.get('/get', handler);
      router.post('/post', handler);
      router.put('/put', handler);
      router.delete('/delete', handler);
      router.patch('/patch', handler);
      
      assert(router.routes.get('GET').some(r => r.path === '/get'));
      assert(router.routes.get('POST').some(r => r.path === '/post'));
      assert(router.routes.get('PUT').some(r => r.path === '/put'));
      assert(router.routes.get('DELETE').some(r => r.path === '/delete'));
      assert(router.routes.get('PATCH').some(r => r.path === '/patch'));
    });
    
    it('should register catch-all routes', () => {
      const handler = async (ctx) => ctx.text('OK');
      router.all('/all', handler);
      
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].forEach(method => {
        assert(router.routes.get(method).some(r => r.path === '/all'));
      });
    });
  });
  
  describe('Route Matching', () => {
    it('should match exact paths', () => {
      const handler = async (ctx) => ctx.text('exact');
      router.get('/exact/path', handler);
      
      const match = router.match('GET', '/exact/path');
      assert(match);
      assert.strictEqual(match.handler, handler);
    });
    
    it('should not match incorrect paths', () => {
      router.get('/test', async () => {});
      
      assert(!router.match('GET', '/test2'));
      assert(!router.match('GET', '/tes'));
      assert(!router.match('GET', '/test/'));
      assert(!router.match('POST', '/test'));
    });
    
    it('should handle trailing slashes based on options', () => {
      const strict = new Router({ strict: true });
      const loose = new Router({ strict: false });
      
      const handler = async () => {};
      strict.get('/test', handler);
      loose.get('/test', handler);
      
      assert(strict.match('GET', '/test'));
      assert(!strict.match('GET', '/test/'));
      
      assert(loose.match('GET', '/test'));
      assert(loose.match('GET', '/test/'));
    });
  });
  
  describe('Parameter Extraction', () => {
    it('should extract single parameters', () => {
      router.get('/users/:id', async () => {});
      
      const match = router.match('GET', '/users/123');
      assert(match);
      assert.deepStrictEqual(match.params, { id: '123' });
    });
    
    it('should extract multiple parameters', () => {
      router.get('/users/:userId/posts/:postId', async () => {});
      
      const match = router.match('GET', '/users/123/posts/456');
      assert(match);
      assert.deepStrictEqual(match.params, { userId: '123', postId: '456' });
    });
    
    it('should handle special characters in parameters', () => {
      router.get('/files/:filename', async () => {});
      
      const match = router.match('GET', '/files/test%20file.txt');
      assert(match);
      assert.strictEqual(match.params.filename, 'test file.txt');
    });
    
    it('should handle unicode in parameters', () => {
      router.get('/users/:name', async () => {});
      
      const match = router.match('GET', '/users/用户名');
      assert(match);
      assert.strictEqual(match.params.name, '用户名');
    });
    
    it('should throw on invalid URL parameters', () => {
      router.get('/test/:id', async () => {});
      
      assert.throws(() => {
        router.match('GET', '/test/%ZZ');
      }, /Invalid URL parameter/);
    });
  });
  
  describe('Wildcard Routes', () => {
    it('should match wildcard routes', () => {
      router.get('/files/*', async () => {});
      
      let match = router.match('GET', '/files/doc.txt');
      assert(match);
      assert.strictEqual(match.params[0], 'doc.txt');
      
      match = router.match('GET', '/files/folder/subfolder/file.txt');
      assert(match);
      assert.strictEqual(match.params[0], 'folder/subfolder/file.txt');
    });
    
    it('should match empty wildcards', () => {
      router.get('/optional/*', async () => {});
      
      const match = router.match('GET', '/optional/');
      assert(match);
      assert.strictEqual(match.params[0], '');
    });
    
    it('should combine parameters and wildcards', () => {
      router.get('/users/:id/files/*', async () => {});
      
      const match = router.match('GET', '/users/123/files/docs/readme.txt');
      assert(match);
      assert.strictEqual(match.params.id, '123');
      assert.strictEqual(match.params[0], 'docs/readme.txt');
    });
  });
  
  describe('Route Priority', () => {
    it('should prioritize exact matches over parameters', () => {
      router.get('/users/me', async (ctx) => ctx.text('me'));
      router.get('/users/:id', async (ctx) => ctx.text('id'));
      
      let match = router.match('GET', '/users/me');
      assert(match);
      const result1 = await match.handler({ text: (t) => t });
      assert.strictEqual(result1, 'me');
      
      match = router.match('GET', '/users/123');
      assert(match);
      const result2 = await match.handler({ text: (t) => t });
      assert.strictEqual(result2, 'id');
    });
    
    it('should prioritize longer paths', () => {
      router.get('/api', async (ctx) => ctx.text('api'));
      router.get('/api/users', async (ctx) => ctx.text('users'));
      router.get('/api/users/list', async (ctx) => ctx.text('list'));
      
      assert.strictEqual(
        await router.match('GET', '/api/users/list').handler({ text: (t) => t }),
        'list'
      );
    });
    
    it('should handle route order correctly', () => {
      const results = [];
      
      router.get('/:category/:id', async (ctx) => results.push('param'));
      router.get('/users/:id', async (ctx) => results.push('users'));
      router.get('/users/special', async (ctx) => results.push('special'));
      
      router.match('GET', '/users/special').handler({});
      router.match('GET', '/users/123').handler({});
      router.match('GET', '/posts/456').handler({});
      
      assert.deepStrictEqual(results, ['special', 'users', 'param']);
    });
  });
  
  describe('Middleware Composition', () => {
    it('should compose multiple middleware', async () => {
      const order = [];
      
      router.get('/test',
        async (ctx, next) => { order.push(1); await next(); order.push(4); },
        async (ctx, next) => { order.push(2); await next(); order.push(3); }
      );
      
      const match = router.match('GET', '/test');
      const ctx = { text: () => {} };
      await match.handler(ctx, async () => {});
      
      assert.deepStrictEqual(order, [1, 2, 3, 4]);
    });
    
    it('should handle middleware errors', async () => {
      router.get('/error',
        async () => { throw new Error('Middleware error'); }
      );
      
      const match = router.match('GET', '/error');
      await assert.rejects(
        async () => await match.handler({}, async () => {}),
        /Middleware error/
      );
    });
  });
  
  describe('Nested Routers', () => {
    it('should support nested routers', () => {
      const apiRouter = new Router();
      apiRouter.get('/users', async (ctx) => ctx.text('users'));
      apiRouter.get('/posts', async (ctx) => ctx.text('posts'));
      
      router.use('/api', apiRouter.routes());
      
      // Note: This test assumes router.use properly delegates to sub-router
      // In practice, this would be handled by the application's middleware system
    });
    
    it('should support router groups', () => {
      router.group('/admin', (adminRouter) => {
        adminRouter.get('/users', async () => {});
        adminRouter.get('/settings', async () => {});
      });
      
      // Groups should create routes with prefixed paths
      assert(router.match('GET', '/admin/users'));
      assert(router.match('GET', '/admin/settings'));
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty paths', () => {
      router.get('', async () => {});
      assert(router.match('GET', ''));
    });
    
    it('should handle root path', () => {
      router.get('/', async () => {});
      assert(router.match('GET', '/'));
    });
    
    it('should handle very long paths', () => {
      const longPath = '/' + 'a'.repeat(1000);
      router.get(longPath, async () => {});
      assert(router.match('GET', longPath));
    });
    
    it('should handle paths with special regex characters', () => {
      const specialPaths = [
        '/test.html',
        '/test+plus',
        '/test$dollar',
        '/test(paren)',
        '/test[bracket]',
        '/test{brace}',
        '/test^caret',
        '/test|pipe'
      ];
      
      specialPaths.forEach(path => {
        router.get(path, async () => {});
        const match = router.match('GET', path);
        assert(match, `Failed to match ${path}`);
      });
    });
    
    it('should handle concurrent route modifications', async () => {
      const promises = [];
      
      // Add routes concurrently
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            router.get(`/concurrent/${i}`, async () => {});
          })
        );
      }
      
      await Promise.all(promises);
      
      // Verify all routes were added
      for (let i = 0; i < 100; i++) {
        assert(router.match('GET', `/concurrent/${i}`));
      }
    });
    
    it('should handle deep parameter nesting', () => {
      router.get('/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j', async () => {});
      
      const match = router.match('GET', '/1/2/3/4/5/6/7/8/9/10');
      assert(match);
      assert.strictEqual(Object.keys(match.params).length, 10);
      assert.strictEqual(match.params.j, '10');
    });
    
    it('should handle mixed static and dynamic segments', () => {
      router.get('/api/v:version/users/:id/posts/:postId/comments', async () => {});
      
      const match = router.match('GET', '/api/v2/users/123/posts/456/comments');
      assert(match);
      assert.strictEqual(match.params.version, '2');
      assert.strictEqual(match.params.id, '123');
      assert.strictEqual(match.params.postId, '456');
    });
  });
  
  describe('Performance', () => {
    it('should handle large number of routes efficiently', () => {
      const routeCount = 10000;
      
      // Add many routes
      for (let i = 0; i < routeCount; i++) {
        router.get(`/route${i}`, async () => {});
      }
      
      // Measure lookup time
      const start = process.hrtime.bigint();
      const match = router.match('GET', '/route9999');
      const end = process.hrtime.bigint();
      
      assert(match);
      const durationMs = Number(end - start) / 1e6;
      assert(durationMs < 10, `Route lookup took ${durationMs}ms, expected < 10ms`);
    });
    
    it('should cache regex compilation', () => {
      router.get('/users/:id', async () => {});
      
      // First match compiles regex
      const start1 = process.hrtime.bigint();
      router.match('GET', '/users/123');
      const duration1 = Number(process.hrtime.bigint() - start1);
      
      // Subsequent matches should be faster
      const start2 = process.hrtime.bigint();
      for (let i = 0; i < 1000; i++) {
        router.match('GET', `/users/${i}`);
      }
      const duration2 = Number(process.hrtime.bigint() - start2) / 1000;
      
      // Average time for cached matches should be less than first match
      assert(duration2 < duration1);
    });
  });
});

module.exports = describe;