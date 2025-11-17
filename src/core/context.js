'use strict';

/**
 * @fileoverview Context class for handling HTTP requests and responses in Spark Framework
 * @author Spark Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

const { URL } = require('url');
const querystring = require('querystring');

/**
 * Context class that wraps HTTP request and response objects
 * 
 * The Context class provides a unified interface for handling HTTP requests and responses.
 * It parses incoming request data, provides helper methods for setting headers and status codes,
 * and includes convenience methods for sending various types of responses.
 * 
 * @class Context
 * @since 1.0.0
 * 
 * @example
 * // In a middleware or route handler
 * app.get('/users/:id', (ctx) => {
 *   const userId = ctx.params.id;
 *   const userAgent = ctx.get('user-agent');
 *   
 *   ctx.set('X-Response-Time', '10ms');
 *   ctx.json({ id: userId, userAgent });
 * });
 * 
 * @example
 * // Working with cookies
 * app.post('/login', (ctx) => {
 *   const { username, password } = ctx.body;
 *   
 *   if (authenticate(username, password)) {
 *     ctx.setCookie('session', 'abc123', {
 *       httpOnly: true,
 *       secure: true,
 *       maxAge: 3600000
 *     });
 *     ctx.json({ success: true });
 *   } else {
 *     ctx.status(401).json({ error: 'Invalid credentials' });
 *   }
 * });
 */
class Context {
  /**
   * Create a new Context instance
   * 
   * @param {http.IncomingMessage} req - The HTTP request object
   * @param {http.ServerResponse} res - The HTTP response object
   * @param {Application} app - The Spark application instance
   * 
   * @since 1.0.0
   * 
   * @example
   * // Context is typically created automatically by the framework
   * const ctx = new Context(req, res, app);
   */
  constructor(req, res, app) {
    /**
     * The HTTP request object
     * @type {http.IncomingMessage}
     * @readonly
     */
    this.req = req;
    
    /**
     * The HTTP response object
     * @type {http.ServerResponse}
     * @readonly
     */
    this.res = res;
    
    /**
     * The Spark application instance
     * @type {Application}
     * @readonly
     */
    this.app = app;
    
    /**
     * Whether a response has been sent
     * @type {boolean}
     * @readonly
     */
    this.responded = false;
    
    /**
     * The HTTP status code for the response
     * @type {number}
     */
    this.statusCode = 200;
    
    this.initializeUrl();
    this.initializeHeaders();
    this.initializeQuery();
    this.initializeCookies();
    
    /**
     * Route parameters extracted from the URL
     * @type {Object}
     * @example
     * // For route '/users/:id' with URL '/users/123'
     * ctx.params.id // '123'
     */
    this.params = {};
    
    /**
     * Parsed request body
     * @type {*}
     */
    this.body = null;
    
    /**
     * Uploaded files (when using multipart/form-data)
     * @type {Object|null}
     */
    this.files = null;
    
    /**
     * Session data (when session middleware is used)
     * @type {Object|null}
     */
    this.session = null;
    
    /**
     * Application state for storing custom data
     * @type {Object}
     */
    this.state = {};
  }

  /**
   * Initialize URL-related properties from the request
   * 
   * Parses the request URL and extracts path, method, and other URL components.
   * Handles malformed URLs by throwing an appropriate error.
   * 
   * @private
   * @throws {Error} When the URL cannot be parsed
   * @since 1.0.0
   */
  initializeUrl() {
    // Use optional chaining to safely access connection properties
    const protocol = this.req.connection?.encrypted ? 'https' : 'http';
    const host = this.req.headers?.host || 'localhost';

    try {
      /**
       * Parsed URL object
       * @type {URL|null}
       * @readonly
       */
      this.url = new URL(this.req.url, `${protocol}://${host}`);

      /**
       * Request path (pathname without query string)
       * @type {string}
       * @readonly
       */
      this.path = this.url.pathname;
    } catch (error) {
      // Handle malformed URLs - throw proper error instead of just logging
      this.url = null;
      this.path = '/';
      this.statusCode = 400;
      this.body = { error: 'Invalid URL format' };
      throw new Error(`Failed to parse URL: ${error.message}`);
    }

    /**
     * HTTP method (GET, POST, PUT, etc.)
     * @type {string}
     * @readonly
     */
    this.method = this.req.method?.toUpperCase() || 'GET';
    
    /**
     * Original request URL including query string
     * @type {string}
     * @readonly
     */
    this.originalUrl = this.req.url;
  }

