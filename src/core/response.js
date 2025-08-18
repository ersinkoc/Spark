'use strict';

const { STATUS_CODES } = require('http');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

class Response {
  constructor(res) {
    this.res = res;
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
    const keys = Object.keys(obj);
    const accepts = this.req.accepts(keys);

    if (accepts) {
      this.type(accepts);
      obj[accepts](this.req, this);
    } else {
      this.status(406).send('Not Acceptable');
    }

    return this;
  }

  attachment(filename) {
    if (filename) {
      this.type(path.extname(filename));
      this.set('Content-Disposition', `attachment; filename="${filename}"`);
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
    this.type('text/javascript');
    this.send(`${callback}(${JSON.stringify(obj)})`);
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
      const stats = await stat(filePath);
      
      if (!stats.isFile()) {
        return this.status(404).send('File not found');
      }

      const ext = path.extname(filePath);
      this.type(ext);

      if (options.maxAge) {
        this.set('Cache-Control', `public, max-age=${options.maxAge}`);
      }

      this.set('Content-Length', stats.size);
      this.set('Last-Modified', stats.mtime.toUTCString());

      const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
      this.set('ETag', etag);

      if (this.req.headers['if-none-match'] === etag) {
        return this.status(304).end();
      }

      if (options.headers) {
        this.set(options.headers);
      }

      this.writeHead();
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(this.res);
      
      stream.on('end', () => {
        this.finished = true;
      });

      stream.on('error', (error) => {
        this.status(500).send('Internal Server Error');
      });

    } catch (error) {
      this.status(404).send('File not found');
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

  headersSent() {
    return this.headersSent;
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