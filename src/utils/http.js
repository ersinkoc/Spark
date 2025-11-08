'use strict';

const { STATUS_CODES } = require('http');

const HTTP_STATUS = {
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,
  
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,
  
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511
};

const MIME_TYPES = {
  'html': 'text/html',
  'htm': 'text/html',
  'txt': 'text/plain',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'xml': 'application/xml',
  'pdf': 'application/pdf',
  'zip': 'application/zip',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'tiff': 'image/tiff',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogg': 'application/ogg',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'oga': 'audio/ogg',
  'ogv': 'video/ogg',
  'aac': 'audio/aac',
  'flac': 'audio/flac',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'eot': 'application/vnd.ms-fontobject'
};

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  'TRACE',
  'CONNECT'
];

function isHttpError(status) {
  return status >= 400;
}

function isClientError(status) {
  return status >= 400 && status < 500;
}

function isServerError(status) {
  return status >= 500;
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function isSuccess(status) {
  return status >= 200 && status < 300;
}

function isInformational(status) {
  return status >= 100 && status < 200;
}

function getStatusText(status) {
  return STATUS_CODES[status] || 'Unknown Status';
}

function getMimeType(extension) {
  if (extension.startsWith('.')) {
    extension = extension.slice(1);
  }
  return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}

function parseContentType(contentType) {
  if (!contentType) {
    return { type: '', charset: '', boundary: '' };
  }

  const [type, ...params] = contentType.split(';');
  const result = { type: type.trim(), charset: '', boundary: '' };

  for (const param of params) {
    const [key, value] = param.split('=');
    if (key && value) {
      result[key.trim()] = value.trim().replace(/"/g, '');
    }
  }

  return result;
}

function parseAccept(accept) {
  if (!accept) {
    return [];
  }

  return accept
    .split(',')
    .map(type => {
      const [mediaType, ...params] = type.split(';');
      const result = { type: mediaType.trim(), q: 1.0 };

      for (const param of params) {
        const [key, value] = param.split('=');
        if (key && value) {
          if (key.trim() === 'q') {
            result.q = parseFloat(value.trim());
          }
        }
      }

      return result;
    })
    .sort((a, b) => b.q - a.q);
}

function parseRange(range, size) {
  if (!range || !range.startsWith('bytes=')) {
    return null;
  }

  const ranges = [];
  const parts = range.slice(6).split(',');

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

  return ranges.length > 0 ? ranges : null;
}

function parseAuthorizationHeader(auth) {
  if (!auth) {
    return null;
  }

  const [scheme, credentials] = auth.split(' ');
  
  if (scheme.toLowerCase() === 'basic') {
    const decoded = Buffer.from(credentials, 'base64').toString();
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      // No password provided
      return { scheme: 'basic', username: decoded, password: '' };
    }

    // Split only on first colon to preserve colons in password
    const username = decoded.substring(0, colonIndex);
    const password = decoded.substring(colonIndex + 1);

    return { scheme: 'basic', username, password };
  }

  if (scheme.toLowerCase() === 'bearer') {
    return { scheme: 'bearer', token: credentials };
  }

  return { scheme: scheme.toLowerCase(), credentials };
}

function parseUserAgent(userAgent) {
  if (!userAgent) {
    return null;
  }

  const browsers = [
    { name: 'Chrome', pattern: /Chrome\/([^\s]+)/ },
    { name: 'Firefox', pattern: /Firefox\/([^\s]+)/ },
    { name: 'Safari', pattern: /Version\/([^\s]+).*Safari/ },
    { name: 'Edge', pattern: /Edge\/([^\s]+)/ },
    { name: 'IE', pattern: /MSIE ([^\s]+)/ },
    { name: 'Opera', pattern: /OPR\/([^\s]+)/ }
  ];

  for (const browser of browsers) {
    const match = userAgent.match(browser.pattern);
    if (match) {
      return { name: browser.name, version: match[1] };
    }
  }

  return { name: 'Unknown', version: 'Unknown' };
}

function createError(status, message, properties = {}) {
  const error = new Error(message || getStatusText(status));
  error.status = status;
  error.statusCode = status;
  error.expose = isClientError(status);
  
  Object.assign(error, properties);
  
  return error;
}

function isValidMethod(method) {
  return HTTP_METHODS.includes(method.toUpperCase());
}

function parseQuery(queryString) {
  if (!queryString) {
    return {};
  }

  const params = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      const decodedKey = decodeURIComponent(key);
      const decodedValue = value ? decodeURIComponent(value) : '';
      
      if (params[decodedKey]) {
        if (Array.isArray(params[decodedKey])) {
          params[decodedKey].push(decodedValue);
        } else {
          params[decodedKey] = [params[decodedKey], decodedValue];
        }
      } else {
        params[decodedKey] = decodedValue;
      }
    }
  }

  return params;
}

function stringifyQuery(params) {
  if (!params || typeof params !== 'object') {
    return '';
  }

  const pairs = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
      }
    } else if (value !== null && value !== undefined) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  return pairs.join('&');
}

function parseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      query: parseQuery(parsed.search.slice(1))
    };
  } catch (error) {
    return null;
  }
}

function formatUrl(parts) {
  let url = '';
  
  if (parts.protocol) {
    url += parts.protocol;
    if (!parts.protocol.endsWith(':')) {
      url += ':';
    }
  }
  
  if (parts.hostname) {
    url += '//' + parts.hostname;
  }
  
  if (parts.port) {
    url += ':' + parts.port;
  }
  
  if (parts.pathname) {
    url += parts.pathname;
  }
  
  if (parts.query && Object.keys(parts.query).length > 0) {
    url += '?' + stringifyQuery(parts.query);
  } else if (parts.search) {
    url += parts.search;
  }
  
  if (parts.hash) {
    url += parts.hash;
  }
  
  return url;
}

module.exports = {
  HTTP_STATUS,
  MIME_TYPES,
  HTTP_METHODS,
  isHttpError,
  isClientError,
  isServerError,
  isRedirect,
  isSuccess,
  isInformational,
  getStatusText,
  getMimeType,
  parseContentType,
  parseAccept,
  parseRange,
  parseAuthorizationHeader,
  parseUserAgent,
  createError,
  isValidMethod,
  parseQuery,
  stringifyQuery,
  parseUrl,
  formatUrl
};