  /**
   * Initialize request and response headers
   * 
   * Copies request headers and initializes response headers object.
   * 
   * @private
   * @since 1.0.0
   */
  initializeHeaders() {
    /**
     * Request headers (lowercase keys)
     * @type {Object}
     * @readonly
     */
    this.headers = { ...this.req.headers };
    
    /**
     * Response headers to be sent
     * @type {Object}
     * @private
     */
    this.responseHeaders = {};
  }

  /**
   * Initialize query string parameters
   * 
   * Parses the URL query string into an object.
   * 
   * @private
   * @since 1.0.0
   */
  initializeQuery() {
    /**
     * Parsed query string parameters
     * @type {Object}
     * @readonly
     * @example
     * // For URL '/search?q=hello&limit=10'
     * ctx.query.q // 'hello'
     * ctx.query.limit // '10'
     */
    // Use null-prototype object to prevent prototype pollution
    this.query = Object.create(null);

    if (this.url && this.url.search) {
      const parsed = querystring.parse(this.url.search.slice(1));

      // Filter out dangerous prototype pollution keys
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

      for (const [key, value] of Object.entries(parsed)) {
        // Skip dangerous keys that could cause prototype pollution
        if (!dangerousKeys.includes(key) && !key.includes('__proto__')) {
          this.query[key] = value;
        }
      }
    }
  }

  /**
   * Initialize cookies from the request
   * 
   * Parses the Cookie header and decodes cookie values.
   * Malformed cookies are skipped and logged.
   * 
   * @private
   * @since 1.0.0
   */
  initializeCookies() {
    /**
     * Parsed cookies from the request
     * @type {Object}
     * @readonly
     * @example
     * // For Cookie header 'session=abc123; theme=dark'
     * ctx.cookies.session // 'abc123'
     * ctx.cookies.theme // 'dark'
     */
    this.cookies = {};
    const cookieHeader = this.req.headers.cookie;
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const trimmed = cookie.trim();
        // SECURITY: Split only on first '=' to preserve cookie values containing '='
        const eqIndex = trimmed.indexOf('=');

        if (eqIndex === -1) {
          // Cookie without value (flag cookie)
          if (trimmed) {
            this.cookies[trimmed] = true;
          }
          return;
        }

        const name = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);

