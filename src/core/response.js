'use strict';

const { STATUS_CODES } = require('http');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

class Response {
  constructor(res, req = null) {
    this.res = res;
    this.req = req;  // Store request reference for format() and jsonp()
    this.statusCode = 200;
    this.headers = {};
    this.locals = {};
    this.finished = false;
    this.headersSent = false;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  set(field, value) {
    if (typeof field === 'object') {
      Object.assign(this.headers, field);
    } else {
      this.headers[field.toLowerCase()] = value;
    }
    return this;
  }

  get(field) {
    return this.headers[field.toLowerCase()];
  }

  header(field, value) {
    return this.set(field, value);
  }

  setHeader(name, value) {
    return this.set(name, value);
  }

  getHeader(name) {
    return this.get(name);
  }

  removeHeader(name) {
    delete this.headers[name.toLowerCase()];
    return this;
  }

  append(field, value) {
    const existing = this.get(field);
    if (existing) {
      this.set(field, Array.isArray(existing) ? existing.concat(value) : [existing, value]);
    } else {
      this.set(field, value);
    }
    return this;
  }

  cookie(name, value, options = {}) {
    // SECURITY FIX: Comprehensive cookie validation to prevent header injection

    // Validate cookie name
    if (!name || typeof name !== 'string') {
      throw new Error('Cookie name must be a non-empty string');
    }

    if (name.length > 256) {
      throw new Error(`Cookie name too long: ${name.length} bytes (max 256)`);
    }

    // RFC 6265 compliant cookie name validation
    if (!/^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name)) {
      throw new Error(`Invalid cookie name: ${name}`);
    }

    // SECURITY: Check for CRLF injection in name
    if (/[\r\n\x00]/.test(name)) {
      throw new Error('Cookie name cannot contain CRLF or null characters');
    }

    // Validate value length
    const stringValue = String(value);
    if (stringValue.length > 4096) {
      throw new Error(`Cookie value too long: ${stringValue.length} bytes (max 4096)`);
    }

    // SECURITY: Validate domain option
    if (options.domain && /[\r\n\x00]/.test(String(options.domain))) {
      throw new Error('Cookie domain cannot contain CRLF or null characters');
    }

    // SECURITY: Validate path option
    if (options.path && /[\r\n\x00]/.test(String(options.path))) {
      throw new Error('Cookie path cannot contain CRLF or null characters');
    }

    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (options.domain) {
      cookieString += `; Domain=${options.domain}`;
    }

    if (options.path) {
      cookieString += `; Path=${options.path}`;
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
      cookieString += `; SameSite=${options.sameSite}`;
    }

    this.append('Set-Cookie', cookieString);
    return this;
  }

  clearCookie(name, options = {}) {
    const clearOptions = {
      ...options,
      expires: new Date(0),
      maxAge: 0
    };
    return this.cookie(name, '', clearOptions);
  }

  redirect(url, status = 302) {
    this.status(status);
    this.set('Location', url);
    this.end();
    return this;
  }

  location(url) {
    this.set('Location', url);
    return this;
  }

  links(links) {
    let linkHeader = this.get('Link') || '';
    
    Object.keys(links).forEach(rel => {
      if (linkHeader) linkHeader += ', ';
      linkHeader += `<${links[rel]}>; rel="${rel}"`;
    });

    this.set('Link', linkHeader);
    return this;
  }

  type(type) {
    const mimeTypes = {
      html: 'text/html',
      json: 'application/json',
      xml: 'application/xml',
      text: 'text/plain',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      css: 'text/css',
      js: 'application/javascript',
      pdf: 'application/pdf'
    };

    const contentType = mimeTypes[type] || type;
    this.set('Content-Type', contentType);
    return this;
  }

  format(obj) {
    // BUG FIX: Correct callback signature to match Express.js behavior
    const keys = Object.keys(obj);
    const accepts = this.req ? this.req.accepts(keys) : false;

    if (accepts && obj[accepts]) {
      this.type(accepts);
      // Call formatter with no arguments per Express convention
      obj[accepts]();
      return this;
    }

    // BUG FIX: Return early after sending 406 response
    this.status(406).send('Not Acceptable');
    return this;
  }

