'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

// SECURITY: File operation timeout to prevent hanging on slow/malicious filesystems
const FILE_OPERATION_TIMEOUT = 5000; // 5 seconds

/**
 * Wraps a promise with a timeout to prevent indefinite hangs
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeout = FILE_OPERATION_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('File operation timeout')), timeout)
    )
  ]);
}

const DEFAULT_MAX_AGE = 0;
const DEFAULT_INDEX = ['index.html'];

function staticFiles(root, options = {}) {
  const opts = {
    root: path.resolve(root),
    maxAge: options.maxAge || DEFAULT_MAX_AGE,
    index: options.index || DEFAULT_INDEX,
    hidden: options.hidden || false,
    dotfiles: options.dotfiles || 'ignore',
    etag: options.etag !== false,
    lastModified: options.lastModified !== false,
    extensions: options.extensions || [],
    fallthrough: options.fallthrough !== false,
    redirect: options.redirect !== false,
    setHeaders: options.setHeaders,
    ...options
  };

  const cache = new Map();

  return async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next();
    }

    let pathname;
    try {
      pathname = decodeURIComponent(ctx.path);
    } catch (e) {
      return ctx.status(400).json({ error: 'Invalid URL encoding' });
    }
    
    // Normalize the path to prevent directory traversal
    const normalizedPath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    
    // Ensure the path doesn't contain any traversal patterns
    if (pathname.includes('..') || pathname.includes('\0')) {
      if (opts.fallthrough) {
        return next();
      }
      return ctx.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(opts.root, normalizedPath);
    
    // Ensure the resolved path is within the root directory
    if (!filePath.startsWith(opts.root)) {
      if (opts.fallthrough) {
        return next();
      }
      return ctx.status(403).json({ error: 'Forbidden' });
    }
    
    try {
      // SECURITY: Add timeout to prevent hanging on slow/malicious filesystems
      const stats = await withTimeout(stat(filePath));
      
      if (stats.isDirectory()) {
        return await handleDirectory(ctx, filePath, opts, next);
      }
      
      if (stats.isFile()) {
        return await sendFile(ctx, filePath, stats, opts);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return await tryExtensions(ctx, filePath, opts, next);
      }
      
      if (opts.fallthrough) {
        return next();
      }
      
      return ctx.status(500).json({ error: 'Internal Server Error' });
    }

    if (opts.fallthrough) {
      return next();
    }
    
    ctx.status(404).json({ error: 'Not Found' });
  };
}

async function handleDirectory(ctx, dirPath, opts, next) {
  if (opts.redirect && !ctx.path.endsWith('/')) {
    // Using string concatenation for URL paths (not filesystem paths)
    const redirectPath = `${ctx.path}/`;
    return ctx.redirect(redirectPath);
  }

  for (const indexFile of opts.index) {
    const indexPath = path.join(dirPath, indexFile);

    try {
      // SECURITY: Add timeout to prevent hanging on slow/malicious filesystems
      const stats = await withTimeout(stat(indexPath));
      if (stats.isFile()) {
        return await sendFile(ctx, indexPath, stats, opts);
      }
    } catch (error) {
      continue;
    }
  }

  if (opts.fallthrough) {
    return next();
  }
  
  ctx.status(404).json({ error: 'Not Found' });
}

async function tryExtensions(ctx, filePath, opts, next) {
  for (const ext of opts.extensions) {
    const extPath = filePath + ext;

    try {
      // SECURITY: Add timeout to prevent hanging on slow/malicious filesystems
      const stats = await withTimeout(stat(extPath));
      if (stats.isFile()) {
        return await sendFile(ctx, extPath, stats, opts);
      }
    } catch (error) {
      continue;
    }
  }

  if (opts.fallthrough) {
    return next();
  }
  
  ctx.status(404).json({ error: 'Not Found' });
}

async function sendFile(ctx, filePath, stats, opts) {
  const basename = path.basename(filePath);
  
  if (!opts.hidden && basename.startsWith('.')) {
    if (opts.dotfiles === 'deny') {
      return ctx.status(403).json({ error: 'Forbidden' });
    } else if (opts.dotfiles === 'ignore') {
      return ctx.status(404).json({ error: 'Not Found' });
    }
  }

  const contentType = getContentType(filePath);
  ctx.set('Content-Type', contentType);
  ctx.set('Content-Length', stats.size);

  if (opts.lastModified) {
    ctx.set('Last-Modified', stats.mtime.toUTCString());
  }

  if (opts.etag) {
    const etag = generateETag(stats);
    ctx.set('ETag', etag);
    
    if (ctx.get('if-none-match') === etag) {
      return ctx.status(304).end();
    }
  }

  if (opts.maxAge) {
    const cacheControl = `public, max-age=${opts.maxAge}`;
    ctx.set('Cache-Control', cacheControl);
  }

  const range = ctx.get('range');
  if (range) {
    return await sendRangeFile(ctx, filePath, stats, range);
  }

  // SECURITY WARNING: setHeaders callback receives the actual file system path
  // Callbacks MUST sanitize the filePath before using it in response headers
  // to prevent information disclosure and header injection attacks.
  // Example: path.basename(filePath) to get only the filename
  if (opts.setHeaders) {
    opts.setHeaders(ctx, filePath, stats);
  }

  if (ctx.method === 'HEAD') {
    return ctx.status(200).end();
  }

  try {
    // SECURITY: Add timeout to prevent hanging on slow/malicious filesystems
    const content = await withTimeout(readFile(filePath));
    ctx.status(200).send(content);
  } catch (error) {
    if (error.message === 'File operation timeout') {
      ctx.status(504).json({ error: 'Gateway Timeout' });
    } else {
      ctx.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

async function sendRangeFile(ctx, filePath, stats, rangeHeader) {
  const ranges = parseRange(stats.size, rangeHeader);
  
  if (!ranges || ranges.length === 0) {
    ctx.set('Content-Range', `bytes */${stats.size}`);
    return ctx.status(416).json({ error: 'Range Not Satisfiable' });
  }

  if (ranges.length === 1) {
    const range = ranges[0];
    const start = range.start;
    const end = range.end;
    const chunkSize = end - start + 1;

    ctx.set('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    ctx.set('Content-Length', chunkSize);
    ctx.set('Accept-Ranges', 'bytes');
    ctx.status(206);

    const stream = fs.createReadStream(filePath, { start, end });

    // SECURITY: Attach error handler BEFORE piping to prevent unhandled stream errors
    stream.on('error', (error) => {
      console.error('Error streaming range file:', error);
      if (!ctx.headersSent) {
        ctx.status(500).json({ error: 'Internal Server Error' });
      } else {
        ctx.res.destroy();
      }
    });

    stream.pipe(ctx.res);
  } else {
    ctx.status(416).json({ error: 'Multiple ranges not supported' });
  }
}

function parseRange(size, rangeHeader) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const ranges = [];
  const parts = rangeHeader.slice(6).split(',');

  for (const part of parts) {
    const [start, end] = part.trim().split('-');
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (isNaN(startNum) && isNaN(endNum)) {
      continue;
    }

    if (isNaN(startNum)) {
      // Suffix range: last N bytes
      ranges.push({ start: Math.max(0, size - endNum), end: size - 1 });
    } else if (isNaN(endNum)) {
      // Open-ended range: from start to end
      ranges.push({ start: startNum, end: size - 1 });
    } else {
      // SECURITY: Validate that start <= end to prevent invalid ranges
      if (startNum > endNum) {
        continue; // Skip invalid range
      }
      ranges.push({ start: startNum, end: Math.min(endNum, size - 1) });
    }
  }

  return ranges;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

function generateETag(stats) {
  const hash = crypto.createHash('md5');
  hash.update(stats.size.toString());
  hash.update(stats.mtime.getTime().toString());
  return `"${hash.digest('hex')}"`;
}

function serveStatic(root, options) {
  return staticFiles(root, options);
}

module.exports = staticFiles;
module.exports.serveStatic = serveStatic;