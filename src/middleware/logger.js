const util = require('util');
const { EventEmitter } = require('events');

const DEFAULT_FORMAT = ':method :url :status :response-time ms';
const DEFAULT_SKIP = () => false;

class Logger extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      format: options.format || DEFAULT_FORMAT,
      skip: options.skip || DEFAULT_SKIP,
      stream: options.stream || process.stdout,
      immediate: options.immediate || false,
      ...options
    };
  }

  format(tokens, ctx) {
    const format = this.options.format;
    
    if (typeof format === 'function') {
      return format(tokens, ctx);
    }

    return format.replace(/:(\w+)/g, (match, token) => {
      return tokens[token] || '-';
    });
  }

  log(ctx, start, length) {
    if (this.options.skip(ctx)) {
      return;
    }

    const responseTime = Date.now() - start;
    const contentLength = length || ctx.get('content-length') || '-';

    const tokens = {
      method: ctx.method,
      url: ctx.originalUrl || ctx.url,
      status: ctx.statusCode,
      'response-time': responseTime,
      'content-length': contentLength,
      referrer: ctx.get('referrer') || ctx.get('referer') || '-',
      'user-agent': ctx.get('user-agent') || '-',
      'remote-addr': ctx.ip() || '-',
      'remote-user': ctx.user ? ctx.user.name : '-',
      date: new Date().toISOString(),
      'http-version': ctx.req.httpVersion,
      res: ctx.res
    };

    const line = this.format(tokens, ctx);
    
    if (this.options.stream) {
      this.options.stream.write(line + '\n');
    }

    this.emit('log', tokens, ctx);
  }
}

function logger(options = {}) {
  const log = new Logger(options);

  return async (ctx, next) => {
    const start = Date.now();
    
    if (options.immediate) {
      log.log(ctx, start);
    }

    await next();

    if (!options.immediate) {
      log.log(ctx, start);
    }
  };
}

function morgan(format, options = {}) {
  const formats = {
    combined: ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"',
    common: ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :content-length',
    dev: ':method :url :status :response-time ms - :content-length',
    short: ':remote-addr :remote-user :method :url HTTP/:http-version :status :content-length - :response-time ms',
    tiny: ':method :url :status :content-length - :response-time ms'
  };

  const logFormat = formats[format] || format || formats.dev;
  
  return logger({
    ...options,
    format: logFormat
  });
}

function accessLog(options = {}) {
  const opts = {
    format: 'combined',
    ...options
  };

  return morgan(opts.format, opts);
}

function devLogger(options = {}) {
  const colorStatus = (status) => {
    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // Red
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // Yellow
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // Cyan
    if (status >= 200) return `\x1b[32m${status}\x1b[0m`; // Green
    return status;
  };

  const colorMethod = (method) => {
    const colors = {
      GET: '\x1b[32m',    // Green
      POST: '\x1b[33m',   // Yellow
      PUT: '\x1b[34m',    // Blue
      DELETE: '\x1b[31m', // Red
      PATCH: '\x1b[35m',  // Magenta
      HEAD: '\x1b[36m',   // Cyan
      OPTIONS: '\x1b[37m' // White
    };
    
    const color = colors[method] || '\x1b[37m';
    return `${color}${method}\x1b[0m`;
  };

  return logger({
    format: (tokens, ctx) => {
      const method = colorMethod(tokens.method);
      const status = colorStatus(tokens.status);
      const url = tokens.url;
      const responseTime = tokens['response-time'];
      const contentLength = tokens['content-length'];
      
      return `${method} ${url} ${status} ${responseTime}ms - ${contentLength}`;
    },
    ...options
  });
}

function errorLogger(options = {}) {
  const opts = {
    skip: (ctx) => ctx.statusCode < 400,
    ...options
  };

  return logger(opts);
}

function requestLogger(options = {}) {
  const opts = {
    immediate: true,
    format: ':method :url',
    ...options
  };

  return logger(opts);
}

function structuredLogger(options = {}) {
  const opts = {
    format: (tokens, ctx) => {
      const logData = {
        timestamp: new Date().toISOString(),
        method: tokens.method,
        url: tokens.url,
        status: tokens.status,
        responseTime: tokens['response-time'],
        contentLength: tokens['content-length'],
        userAgent: tokens['user-agent'],
        ip: tokens['remote-addr'],
        referrer: tokens.referrer
      };

      return JSON.stringify(logData);
    },
    ...options
  };

  return logger(opts);
}

module.exports = logger;
module.exports.Logger = Logger;
module.exports.morgan = morgan;
module.exports.accessLog = accessLog;
module.exports.devLogger = devLogger;
module.exports.errorLogger = errorLogger;
module.exports.requestLogger = requestLogger;
module.exports.structuredLogger = structuredLogger;