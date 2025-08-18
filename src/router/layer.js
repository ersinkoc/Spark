'use strict';

class Layer {
  constructor(path, options, handler, router = null) {
    this.path = path;
    this.handler = handler;
    this.name = handler.name || '<anonymous>';
    this.options = options;
    this.route = null;
    this.method = null;
    this.router = router;
    
    // Use router's pathToRegExp if available, otherwise create a default regex
    if (router && router.pathToRegExp) {
      this.regexp = router.pathToRegExp(path, options);
    } else {
      // Fallback to default regex creation without circular dependency
      this.regexp = this.createDefaultRegex(path, options);
    }
    this.keys = this.regexp.keys;
  }
  
  createDefaultRegex(path, options = {}) {
    const { sensitive = false, strict = false, end = true } = options;
    
    if (path instanceof RegExp) {
      return { regexp: path, keys: [] };
    }

    const keys = [];
    let regexp = path;

    // Escape forward slashes
    regexp = regexp.replace(/\\\//g, '/');

    // Replace parameters
    regexp = regexp.replace(/:([^(/\\]+)/g, (match, key) => {
      keys.push({ name: key, optional: false });
      return '([^/]+)';
    });

    // Replace wildcards
    regexp = regexp.replace(/\*([^(/\\]*)/g, (match, key) => {
      keys.push({ name: key || 'wild', optional: false });
      return '(.*)';
    });

    // Add end pattern
    if (end) {
      regexp += strict ? '' : '/?';
    }

    regexp += end ? '$' : '';

    const flags = sensitive ? '' : 'i';
    return {
      regexp: new RegExp(`^${regexp}`, flags),
      keys
    };
  }

  match(path) {
    const match = this.regexp.regexp.exec(path);
    
    if (!match) {
      return false;
    }

    const params = {};
    
    for (let i = 1; i < match.length; i++) {
      const key = this.keys[i - 1];
      const value = match[i];
      
      if (value !== undefined) {
        params[key.name] = decodeParam(value);
      }
    }

    return {
      path: match[0],
      params
    };
  }

  async handle(ctx, next) {
    if (this.handler.length > 2) {
      return this.handler(ctx, next);
    } else {
      await this.handler(ctx, next);
    }
  }

  handles_method(method) {
    if (this.method) {
      return this.method === method;
    }
    
    if (this.route) {
      return this.route.handles_method(method);
    }
    
    return true;
  }
}

function decodeParam(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    throw new Error(`Failed to decode param '${value}'`);
  }
}

module.exports = Layer;