'use strict';

const { URL } = require('url');
const querystring = require('querystring');
const { safeJSONParse } = require('../utils/safe-json');

class Request {
  constructor(req) {
    this.req = req;
    this.method = req.method;
    this.url = req.url;
    this.headers = req.headers;
    this.httpVersion = req.httpVersion;
    this.httpVersionMajor = req.httpVersionMajor;
    this.httpVersionMinor = req.httpVersionMinor;
    this.connection = req.connection;
    this.socket = req.socket;
    this.complete = req.complete;
    this.trailers = req.trailers;
    this.rawTrailers = req.rawTrailers;
    this.aborted = req.aborted;
    this.upgrade = req.upgrade;
    
    this.parsedUrl = new URL(this.url, `http://${this.headers.host}`);
    this.pathname = this.parsedUrl.pathname;
    this.query = querystring.parse(this.parsedUrl.search.slice(1));
    this.search = this.parsedUrl.search;
    this.hash = this.parsedUrl.hash;
    
    this.body = null;
    this.rawBody = null;
    this.files = {};
    this.params = {};
    
    this.parseHeaders();
    this.parseCookies();
  }

  parseHeaders() {
    this.host = this.headers.host;
    this.hostname = this.host ? this.host.split(':')[0] : 'localhost';
    this.protocol = this.connection.encrypted ? 'https' : 'http';
    this.secure = this.connection.encrypted;
    this.ip = this.connection.remoteAddress;
    this.ips = this.getIPs();
    this.userAgent = this.headers['user-agent'];
    this.contentType = this.headers['content-type'];
    this.contentLength = parseInt(this.headers['content-length'], 10) || 0;
    this.accept = this.headers.accept;
    this.authorization = this.headers.authorization;
    this.referer = this.headers.referer || this.headers.referrer;
    this.origin = this.headers.origin;
  }

  parseCookies() {
    this.cookies = {};
    const cookieHeader = this.headers.cookie;

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
            // If decoding fails, use raw value
            this.cookies[name] = value;
          }
        }
      });
    }
  }

  getIPs(trustProxy = false) {
    // SECURITY FIX: Only trust X-Forwarded-For header if explicitly configured
    // Prevents IP spoofing attacks via header manipulation
    // Default behavior is to NOT trust proxy headers for security
    if (!trustProxy) {
      return [this.ip];
    }

    const forwarded = this.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      // SECURITY: Validate each IP address format
      return ips.filter(ip => this._isValidIP(ip));
    }
    return [this.ip];
  }

  _isValidIP(ip) {
    // Basic IPv4 and IPv6 validation
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (!ip || typeof ip !== 'string') {
      return false;
    }

    // Check IPv4
    if (ipv4Pattern.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // Check IPv6 (basic validation)
    return ipv6Pattern.test(ip);
  }

  get(headerName) {
    return this.headers[headerName.toLowerCase()];
  }

  header(headerName) {
    return this.get(headerName);
  }

  is(type) {
    if (!this.contentType) return false;
    
    const mimeTypes = {
      json: 'application/json',
      form: 'application/x-www-form-urlencoded',
      multipart: 'multipart/form-data',
      text: 'text/plain',
      html: 'text/html',
      xml: 'application/xml'
    };

    const targetType = mimeTypes[type] || type;
    return this.contentType.includes(targetType);
  }

  accepts(types) {
    if (!this.accept) return false;
    
    if (typeof types === 'string') {
      types = [types];
    }

    for (const type of types) {
      if (this.accept.includes(type) || this.accept.includes('*/*')) {
        return type;
      }
    }

    return false;
  }

  acceptsCharsets(charsets) {
    const acceptCharset = this.headers['accept-charset'];
    if (!acceptCharset) return charsets[0];

    if (typeof charsets === 'string') {
      charsets = [charsets];
    }

    for (const charset of charsets) {
      if (acceptCharset.includes(charset)) {
        return charset;
      }
    }

    return false;
  }

  acceptsEncodings(encodings) {
    const acceptEncoding = this.headers['accept-encoding'];
    if (!acceptEncoding) return encodings[0];

    if (typeof encodings === 'string') {
      encodings = [encodings];
    }

    for (const encoding of encodings) {
      if (acceptEncoding.includes(encoding)) {
        return encoding;
      }
    }

    return false;
  }

  acceptsLanguages(languages) {
    const acceptLanguage = this.headers['accept-language'];
    if (!acceptLanguage) return languages[0];

    if (typeof languages === 'string') {
      languages = [languages];
    }

    for (const language of languages) {
      if (acceptLanguage.includes(language)) {
        return language;
      }
    }

    return false;
  }

  range(size) {
    const range = this.headers.range;
    if (!range) return null;

    const ranges = parseRange(size, range);
    return ranges.length > 0 ? ranges : null;
  }

  param(name, defaultValue) {
    if (this.params.hasOwnProperty(name)) {
      return this.params[name];
    }
    
    if (this.body && this.body.hasOwnProperty(name)) {
      return this.body[name];
    }
    
    if (this.query.hasOwnProperty(name)) {
      return this.query[name];
    }
    
    return defaultValue;
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

  xhr() {
    return this.get('x-requested-with') === 'XMLHttpRequest';
  }

  subdomains() {
    const parts = this.hostname.split('.');
    return parts.length > 2 ? parts.slice(0, -2).reverse() : [];
  }

  route() {
    return this.route;
  }

  baseUrl() {
    return `${this.protocol}://${this.host}`;
  }

  originalUrl() {
    return this.url;
  }

  path() {
    return this.pathname;
  }

  async readBody() {
    if (this.body !== null) {
      return this.body;
    }

    return new Promise((resolve, reject) => {
      let body = '';
      this.req.on('data', chunk => {
        body += chunk;
      });
      
      this.req.on('end', () => {
        this.rawBody = body;
        try {
          if (this.is('json')) {
            // SECURITY: Use safe JSON parser with depth and size limits
            this.body = safeJSONParse(body, { maxDepth: 20, maxSize: 10 * 1024 * 1024 });
          } else if (this.is('form')) {
            this.body = querystring.parse(body);
          } else {
            this.body = body;
          }
          resolve(this.body);
        } catch (error) {
          reject(error);
        }
      });
      
      this.req.on('error', reject);
    });
  }

  pipe(destination) {
    return this.req.pipe(destination);
  }

  unpipe(destination) {
    return this.req.unpipe(destination);
  }

  pause() {
    return this.req.pause();
  }

  resume() {
    return this.req.resume();
  }

  setTimeout(msecs, callback) {
    return this.req.setTimeout(msecs, callback);
  }

  destroy() {
    return this.req.destroy();
  }

  toString() {
    return `${this.method} ${this.url}`;
  }

  toJSON() {
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      query: this.query,
      params: this.params,
      cookies: this.cookies,
      body: this.body,
      ip: this.ip,
      ips: this.ips,
      secure: this.secure,
      xhr: this.xhr()
    };
  }
}

function parseRange(size, range) {
  if (!range || !range.startsWith('bytes=')) {
    return [];
  }

  const ranges = [];
  const parts = range.slice(6).split(',');

  for (const part of parts) {
    const [start, end] = part.trim().split('-');
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (isNaN(startNum) && isNaN(endNum)) {
      continue;
    }

    if (isNaN(startNum)) {
      ranges.push({ start: Math.max(0, size - endNum), end: size - 1 });
    } else if (isNaN(endNum)) {
      ranges.push({ start: startNum, end: size - 1 });
    } else {
      ranges.push({ start: startNum, end: Math.min(endNum, size - 1) });
    }
  }

  return ranges;
}

module.exports = Request;