'use strict';

/**
 * @fileoverview Router class for handling HTTP routes in Spark Framework
 * @author Spark Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

const Layer = require('./layer');
const Route = require('./route');
const { SafeRegexCache } = require('../utils/regex-validator');

/**
 * Router class for managing HTTP routes and middleware
 * 
 * The Router class provides route registration, path matching, and middleware execution.
 * It supports dynamic route parameters, nested routers, route grouping, and various
 * HTTP methods. Routes are matched using optimized regular expressions with caching.
 * 
 * @class Router
 * @since 1.0.0
 * 
 * @example
 * // Basic usage
 * const router = new Router();
 * 
 * router.get('/users', (ctx) => {
 *   ctx.json({ users: [] });
 * });
 * 
 * router.post('/users', (ctx) => {
 *   const user = ctx.body;
 *   ctx.status(201).json({ id: 123, ...user });
 * });
 * 
 * @example
 * // With parameters and middleware
 * router.get('/users/:id', authenticate, (ctx) => {
 *   const userId = ctx.params.id;
 *   ctx.json({ id: userId, name: 'User' });
 * });
 * 
 * @example
 * // Route grouping
 * router.group('/api/v1', (api) => {
 *   api.get('/users', getUsersHandler);
 *   api.post('/users', createUserHandler);
 * });
 */
class Router {
  /**
   * Create a new Router instance
   * 
   * @param {Object} [options={}] - Router configuration options
   * @param {boolean} [options.caseSensitive=false] - Enable case-sensitive routing
   * @param {boolean} [options.strict=false] - Enable strict routing (trailing slash matters)
   * 
   * @since 1.0.0
   * 
   * @example
   * // Default router
   * const router = new Router();
   * 
   * @example
   * // Case-sensitive router
   * const router = new Router({ caseSensitive: true });
   * 
   * @example
   * // Strict routing (trailing slash matters)
   * const router = new Router({ strict: true });
   */
  constructor(options = {}) {
    /**
     * Router configuration options
     * @type {Object}
     * @private
     */
    this.options = {
      caseSensitive: false,
      strict: false,
      ...options
    };
    
    /**
     * Array of route layers (middleware and routes)
     * @type {Array}
     * @private
     */
    this.stack = [];
    
    /**
     * Parameter handlers for route parameters
     * @type {Object}
     * @private
     */
    this.params = {};
    
    /**
     * Cache for compiled regular expressions
     * @type {SafeRegexCache}
     * @private
     */
    this.regexCache = new SafeRegexCache();
  }

  /**
   * Add middleware to the router
   * 
   * Middleware functions are executed for routes that match the specified path.
   * If no path is provided, middleware applies to all routes.
   * 
   * @param {string|Function} pathOrMiddleware - Path pattern or middleware function
   * @param {...Function} middlewares - Additional middleware functions
   * @returns {Router} The router instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Global middleware
   * router.use((ctx, next) => {
   *   // Console.log removed for production
   *   return next();
   * });
   * 
   * @example
   * // Path-specific middleware
   * router.use('/api', authenticateMiddleware);
   * 
   * @example
   * // Multiple middleware
   * router.use('/admin', authenticate, authorize, logAccess);
   */
  use(pathOrMiddleware, ...middlewares) {
    let path = '/';
    let handlers = [];

    if (typeof pathOrMiddleware === 'string') {
      path = pathOrMiddleware;
      handlers = middlewares;
    } else {
      handlers = [pathOrMiddleware, ...middlewares];
    }

    for (const handler of handlers) {
      const layer = new Layer(path, {
        sensitive: this.options.caseSensitive,
        strict: this.options.strict,
        end: false
      }, handler, this);
      
      this.stack.push(layer);
    }

    return this;
  }

  /**
   * Register a GET route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.get('/', (ctx) => {
   *   ctx.json({ message: 'Hello World!' });
   * });
   * 
   * @example
   * // With parameters
   * router.get('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   ctx.json({ id, name: 'User' });
   * });
   */
  get(path, ...handlers) {
    return this.route(path, 'GET', ...handlers);
  }

  /**
   * Register a POST route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.post('/users', (ctx) => {
   *   const user = ctx.body;
   *   ctx.status(201).json({ id: 123, ...user });
   * });
   */
  post(path, ...handlers) {
    return this.route(path, 'POST', ...handlers);
  }

