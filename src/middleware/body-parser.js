'use strict';

/**
 * @fileoverview Body parsing middleware for Spark Framework
 * @author Spark Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

const querystring = require('querystring');
const { Readable } = require('stream');

/** @constant {number} Default size limit for request bodies (1MB) */
const DEFAULT_LIMIT = 1024 * 1024; // 1MB

/** @constant {boolean} Default extended parsing setting */
const DEFAULT_EXTENDED = true;

/**
 * Create a body parsing middleware
 * 
 * Automatically parses request bodies based on Content-Type header.
 * Supports JSON, URL-encoded, multipart/form-data, text, and raw binary data.
 * Provides security features like size limits and content validation.
 * 
 * @param {Object} [options={}] - Body parser configuration options
 * @param {number} [options.limit=1048576] - Maximum request body size in bytes (default: 1MB)
 * @param {boolean} [options.extended=true] - Use extended URL encoding parsing
 * @param {string} [options.type='auto'] - Force parsing type ('auto', 'json', 'urlencoded', 'multipart', 'text', 'raw')
 * @param {string} [options.encoding='utf8'] - Text encoding for parsing
 * @param {boolean} [options.inflate=true] - Enable gzip/deflate decompression
 * @param {boolean} [options.strict=true] - Enable strict parsing
 * @param {Function} [options.verify] - Custom verification function
 * @returns {Function} Express-style middleware function
 * 
 * @since 1.0.0
 * 
 * @example
 * // Auto-detect content type
 * app.use(bodyParser());
 * 
 * @example
 * // JSON only with custom limit
 * app.use(bodyParser({
 *   type: 'json',
 *   limit: 1024 * 512 // 512KB
 * }));
 * 
 * @example
 * // With verification
 * app.use(bodyParser({
 *   verify: (req, res, body) => {
 *     if (body.length > 1000) {
 *       throw new Error('Body too large');
 *     }
 *   }
 * }));
 * 
 * @example
 * // Multiple content types
 * app.use(bodyParser({ type: 'json' }));
 * app.use(bodyParser({ type: 'urlencoded' }));
 * app.use(bodyParser({ type: 'text' }));
 */
function bodyParser(options = {}) {
  const opts = {
    limit: options.limit || DEFAULT_LIMIT,
    extended: options.extended !== false,
    type: options.type || 'auto',
    encoding: options.encoding || 'utf8',
    inflate: options.inflate !== false,
    strict: options.strict !== false,
    verify: options.verify,
    ...options
  };

  return async (ctx, next) => {
    if (ctx.body !== null || ctx.method === 'GET' || ctx.method === 'HEAD') {
      return next();
    }

    const contentType = ctx.get('content-type') || '';
    const contentLength = parseInt(ctx.get('content-length'), 10) || 0;

    // SECURITY: Validate Content-Length is not negative (bypass attempt)
    if (contentLength < 0) {
      ctx.status(400).json({ error: 'Invalid Content-Length: must be non-negative' });
      return;
    }

    if (contentLength > opts.limit) {
      ctx.status(413).json({ error: 'Request entity too large' });
      return;
    }

    try {
      if (shouldParseJson(contentType, opts.type)) {
        await parseJson(ctx, opts);
      } else if (shouldParseUrlencoded(contentType, opts.type)) {
        await parseUrlencoded(ctx, opts);
      } else if (shouldParseMultipart(contentType, opts.type)) {
        await parseMultipart(ctx, opts);
      } else if (shouldParseText(contentType, opts.type)) {
        await parseText(ctx, opts);
      } else if (shouldParseRaw(contentType, opts.type)) {
        await parseRaw(ctx, opts);
      }

      if (opts.verify) {
        await Promise.resolve(opts.verify(ctx.req, ctx.res, ctx.body));
      }

      await next();
    } catch (error) {
      ctx.status(400).json({ 
        error: 'Bad Request', 
        message: error.message,
        type: error.name
      });
    }
  };
}