        if (name && value !== undefined) {
          try {
            this.cookies[name] = decodeURIComponent(value);
          } catch (error) {
            // If decoding fails, use raw value (might be unencoded)
            this.cookies[name] = value;
            console.error(`Failed to decode cookie ${name}: ${error.message}`);
          }
        }
      });
    }
  }

  /**
   * Get a request header value
   * 
   * @param {string} headerName - The header name (case-insensitive)
   * @returns {string|undefined} The header value or undefined if not present
   * 
   * @since 1.0.0
   * 
   * @example
   * const userAgent = ctx.get('User-Agent');
   * const contentType = ctx.get('content-type');
   */
  get(headerName) {
    return this.headers[headerName.toLowerCase()];
  }

  /**
   * Set a response header
   * 
   * Sets a response header with validation for security and RFC compliance.
   * Header names and values are validated to prevent injection attacks.
   * 
   * @param {string} headerName - The header name
   * @param {string|number} value - The header value
   * @returns {Context} The context instance for method chaining
   * 
   * @throws {Error} When header name or value is invalid
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.set('Content-Type', 'application/json');
   * ctx.set('X-Response-Time', '10ms');
   * 
   * @example
   * // Method chaining
   * ctx.set('Content-Type', 'text/html')
   *    .set('Cache-Control', 'no-cache');
   */
  set(headerName, value) {
    // Validate header name
    if (!headerName || typeof headerName !== 'string') {
      throw new Error('Header name must be a non-empty string');
    }
    
    // Validate header name format (RFC 7230)
    if (!/^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(headerName)) {
      throw new Error(`Invalid header name: ${headerName}`);
    }
    
    // Validate header value
    if (value !== undefined && value !== null) {
      const stringValue = String(value);
      // Check for invalid characters in header value (CRLF and null byte)
      if (/[\r\n\x00]/.test(stringValue)) {
        throw new Error('Header value cannot contain CRLF or null characters');
      }
      // Check header value length
      if (stringValue.length > 8192) {
        throw new Error('Header value too long (max 8192 characters)');
      }
      this.responseHeaders[headerName.toLowerCase()] = stringValue;
    }
    
    return this;
  }

  /**
   * Alias for set() method
   * 
   * @param {string} name - The header name
   * @param {string|number} value - The header value
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * @see {@link Context#set}
   */
  setHeader(name, value) {
    return this.set(name, value);
  }

  /**
   * Get a response header value
   * 
   * @param {string} name - The header name (case-insensitive)
   * @returns {string|undefined} The header value or undefined if not set
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.set('Content-Type', 'application/json');
   * const contentType = ctx.getHeader('content-type'); // 'application/json'
   */
  getHeader(name) {
    return this.responseHeaders[name.toLowerCase()];
  }

  /**
   * Remove a response header
   * 
   * @param {string} name - The header name (case-insensitive)
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.removeHeader('X-Powered-By');
   */
  removeHeader(name) {
    delete this.responseHeaders[name.toLowerCase()];
    return this;
  }

  /**
   * Set the HTTP status code
   * 
   * @param {number|string} code - HTTP status code (100-599)
   * @returns {Context} The context instance for method chaining
   * 
   * @throws {Error} When status code is invalid
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.status(200); // OK
   * ctx.status(404); // Not Found
   * ctx.status(500); // Internal Server Error
   * 
   * @example
   * // Method chaining
   * ctx.status(201).json({ id: 123, name: 'User' });
   */
  status(code) {
    // BUG FIX: Strict type validation - reject non-integer inputs
    // parseInt("200abc") would silently convert to 200, masking bugs
    if (typeof code !== 'number' || !Number.isInteger(code)) {
      // Try to parse if it's a string, but validate strictly
      if (typeof code === 'string') {
        // Check if the string is purely numeric
        if (!/^\d+$/.test(code.trim())) {
          throw new Error(`Invalid status code: ${code}. Must be an integer between 100 and 599`);
        }
        code = parseInt(code, 10);
      } else {
        throw new Error(`Invalid status code type: ${typeof code}. Must be a number`);
      }
    }

    // Validate status code range
    if (code < 100 || code > 599) {
      throw new Error(`Invalid status code: ${code}. Must be between 100 and 599`);
    }

    this.statusCode = code;
    return this;
  }

  /**
   * Redirect to a URL
   * 
   * Sets the Location header and status code, then ends the response.
   * 
   * @param {string} url - The URL to redirect to
   * @param {number} [status=302] - HTTP status code for redirect
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * // Temporary redirect (302)
   * ctx.redirect('/login');
   * 
   * @example
   * // Permanent redirect (301)
   * ctx.redirect('/new-path', 301);
   */
  redirect(url, status = 302) {
    // Validate redirect URL
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid redirect URL');
    }

    // Check for CRLF injection
    if (/[\r\n]/.test(url)) {
      throw new Error('Invalid redirect URL contains CRLF characters');
    }

    // Check if URL is absolute (external)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const allowedDomains = this.app?.settings?.allowedRedirectDomains || [];

      try {
        const urlObj = new URL(url);

        // If allowed domains are configured, check the domain
        if (allowedDomains.length > 0) {
          const isAllowed = allowedDomains.some(domain => {
            if (typeof domain === 'string') {
              return urlObj.hostname === domain ||
                     urlObj.hostname.endsWith(`.${domain}`);
            }
            if (domain instanceof RegExp) {
              return domain.test(urlObj.hostname);
            }
            return false;
          });

          if (!isAllowed) {
            throw new Error('Redirect to external domain not allowed');
          }
        }
        // If no allowed domains configured, log a warning
        else {
          console.warn(`Security Warning: Redirecting to external URL ${urlObj.hostname} without domain whitelist`);
        }
      } catch (error) {
        if (error.message.includes('not allowed')) {
          throw error;
        }
        throw new Error(`Invalid redirect URL: ${error.message}`);
      }
    }

    this.status(status);
    this.set('Location', url);
    this.end();
    return this;
  }

  /**
   * Send a JSON response
   * 
   * Sets the Content-Type header to application/json and sends the data as JSON.
   * 
   * @param {*} data - The data to send as JSON
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.json({ message: 'Hello World' });
   * 
   * @example
   * // With status code
   * ctx.status(201).json({ id: 123, name: 'User' });
   */
  json(data) {
    this.set('Content-Type', 'application/json');
    this.send(JSON.stringify(data));
    return this;
  }

  /**
   * Send a plain text response
   * 
   * Sets the Content-Type header to text/plain and sends the data as text.
   * 
   * @param {string} data - The text data to send
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.text('Hello World');
   * 
   * @example
   * // With status code
   * ctx.status(200).text('Success');
   */
  text(data) {
    this.set('Content-Type', 'text/plain');
    this.send(data);
    return this;
  }

  /**
   * Send an HTML response
   * 
   * Sets the Content-Type header to text/html and sends the data as HTML.
   * 
   * @param {string} data - The HTML data to send
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.html('<h1>Hello World</h1>');
   * 
   * @example
   * // With status code
   * ctx.status(200).html('<p>Welcome!</p>');
   */
  html(data) {
    this.set('Content-Type', 'text/html');
    this.send(data);
    return this;
  }

  /**
   * Send a response with data
   * 
   * Sends the response with the specified data. This method is called by other
   * response methods like json(), text(), and html(). Once called, no further
   * response methods can be used.
   * 
   * @param {*} data - The data to send
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.send('Hello World');
   * ctx.send(Buffer.from('binary data'));
   */
  send(data) {
    if (this.responded) {
      return this;
    }

    this.responded = true;
    this.res.statusCode = this.statusCode;

    Object.keys(this.responseHeaders).forEach(name => {
      this.res.setHeader(name, this.responseHeaders[name]);
    });

    if (data === null || data === undefined) {
      this.res.end();
    } else if (typeof data === 'string' || Buffer.isBuffer(data)) {
      this.res.end(data);
    } else {
      this.res.end(String(data));
    }

    return this;
  }

  /**
   * End the response
   * 
   * Ends the response optionally with data. This is an alias for send().
   * 
   * @param {*} [data] - Optional data to send before ending
   * @returns {Context} The context instance for method chaining
   * 
   * @since 1.0.0
   * 
   * @example
   * ctx.status(204).end(); // No content
   * ctx.end('Final message');
   */
  end(data) {
    if (data) {
      this.send(data);
    } else {
      this.send();
    }
    return this;
  }

  setCookie(name, value, options = {}) {
    // Validate cookie name
    if (!name || typeof name !== 'string') {
      throw new Error('Cookie name must be a non-empty string');
    }
    
    // Validate cookie name format (RFC 6265)
    if (!/^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name)) {
      throw new Error(`Invalid cookie name: ${name}`);
    }
    
    // Check for control characters in cookie name
    if (/[\x00-\x1F\x7F]/.test(name)) {
      throw new Error('Cookie name cannot contain control characters');
    }
    
    // Validate cookie value
    if (value === null || value === undefined) {
      value = '';
    }
    
    // Convert value to string and check for invalid characters
    const stringValue = String(value);
    if (/[\x00-\x1F\x7F]/.test(stringValue)) {
      throw new Error('Cookie value cannot contain control characters');
    }
    
    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (options.domain) {
      // SECURITY: Validate domain to prevent CRLF injection
      const domain = String(options.domain);
      if (/[\r\n]/.test(domain)) {
        throw new Error('Cookie domain cannot contain CRLF characters');
      }
      cookieString += `; Domain=${domain}`;
    }

    if (options.path) {
      // SECURITY: Validate path to prevent CRLF injection
      const path = String(options.path);
      if (/[\r\n]/.test(path)) {
        throw new Error('Cookie path cannot contain CRLF characters');
      }
      cookieString += `; Path=${path}`;
    }

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    }

    if (options.maxAge) {
      cookieString += `; Max-Age=${options.maxAge}`;
    }

    if (options.httpOnly) {
      cookieString += '; HttpOnly';
    }

    if (options.secure) {
      cookieString += '; Secure';
    }

    if (options.sameSite) {
      const validSameSite = ['Strict', 'Lax', 'None'];
      const sameSiteValue = options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1).toLowerCase();
      if (!validSameSite.includes(sameSiteValue)) {
        throw new Error(`Invalid SameSite value: ${options.sameSite}. Must be 'Strict', 'Lax', or 'None'`);
      }
      cookieString += `; SameSite=${sameSiteValue}`;
    }

    const existingCookies = this.responseHeaders['set-cookie'] || [];
    if (Array.isArray(existingCookies)) {
      existingCookies.push(cookieString);
      this.responseHeaders['set-cookie'] = existingCookies;
    } else if (existingCookies) {
      this.responseHeaders['set-cookie'] = [existingCookies, cookieString];
    } else {
      this.responseHeaders['set-cookie'] = [cookieString];
    }
    
    return this;
  }

  clearCookie(name, options = {}) {
    const clearOptions = {
      ...options,
      expires: new Date(0),
      maxAge: 0
    };
    return this.setCookie(name, '', clearOptions);
  }

  is(type) {
    const contentType = this.get('content-type');
    if (!contentType) return false;
    
    const mimeTypes = {
      json: 'application/json',
      form: 'application/x-www-form-urlencoded',
      multipart: 'multipart/form-data',
      text: 'text/plain',
      html: 'text/html'
    };

    const targetType = mimeTypes[type] || type;
    return contentType.includes(targetType);
  }

  accepts(types) {
    const accept = this.get('accept') || '*/*';
    
    if (typeof types === 'string') {
      types = [types];
    }

    for (const type of types) {
      if (accept.includes(type) || accept.includes('*/*')) {
        return type;
      }
    }

    return false;
  }

  fresh() {
    const method = this.method;
    const status = this.statusCode;

    if (method !== 'GET' && method !== 'HEAD') return false;
    if ((status >= 200 && status < 300) || status === 304) return true;

    return false;
  }

  stale() {
    return !this.fresh();
  }

  secure() {
    return this.req.connection.encrypted;
  }

  xhr() {
    return this.get('x-requested-with') === 'XMLHttpRequest';
  }

  /**
   * Validate if a string is a valid IP address (IPv4 or IPv6)
   * @param {string} ip - IP address to validate
   * @returns {boolean} True if valid IP address
   * @private
   */
  _isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;

    // Basic IPv4 validation
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4.test(ip)) {
      const octets = ip.split('.');
      return octets.every(o => {
        const num = parseInt(o, 10);
        return num >= 0 && num <= 255;
      });
    }

    // Basic IPv6 validation (simplified)
    const ipv6 = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/;
    return ipv6.test(ip);
  }

  /**
   * Get the client IP address
   * WARNING: Only trust X-Forwarded-For if app.settings.trustProxy is enabled
   * @returns {string} Client IP address
   */
  ip() {
    const trustProxy = this.app?.settings?.trustProxy || false;

    // Only use forwarded headers if proxy trust is enabled
    if (trustProxy) {
      const forwarded = this.get('x-forwarded-for');
      if (forwarded) {
        // X-Forwarded-For contains client IP as first entry
        const ips = forwarded.split(/\s*,\s*/);
        const clientIP = ips[0]?.trim();
        if (clientIP && this._isValidIP(clientIP)) {
          return clientIP;
        }
      }

      const realIP = this.get('x-real-ip');
      if (realIP && this._isValidIP(realIP)) {
        return realIP;
      }
    }

    // Fall back to connection IP
    return this.req.connection?.remoteAddress ||
           this.req.socket?.remoteAddress ||
           '0.0.0.0';
  }

  /**
   * Get all IPs in the X-Forwarded-For chain
   * WARNING: Only trust X-Forwarded-For if app.settings.trustProxy is enabled
   * @returns {string[]} Array of IP addresses
   */
  ips() {
    const trustProxy = this.app?.settings?.trustProxy || false;

    if (!trustProxy) {
      const singleIP = this.ip();
      return singleIP !== '0.0.0.0' ? [singleIP] : [];
    }

    const forwarded = this.get('x-forwarded-for');
    if (!forwarded) {
      const singleIP = this.ip();
      return singleIP !== '0.0.0.0' ? [singleIP] : [];
    }

    return forwarded
      .split(/\s*,\s*/)
      .map(ip => ip.trim())
      .filter(ip => ip && this._isValidIP(ip));
  }

  protocol() {
    return this.req.connection.encrypted ? 'https' : 'http';
  }

  host() {
    return this.get('host') || 'localhost';
  }

  hostname() {
    return this.host().split(':')[0];
  }

  port() {
    const host = this.host();
    const portMatch = host.match(/:(\d+)$/);
    return portMatch ? parseInt(portMatch[1], 10) : (this.secure() ? 443 : 80);
  }

  subdomains() {
    const hostname = this.hostname();
    const parts = hostname.split('.');
    return parts.length > 2 ? parts.slice(0, -2).reverse() : [];
  }

  type() {
    const contentType = this.get('content-type');
    return contentType ? contentType.split(';')[0] : '';
  }

  charset() {
    const contentType = this.get('content-type');
    if (!contentType) return '';
    
    const match = contentType.match(/charset=([^;]+)/);
    return match ? match[1] : '';
  }

  length() {
    const contentLength = this.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  toString() {
    return `${this.method} ${this.originalUrl}`;
  }

  toJSON() {
    return {
      method: this.method,
      url: this.originalUrl,
      path: this.path,
      query: this.query,
      params: this.params,
      headers: this.headers,
      cookies: this.cookies,
      statusCode: this.statusCode,
      responded: this.responded
    };
  }
  
  /**
   * Initialize context with new request/response (for object pooling)
   * @param {IncomingMessage} req - HTTP request
   * @param {ServerResponse} res - HTTP response  
   * @param {Application} app - Spark application
   */
  init(req, res, app) {
    this.req = req;
    this.res = res;
    this.app = app;
    this.responded = false;
    this.statusCode = 200;
    
    this.initializeUrl();
    this.initializeHeaders();
    this.initializeQuery();
    this.initializeCookies();
    
    this.params = {};
    this.body = null;
    this.files = null;
    this.session = null;
    this.state = {};
  }
  
  /**
   * Reset context for object pooling
   */
  reset() {
    this.req = null;
    this.res = null;
    this.app = null;
    this.responded = false;
    this.statusCode = 200;
    this.url = null;
    this.path = null;
    this.method = null;
    this.originalUrl = null;
    this.headers = {};
    this.responseHeaders = {};
    this.query = {};
    this.cookies = {};
    this.params = {};
    this.body = null;
    this.files = null;
    this.session = null;
    this.state = {};
  }
}

module.exports = Context;