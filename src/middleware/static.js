const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

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
      const stats = await stat(filePath);
      
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
      const stats = await stat(indexPath);
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
      const stats = await stat(extPath);
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

  if (opts.setHeaders) {
    opts.setHeaders(ctx, filePath, stats);
  }

  if (ctx.method === 'HEAD') {
    return ctx.status(200).end();
  }

  try {
    const content = await readFile(filePath);
    ctx.status(200).send(content);
  } catch (error) {
    ctx.status(500).json({ error: 'Internal Server Error' });
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
    const startNum = parseInt(start);
    const endNum = parseInt(end);

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