/**
 * Check if content should be parsed as JSON
 * 
 * @param {string} contentType - Request Content-Type header
 * @param {string} type - Parser type setting
 * @returns {boolean} Whether to parse as JSON
 * 
 * @private
 * @since 1.0.0
 */
function shouldParseJson(contentType, type) {
  if (type === 'json') return true;
  if (type === 'auto') return contentType.includes('application/json');
  return false;
}

/**
 * Check if content should be parsed as URL-encoded
 * 
 * @param {string} contentType - Request Content-Type header
 * @param {string} type - Parser type setting
 * @returns {boolean} Whether to parse as URL-encoded
 * 
 * @private
 * @since 1.0.0
 */
function shouldParseUrlencoded(contentType, type) {
  if (type === 'urlencoded') return true;
  if (type === 'auto') return contentType.includes('application/x-www-form-urlencoded');
  return false;
}

/**
 * Check if content should be parsed as multipart
 * 
 * @param {string} contentType - Request Content-Type header
 * @param {string} type - Parser type setting
 * @returns {boolean} Whether to parse as multipart
 * 
 * @private
 * @since 1.0.0
 */
function shouldParseMultipart(contentType, type) {
  if (type === 'multipart') return true;
  if (type === 'auto') return contentType.includes('multipart/form-data');
  return false;
}

/**
 * Check if content should be parsed as text
 * 
 * @param {string} contentType - Request Content-Type header
 * @param {string} type - Parser type setting
 * @returns {boolean} Whether to parse as text
 * 
 * @private
 * @since 1.0.0
 */
function shouldParseText(contentType, type) {
  if (type === 'text') return true;
  if (type === 'auto') return contentType.includes('text/');
  return false;
}

/**
 * Check if content should be parsed as raw binary
 * 
 * @param {string} contentType - Request Content-Type header
 * @param {string} type - Parser type setting
 * @returns {boolean} Whether to parse as raw binary
 * 
 * @private
 * @since 1.0.0
 */
function shouldParseRaw(contentType, type) {
  return type === 'raw';
}

/**
 * Parse request body as JSON
 * 
 * @param {Context} ctx - Request context
 * @param {Object} opts - Parser options
 * @returns {Promise<void>}
 * 
 * @throws {Error} When JSON parsing fails
 * 
 * @private
 * @since 1.0.0
 */
async function parseJson(ctx, opts) {
  const body = await readBody(ctx.req, opts);
  
  try {
    ctx.body = JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Parse request body as URL-encoded form data
 * 
 * @param {Context} ctx - Request context
 * @param {Object} opts - Parser options
 * @returns {Promise<void>}
 * 
 * @private
 * @since 1.0.0
 */
async function parseUrlencoded(ctx, opts) {
  const body = await readBody(ctx.req, opts);
  ctx.body = querystring.parse(body);
}

async function parseMultipart(ctx, opts) {
  const contentType = ctx.get('content-type');
  const boundary = getBoundary(contentType);
  
  if (!boundary) {
    throw new Error('Invalid multipart/form-data: missing boundary');
  }

  const chunks = [];
  let size = 0;
  
  await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      size += chunk.length;
      if (size > opts.limit) {
        ctx.req.removeListener('data', onData);
        ctx.req.removeListener('end', onEnd);
        ctx.req.removeListener('error', onError);
        // SECURITY: Destroy stream to prevent resource leaks on error
        ctx.req.destroy();
        return reject(new Error('Request entity too large'));
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      ctx.req.removeListener('data', onData);
      ctx.req.removeListener('error', onError);
      resolve();
    };

    const onError = (error) => {
      ctx.req.removeListener('data', onData);
      ctx.req.removeListener('end', onEnd);
      // SECURITY: Destroy stream to prevent resource leaks on error
      ctx.req.destroy();
      reject(error);
    };
    
    ctx.req.on('data', onData);
    ctx.req.on('end', onEnd);
    ctx.req.on('error', onError);
  });
  
  const body = Buffer.concat(chunks).toString('binary');
  const parsed = parseMultipartData(body, boundary);
  
  ctx.body = parsed.fields;
  ctx.files = parsed.files;
}

