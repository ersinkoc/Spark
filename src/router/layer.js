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

    // SECURITY FIX: Escape regex special characters before processing parameters
    // This prevents route injection attacks where special regex chars in paths
    // could match unintended routes (e.g., /admin.users matching /adminXusers)
    // Temporarily replace : and * with placeholders to protect them
    const PARAM_PLACEHOLDER = '\x00PARAM\x00';
    const WILDCARD_PLACEHOLDER = '\x00WILD\x00';

    // Temporarily replace parameters and wildcards with placeholders
    regexp = regexp.replace(/:([^(/\\]+)/g, `${PARAM_PLACEHOLDER}$1`);
    regexp = regexp.replace(/\*([^(/\\]*)/g, `${WILDCARD_PLACEHOLDER}$1`);

    // Escape all regex special characters
    regexp = regexp.replace(/([.+?^${}()|[\]\\])/g, '\\$1');

    // Restore parameter markers and convert to regex groups
    regexp = regexp.replace(new RegExp(`${PARAM_PLACEHOLDER.replace(/\x00/g, '\\x00')}([^(/\\\\]+)`, 'g'), (match, key) => {
      keys.push({ name: key, optional: false });
      return '([^/]+)';
    });

    // Restore wildcard markers and convert to regex groups
    regexp = regexp.replace(new RegExp(`${WILDCARD_PLACEHOLDER.replace(/\x00/g, '\\x00')}([^(/\\\\]*)`, 'g'), (match, key) => {
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
      const keyIndex = i - 1;

      // SECURITY: Bounds check to prevent undefined access
      if (keyIndex >= this.keys.length) {
        console.warn(`Layer match: More capture groups (${match.length - 1}) than keys (${this.keys.length})`);
        break;
      }

      const key = this.keys[keyIndex];
      const value = match[i];

      // Additional safety check
      if (!key || !key.name) {
        console.warn(`Layer match: Invalid key at index ${keyIndex}`);
        continue;
      }

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
    // BUG FIX: Properly detect and handle async functions
    // Function.length doesn't indicate whether a function is async
    // Instead, check if the result is a Promise and await it
    const result = this.handler(ctx, next);

    if (result && typeof result.then === 'function') {
      return await result;
    }

    return result;
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