  /**
   * Register a PUT route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.put('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   const updates = ctx.body;
   *   ctx.json({ id, ...updates });
   * });
   */
  put(path, ...handlers) {
    return this.route(path, 'PUT', ...handlers);
  }

  /**
   * Register a DELETE route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.delete('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   // Delete user logic
   *   ctx.status(204).end();
   * });
   */
  delete(path, ...handlers) {
    return this.route(path, 'DELETE', ...handlers);
  }

  /**
   * Register a PATCH route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.patch('/users/:id', (ctx) => {
   *   const id = ctx.params.id;
   *   const updates = ctx.body;
   *   ctx.json({ id, ...updates });
   * });
   */
  patch(path, ...handlers) {
    return this.route(path, 'PATCH', ...handlers);
  }

  /**
   * Register a HEAD route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.head('/users/:id', (ctx) => {
   *   // Check if user exists
   *   ctx.status(200).end();
   * });
   */
  head(path, ...handlers) {
    return this.route(path, 'HEAD', ...handlers);
  }

  /**
   * Register an OPTIONS route
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.options('/api/*', (ctx) => {
   *   ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
   *   ctx.status(200).end();
   * });
   */
  options(path, ...handlers) {
    return this.route(path, 'OPTIONS', ...handlers);
  }

  /**
   * Register a route for all HTTP methods
   * 
   * @param {string} path - Route path pattern
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @since 1.0.0
   * 
   * @example
   * router.all('/api/*', (ctx, next) => {
   *   ctx.set('X-API-Version', '1.0');
   *   return next();
   * });
   */
  all(path, ...handlers) {
    return this.route(path, null, ...handlers);
  }

  /**
   * Create a new route for the specified path and method
   * 
   * This is an internal method used by the HTTP method functions (get, post, etc.).
   * It creates a new Route instance and wraps it in a Layer for the router stack.
   * 
   * @param {string} path - Route path pattern
   * @param {string|null} method - HTTP method or null for all methods
   * @param {...Function} handlers - Route handler functions
   * @returns {Route} The created route object
   * 
   * @private
   * @since 1.0.0
   */
  route(path, method, ...handlers) {
    const route = new Route(path);
    
    if (method) {
      route[method.toLowerCase()](...handlers);
    } else {
      route.all(...handlers);
    }

    const layer = new Layer(path, {
      sensitive: this.options.caseSensitive,
      strict: this.options.strict,
      end: true
    }, (ctx, next) => {
      return route.dispatch(ctx, next);
    }, this);

    layer.route = route;
    this.stack.push(layer);
    
    return route;
  }

  /**
   * Register a parameter handler
   * 
   * Parameter handlers are called when a route parameter is matched.
   * They can be used for validation, transformation, or loading related data.
   * 
   * @param {string} name - Parameter name
   * @param {Function} handler - Handler function (ctx, next, value, name) => {}
   * @returns {Router} The router instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Load user for :userId parameter
   * router.param('userId', async (ctx, next, id) => {
   *   ctx.user = await User.findById(id);
   *   if (!ctx.user) {
   *     ctx.status(404).json({ error: 'User not found' });
   *     return;
   *   }
   *   return next();
   * });
   * 
   * router.get('/users/:userId', (ctx) => {
   *   ctx.json(ctx.user); // User already loaded by param handler
   * });
   */
  param(name, handler) {
    this.params[name] = handler;
    return this;
  }

  /**
   * Handle an incoming request through the router
   * 
   * Processes the request through all layers (middleware and routes) in the router stack.
   * Matches paths, extracts parameters, and executes appropriate handlers.
   * 
   * @param {Context} ctx - The request context
   * @param {Function} next - The next function to call if no routes match
   * @returns {Promise<void>}
   * 
   * @since 1.0.0
   */
  async handle(ctx, next) {
    let layerError = null;
    let layerIndex = 0;
    
    const nextLayer = async (error) => {
      if (error) {
        layerError = error;
      }

      if (layerIndex >= this.stack.length) {
        return next(layerError);
      }

      const layer = this.stack[layerIndex++];
      const match = layer.match(ctx.path);

      if (!match) {
        return nextLayer(layerError);
      }

      ctx.params = { ...ctx.params, ...match.params };

      if (match.path !== undefined) {
        ctx.path = match.path;
      }

      try {
        await this.processParams(ctx, layer, match.params);
        
        if (layer.route) {
          if (layer.route.handles_method(ctx.method)) {
            await layer.handle(ctx, nextLayer);
          } else {
            nextLayer();
          }
        } else {
          await layer.handle(ctx, nextLayer);
        }
      } catch (err) {
        nextLayer(err);
      }
    };

    await nextLayer();
  }