  attachment(filename) {
    if (filename) {
      // SECURITY: Sanitize filename to prevent CRLF injection and header injection
      const sanitizedFilename = filename
        .replace(/[\r\n]/g, '')      // Remove CRLF characters
        .replace(/["\\]/g, '\\$&')   // Escape quotes and backslashes
        .replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII characters

      // Validate sanitized filename is not empty and not too long
      if (!sanitizedFilename || sanitizedFilename.length === 0) {
        throw new Error('Invalid filename: cannot be empty after sanitization');
      }

      if (sanitizedFilename.length > 255) {
        throw new Error('Invalid filename: too long (max 255 characters)');
      }

      this.type(path.extname(sanitizedFilename));
      this.set('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    } else {
      this.set('Content-Disposition', 'attachment');
    }
    return this;
  }

  json(obj) {
    this.type('json');
    this.send(JSON.stringify(obj));
    return this;
  }

  jsonp(obj) {
    const callback = this.req.query.callback || 'callback';

    // Validate callback is a valid JavaScript identifier or dotted path
    // Allows: functionName, obj.method, namespace.obj.method, etc.
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(callback)) {
      return this.status(400).json({ error: 'Invalid callback name' });
    }

    // Limit callback length to prevent abuse
    if (callback.length > 255) {
      return this.status(400).json({ error: 'Callback name too long' });
    }

    this.type('text/javascript');
    this.set('X-Content-Type-Options', 'nosniff');
    this.send(`/**/ typeof ${callback} === 'function' && ${callback}(${JSON.stringify(obj)})`);
    return this;
  }

  send(body) {
    if (this.finished) {
      return this;
    }

    this.writeHead();

    if (body === null || body === undefined) {
      this.res.end();
    } else if (typeof body === 'string') {
      if (!this.get('Content-Type')) {
        this.type('html');
      }
      this.res.end(body);
    } else if (Buffer.isBuffer(body)) {
      if (!this.get('Content-Type')) {
        this.type('application/octet-stream');
      }
      this.res.end(body);
    } else {
      this.json(body);
    }

    this.finished = true;
    return this;
  }

  async sendFile(filePath, options = {}) {
    try {
      // SECURITY FIX: Validate file path to prevent path traversal attacks
      // Reject paths with .. or other traversal attempts
      if (!filePath || typeof filePath !== 'string') {
        return this.status(400).send('Invalid file path');
      }

      // Check for path traversal attempts
      if (filePath.includes('..') || filePath.includes('\0')) {
        return this.status(403).send('Forbidden');
      }

      // Resolve to absolute path
      const resolvedPath = path.resolve(filePath);

      // If root directory specified, verify file is within allowed directory
      if (options.root) {
        const rootPath = path.resolve(options.root);
        if (!resolvedPath.startsWith(rootPath + path.sep) && resolvedPath !== rootPath) {
          return this.status(403).send('Forbidden');
        }
      }

      const stats = await stat(resolvedPath);

      if (!stats.isFile()) {
        return this.status(404).send('File not found');
      }

      const ext = path.extname(resolvedPath);
      this.type(ext);

      if (options.maxAge) {
        this.set('Cache-Control', `public, max-age=${options.maxAge}`);
      }

      this.set('Content-Length', stats.size);
      this.set('Last-Modified', stats.mtime.toUTCString());

      const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
      this.set('ETag', etag);

      // SECURITY: Enhanced ETag comparison to handle weak ETags and comma-separated lists
      if (this.req && this.req.headers && this.req.headers['if-none-match']) {
        const ifNoneMatch = this.req.headers['if-none-match'];
        // Handle wildcard or comma-separated ETags
        if (ifNoneMatch === '*' || this.etagMatches(etag, ifNoneMatch)) {
          return this.status(304).end();
        }
      }

      if (options.headers) {
        this.set(options.headers);
      }

      this.writeHead();

      const stream = fs.createReadStream(resolvedPath);

      // SECURITY: Attach error handler BEFORE piping to prevent unhandled stream errors
      stream.on('error', (error) => {
        console.error('Error sending file:', error);
        if (!this.headersSent) {
          this.status(500).send('Internal Server Error');
        }
      });

      stream.on('end', () => {
        this.finished = true;
      });

      stream.pipe(this.res);

    } catch (error) {
      console.error('Error in sendFile:', error);
      if (!this.headersSent) {
        this.status(404).send('File not found');
      }
    }

    return this;
  }

  async sendStatus(statusCode) {
    this.status(statusCode);
    this.send(STATUS_CODES[statusCode] || 'Unknown Status');
    return this;
  }

  download(filePath, filename, options = {}) {
    const name = filename || path.basename(filePath);
    this.attachment(name);
    return this.sendFile(filePath, options);
  }

  render(view, locals = {}, callback) {
    if (typeof locals === 'function') {
      callback = locals;
      locals = {};
    }

    const renderLocals = { ...this.locals, ...locals };

    if (this.app.render) {
      this.app.render(view, renderLocals, (err, html) => {
        if (err) {
          if (callback) return callback(err);
          throw err;
        }
        
        this.send(html);
        if (callback) callback(null, html);
      });
    } else {
      const error = new Error('No template engine configured');
      if (callback) return callback(error);
      throw error;
    }

    return this;
  }

  vary(field) {
    this.append('Vary', field);
    return this;
  }

  etagMatches(etag, ifNoneMatch) {
    // SECURITY: Compare ETags safely, handling weak ETags (W/"...")
    // Split by comma to handle multiple ETags
    const tags = ifNoneMatch.split(',').map(tag => tag.trim());

    for (const tag of tags) {
      // Remove weak indicator for comparison if present
      const normalizedTag = tag.replace(/^W\//, '');
      const normalizedEtag = etag.replace(/^W\//, '');

      if (normalizedTag === normalizedEtag) {
        return true;
      }
    }

    return false;
  }

  writeHead() {
    if (this.headersSent) {
      return;
    }

    this.res.statusCode = this.statusCode;

    Object.keys(this.headers).forEach(name => {
      this.res.setHeader(name, this.headers[name]);
    });

    this.headersSent = true;
  }

  write(chunk, encoding) {
    if (!this.headersSent) {
      this.writeHead();
    }
    return this.res.write(chunk, encoding);
  }

  end(data, encoding) {
    if (!this.headersSent) {
      this.writeHead();
    }
    
    this.finished = true;
    this.res.end(data, encoding);
    return this;
  }

  destroy() {
    this.res.destroy();
    return this;
  }

  setTimeout(msecs, callback) {
    this.res.setTimeout(msecs, callback);
    return this;
  }

  writableEnded() {
    return this.res.writableEnded;
  }

  writable() {
    return this.res.writable;
  }

  toString() {
    return `Response ${this.statusCode}`;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      headers: this.headers,
      finished: this.finished,
      headersSent: this.headersSent
    };
  }
}

module.exports = Response;