/**
 * Parse request body as plain text
 * 
 * @param {Context} ctx - Request context
 * @param {Object} opts - Parser options
 * @returns {Promise<void>}
 * 
 * @private
 * @since 1.0.0
 */
async function parseText(ctx, opts) {
  ctx.body = await readBody(ctx.req, opts);
}

/**
 * Parse request body as raw binary data
 * 
 * @param {Context} ctx - Request context
 * @param {Object} opts - Parser options
 * @returns {Promise<void>}
 * 
 * @throws {Error} When request is too large
 * 
 * @private
 * @since 1.0.0
 */
async function parseRaw(ctx, opts) {
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    let size = 0;
    
    const onData = (chunk) => {
      size += chunk.length;
      if (size > opts.limit) {
        ctx.req.removeListener('data', onData);
        ctx.req.removeListener('end', onEnd);
        ctx.req.removeListener('error', onError);
        // SECURITY: Destroy stream to prevent resource leaks on error
        ctx.req.destroy();
        return reject(new Error('Request entity too large'));
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      ctx.req.removeListener('data', onData);
      ctx.req.removeListener('error', onError);
      ctx.body = Buffer.concat(chunks);
      resolve();
    };

    const onError = (error) => {
      ctx.req.removeListener('data', onData);
      ctx.req.removeListener('end', onEnd);
      // SECURITY: Destroy stream to prevent resource leaks on error
      ctx.req.destroy();
      reject(error);
    };
    
    ctx.req.on('data', onData);
    ctx.req.on('end', onEnd);
    ctx.req.on('error', onError);
  });
}

/**
 * Read and decode request body as text
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {Object} opts - Parser options with encoding and limit
 * @returns {Promise<string>} Promise resolving to decoded body text
 * 
 * @throws {Error} When request is too large
 * 
 * @private
 * @since 1.0.0
 */
function readBody(req, opts) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    
    const onData = (chunk) => {
      size += chunk.length;
      if (size > opts.limit) {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        return reject(new Error('Request entity too large'));
      }
      chunks.push(chunk);
    };
    
    const onEnd = () => {
      req.removeListener('data', onData);
      req.removeListener('error', onError);
      const body = Buffer.concat(chunks).toString(opts.encoding || 'utf8');
      resolve(body);
    };
    
    const onError = (error) => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      reject(error);
    };
    
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/**
 * Extract boundary from multipart Content-Type header
 *
 * @param {string} contentType - Content-Type header value
 * @returns {string|null} Boundary string or null if not found
 *
 * @private
 * @since 1.0.0
 */
function getBoundary(contentType) {
  // SECURITY: Use indexOf instead of regex to prevent ReDoS attacks
  const boundaryIndex = contentType.indexOf('boundary=');
  if (boundaryIndex === -1) return null;

  const boundaryStart = boundaryIndex + 'boundary='.length;
  let boundaryEnd = contentType.indexOf(';', boundaryStart);

  // If no semicolon found, boundary extends to end of string
  if (boundaryEnd === -1) {
    boundaryEnd = contentType.length;
  }

  let boundary = contentType.substring(boundaryStart, boundaryEnd).trim();

  // Remove quotes if present (single or double)
  if (boundary.length >= 2) {
    if ((boundary[0] === '"' && boundary[boundary.length - 1] === '"') ||
        (boundary[0] === "'" && boundary[boundary.length - 1] === "'")) {
      boundary = boundary.substring(1, boundary.length - 1);
    }
  }

  // SECURITY: Validate boundary per RFC 2046 (up to 70 chars)
  // This prevents empty or excessively long boundaries that could cause DoS
  if (!boundary || boundary.length === 0 || boundary.length > 70) {
    return null;
  }

  return boundary;
}

/**
 * Parse multipart/form-data body content
 * 
 * @param {string} body - Raw multipart body as binary string
 * @param {string} boundary - Multipart boundary string
 * @returns {Object} Object with fields and files properties
 * @returns {Object} returns.fields - Parsed form fields
 * @returns {Object} returns.files - Parsed file uploads with metadata
 * 
 * @private
 * @since 1.0.0
 */