  /**
   * Process route parameters through registered parameter handlers
   * 
   * Calls any registered parameter handlers for the matched route parameters.
   * Parameter handlers can validate, transform, or load data based on parameter values.
   * 
   * @param {Context} ctx - The request context
   * @param {Layer} layer - The matched layer
   * @param {Object} params - The extracted route parameters
   * @returns {Promise<void>}
   * 
   * @private
   * @since 1.0.0
   */
  async processParams(ctx, layer, params) {
    if (!params || Object.keys(params).length === 0) {
      return;
    }

    for (const [key, value] of Object.entries(params)) {
      if (this.params[key]) {
        try {
          await this.params[key](ctx, () => {}, value, key);
        } catch (error) {
          throw error;
        }
      }
    }
  }

  /**
   * Convert a path string to a regular expression
   * 
   * Converts route path patterns to regular expressions for matching URLs.
   * Supports parameter patterns (:param) and wildcard patterns (*wild).
   * 
   * @param {string|RegExp|Array} path - Path pattern(s) to convert
   * @param {Object} [options={}] - Conversion options
   * @param {boolean} [options.sensitive=false] - Case-sensitive matching
   * @param {boolean} [options.strict=false] - Strict mode (trailing slash matters)
   * @param {boolean} [options.end=true] - Match to end of string
   * @returns {Object} Object with regexp and keys properties
   * 
   * @static
   * @since 1.0.0
   * 
   * @example
   * // Simple path
   * Router.pathToRegExp('/users'); // { regexp: /^\/users\/?$/, keys: [] }
   * 
   * @example
   * // With parameters
   * Router.pathToRegExp('/users/:id'); // { regexp: /^\/users\/([^/]+)\/?$/, keys: [{ name: 'id', optional: false }] }
   */
  static pathToRegExp(path, options = {}) {
    const { sensitive = false, strict = false, end = true } = options;
    
    if (path instanceof RegExp) {
      return { regexp: path, keys: [] };
    }

    if (Array.isArray(path)) {
      const regexps = path.map(p => Router.pathToRegExp(p, options));
      return {
        regexp: new RegExp(`(?:${regexps.map(r => r.regexp.source).join('|')})`, getFlags(options)),
        keys: regexps.reduce((keys, r) => keys.concat(r.keys), [])
      };
    }

    const keys = [];
    let regexp = path;

    regexp = regexp.replace(/\\\//g, '/');

    regexp = regexp.replace(/:([^(/\\]+)/g, (match, key) => {
      keys.push({ name: key, optional: false });
      return '([^/]+)';
    });

    regexp = regexp.replace(/\*([^(/\\]*)/g, (match, key) => {
      keys.push({ name: key || 'wild', optional: false });
      return '(.*)';
    });

    if (end) {
      regexp += strict ? '' : '/?';
    }

    regexp += end ? '$' : '';

    const flags = getFlags(options);
    return {
      regexp: new RegExp(`^${regexp}`, flags),
      keys
    };
  }

  /**
   * Match a path against a regular expression and extract parameters
   * 
   * Tests if a path matches the given regular expression and extracts
   * parameter values based on the provided keys.
   * 
   * @param {string} path - The path to match
   * @param {RegExp} regexp - The regular expression to test against
   * @param {Array} keys - Array of parameter key objects
   * @returns {Object|false} Match object with path and params, or false if no match
   * 
   * @throws {Error} When URL parameters cannot be decoded
   * 
   * @static
   * @since 1.0.0
   * 
   * @example
   * const { regexp, keys } = Router.pathToRegExp('/users/:id');
   * const match = Router.match('/users/123', regexp, keys);
   * // { path: '/users/123', params: { id: '123' } }
   */
  static match(path, regexp, keys) {
    const match = regexp.exec(path);
    if (!match) return false;

    const params = {};
    for (let i = 1; i < match.length; i++) {
      const key = keys[i - 1];
      const value = match[i];
      
      if (value !== undefined) {
        try {
          params[key.name] = decodeURIComponent(value);
        } catch (error) {
          // Handle malformed URL parameters
          throw new Error('Invalid URL parameter');
        }
      }
    }

    return {
      path: match[0],
      params
    };
  }

  /**
   * Create a route group with a common prefix
   * 
   * Groups routes under a common path prefix. The callback function receives
   * a new router instance to define routes within the group.
   * 
   * @param {string} prefix - Common path prefix for the group
   * @param {Function} callback - Function that receives the group router
   * @returns {Router} The router instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * router.group('/api', (api) => {
   *   api.get('/users', getUsersHandler);
   *   api.post('/users', createUserHandler);
   *   api.get('/users/:id', getUserHandler);
   * });
   * // Creates routes: GET /api/users, POST /api/users, GET /api/users/:id
   */
  group(prefix, callback) {
    const router = new Router(this.options);
    callback(router);
    
    this.use(prefix, (ctx, next) => {
      const originalPath = ctx.path;
      if (ctx.path.startsWith(prefix)) {
        ctx.path = ctx.path.slice(prefix.length) || '/';
      }
      
      return router.handle(ctx, () => {
        ctx.path = originalPath;
        return next();
      });
    });
    
    return this;
  }

  /**
   * Create a versioned API group
   * 
   * Convenience method for creating API version groups with /v{version} prefix.
   * 
   * @param {string|number} version - API version number
   * @param {Function} callback - Function that receives the version router
   * @returns {Router} The router instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * router.version('1', (v1) => {
   *   v1.get('/users', getUsersV1);
   *   v1.post('/users', createUserV1);
   * });
   * 
   * router.version('2', (v2) => {
   *   v2.get('/users', getUsersV2);
   *   v2.post('/users', createUserV2);
   * });
   * // Creates: GET /v1/users, POST /v1/users, GET /v2/users, POST /v2/users
   */
  version(version, callback) {
    const versionPrefix = `/v${version}`;
    return this.group(versionPrefix, callback);
  }

  /**
   * Mount another router at the specified path
   * 
   * Mounts a sub-router at the given path, allowing for modular route organization.
   * 
   * @param {string} path - Path prefix where the router should be mounted
   * @param {Router} router - Router instance to mount
   * @returns {Router} The router instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * const userRouter = new Router();
   * userRouter.get('/', getUsersHandler);
   * userRouter.get('/:id', getUserHandler);
   * 
   * const apiRouter = new Router();
   * apiRouter.mount('/users', userRouter);
   * // Creates routes: GET /users/, GET /users/:id
   */
  mount(path, router) {
    this.use(path, (ctx, next) => {
      return router.handle(ctx, next);
    });
    return this;
  }

  /**
   * Get all routes (layers with route objects)
   * 
   * Returns an array of layers that contain route objects, filtering out
   * middleware-only layers.
   * 
   * @returns {Array} Array of route layers
   * 
   * @since 1.0.0
   * 
   * @example
   * const routes = router.routes;
   * // Console.log removed for production
   */
  get routes() {
    return this.stack.filter(layer => layer.route);
  }
  
  /**
   * Returns router middleware function
   * 
   * @returns {Function} Middleware function for this router
   * @since 1.0.0
   * 
   * @example
   * // Mount router on app
   * const router = new Router();
   * router.get('/users', handler);
   * app.use('/api', router.routes());
   */
  routes() {
    const router = this;
    return function routerMiddleware(ctx, next) {
      return router.handle(ctx, next);
    };
  }
  
  /**
   * Alias for routes() method
   * @returns {Function} Middleware function
   */
  middleware(prefix) {
    const router = this;
    return function routerMiddleware(ctx, next) {
      // If prefix is provided, adjust the path
      if (prefix && ctx.path.startsWith(prefix)) {
        const originalPath = ctx.path;
        ctx.path = ctx.path.slice(prefix.length) || '/';
        
        return router.handle(ctx, next).then(() => {
          ctx.path = originalPath;
        }).catch(err => {
          ctx.path = originalPath;
          throw err;
        });
      }
      return router.handle(ctx, next);
    };
  }
}

/**
 * Get regular expression flags based on options
 * 
 * @param {Object} options - Router options
 * @param {boolean} options.sensitive - Case sensitivity flag
 * @returns {string} Regular expression flags
 * 
 * @private
 * @since 1.0.0
 */
function getFlags(options) {
  return options.sensitive ? '' : 'i';
}

module.exports = Router;