'use strict';

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

const DEFAULT_THRESHOLD = 1024;
const DEFAULT_LEVEL = 6;

function compression(options = {}) {
  const opts = {
    threshold: options.threshold || DEFAULT_THRESHOLD,
    level: options.level || DEFAULT_LEVEL,
    chunkSize: options.chunkSize || 16 * 1024,
    windowBits: options.windowBits || 15,
    memLevel: options.memLevel || 8,
    strategy: options.strategy || zlib.constants.Z_DEFAULT_STRATEGY,
    filter: options.filter || shouldCompress,
    ...options
  };

  return async (ctx, next) => {
    const originalSend = ctx.send;
    
    ctx.send = function(body) {
      return compressResponse.call(this, body, opts, originalSend);
    };

    await next();
  };
}

async function compressResponse(body, opts, originalSend) {
  if (this.headersSent || this.responded) {
    return originalSend.call(this, body);
  }

  const shouldCompress = opts.filter(this, body);
  if (!shouldCompress) {
    return originalSend.call(this, body);
  }

  const acceptEncoding = this.get('accept-encoding') || '';
  const encoding = getPreferredEncoding(acceptEncoding);
  
  if (!encoding) {
    return originalSend.call(this, body);
  }

  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  
  if (bodyBuffer.length < opts.threshold) {
    return originalSend.call(this, body);
  }

  try {
    const compressed = await compressBuffer(bodyBuffer, encoding, opts);

    this.set('Content-Encoding', encoding);
    this.set('Content-Length', compressed.length);
    this.set('Vary', 'Accept-Encoding');

    return originalSend.call(this, compressed);
  } catch (error) {
    return originalSend.call(this, body);
  }
}

function shouldCompress(ctx, body) {
  const contentType = ctx.get('content-type');
  
  if (!contentType) {
    return false;
  }

  const compressibleTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'image/svg+xml'
  ];

  return compressibleTypes.some(type => contentType.includes(type));
}

function getPreferredEncoding(acceptEncoding) {
  const encodings = parseAcceptEncoding(acceptEncoding);
  
  if (encodings.br && encodings.br.q > 0) {
    return 'br';
  }
  
  if (encodings.gzip && encodings.gzip.q > 0) {
    return 'gzip';
  }
  
  if (encodings.deflate && encodings.deflate.q > 0) {
    return 'deflate';
  }
  
  return null;
}

function parseAcceptEncoding(acceptEncoding) {
  const encodings = {};
  
  if (!acceptEncoding) {
    return encodings;
  }

  acceptEncoding.split(',').forEach(encoding => {
    const parts = encoding.trim().split(';');
    const name = parts[0].trim();
    
    let q = 1;
    if (parts[1]) {
      const qMatch = parts[1].match(/q=([0-9.]+)/);
      if (qMatch) {
        q = parseFloat(qMatch[1]);
      }
    }
    
    encodings[name] = { q };
  });

  return encodings;
}

async function compressBuffer(buffer, encoding, opts) {
  const options = {
    level: opts.level,
    chunkSize: opts.chunkSize,
    windowBits: opts.windowBits,
    memLevel: opts.memLevel,
    strategy: opts.strategy
  };

  switch (encoding) {
    case 'br':
      return await brotliCompress(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: opts.level
        }
      });
    case 'gzip':
      return await gzip(buffer, options);
    case 'deflate':
      return await deflate(buffer, options);
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

function gzipCompression(options) {
  return compression({ ...options, filter: (ctx, body) => {
    const acceptEncoding = ctx.get('accept-encoding') || '';
    return acceptEncoding.includes('gzip') && shouldCompress(ctx, body);
  }});
}

function deflateCompression(options) {
  return compression({ ...options, filter: (ctx, body) => {
    const acceptEncoding = ctx.get('accept-encoding') || '';
    return acceptEncoding.includes('deflate') && shouldCompress(ctx, body);
  }});
}

function brotliCompression(options) {
  return compression({ ...options, filter: (ctx, body) => {
    const acceptEncoding = ctx.get('accept-encoding') || '';
    return acceptEncoding.includes('br') && shouldCompress(ctx, body);
  }});
}

module.exports = compression;
module.exports.gzip = gzipCompression;
module.exports.deflate = deflateCompression;
module.exports.brotli = brotliCompression;