function parseMultipartData(body, boundary) {
  // Use null-prototype objects to prevent prototype pollution
  const fields = Object.create(null);
  const files = Object.create(null);

  // Dangerous property names that should never be set
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  const parts = body.split(`--${boundary}`);

  for (let i = 1; i < parts.length - 1; i++) {
    // SECURITY: Defensive bounds check to ensure part exists
    if (!parts[i]) continue;
    const part = parts[i];

    // Split only on first occurrence of \r\n\r\n to preserve data
    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;

    const headers = part.substring(0, headerEndIndex);
    const content = part.substring(headerEndIndex + 4); // +4 for '\r\n\r\n'

    if (!headers || content === undefined) continue;

    const headerLines = headers.split('\r\n');
    const contentDisposition = headerLines.find(line =>
      line.startsWith('Content-Disposition:')
    );

    if (!contentDisposition) continue;

    const nameMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

    if (!nameMatch) continue;

    const name = nameMatch[1];

    // SECURITY: Prevent prototype pollution attacks
    if (!name || dangerousKeys.includes(name) || name.includes('__proto__')) {
      console.warn(`[SECURITY] Blocked potentially malicious field name: ${name}`);
      continue;
    }

    const filename = filenameMatch ? filenameMatch[1] : null;

    if (filename) {
      const contentType = headerLines.find(line =>
        line.startsWith('Content-Type:')
      );

      // SECURITY: Sanitize filename to prevent path traversal and null byte injection
      const sanitizedFilename = filename
        .replace(/[\/\\]/g, '') // Remove path separators
        .replace(/\.\./g, '')   // Remove parent directory references
        .replace(/\0/g, '')     // Remove null bytes (prevents null-terminated string attacks)
        .substring(0, 255);     // Limit length to prevent buffer overflow

      files[name] = {
        filename: sanitizedFilename,
        contentType: contentType ? contentType.split(': ')[1] : 'application/octet-stream',
        size: Buffer.byteLength(content.slice(0, -2)),
        data: Buffer.from(content.slice(0, -2))
      };
    } else {
      fields[name] = content.slice(0, -2);
    }
  }

  return { fields, files };
}

/**
 * Create a JSON body parser middleware
 * 
 * @param {Object} [options] - Parser options (merged with type: 'json')
 * @returns {Function} Middleware function for parsing JSON bodies
 * 
 * @since 1.0.0
 * 
 * @example
 * app.use(json({ limit: '10mb' }));
 */
function json(options) {
  return bodyParser({ ...options, type: 'json' });
}

/**
 * Create a URL-encoded body parser middleware
 * 
 * @param {Object} [options] - Parser options (merged with type: 'urlencoded')
 * @returns {Function} Middleware function for parsing URL-encoded bodies
 * 
 * @since 1.0.0
 * 
 * @example
 * app.use(urlencoded({ extended: true }));
 */
function urlencoded(options) {
  return bodyParser({ ...options, type: 'urlencoded' });
}

/**
 * Create a text body parser middleware
 * 
 * @param {Object} [options] - Parser options (merged with type: 'text')
 * @returns {Function} Middleware function for parsing text bodies
 * 
 * @since 1.0.0
 * 
 * @example
 * app.use(text({ encoding: 'utf16' }));
 */
function text(options) {
  return bodyParser({ ...options, type: 'text' });
}

/**
 * Create a raw binary body parser middleware
 * 
 * @param {Object} [options] - Parser options (merged with type: 'raw')
 * @returns {Function} Middleware function for parsing raw binary bodies
 * 
 * @since 1.0.0
 * 
 * @example
 * app.use(raw({ limit: '5mb' }));
 */
function raw(options) {
  return bodyParser({ ...options, type: 'raw' });
}

module.exports = bodyParser;
module.exports.json = json;
module.exports.urlencoded = urlencoded;
module.exports.text = text;
module.exports.raw = raw;