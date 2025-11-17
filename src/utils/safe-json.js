/**
 * Safe JSON parsing with depth and size validation
 * Prevents DoS attacks via deeply nested objects or extremely large payloads
 */

/**
 * Parse JSON with security validations
 * @param {string} text - JSON string to parse
 * @param {Object} options - Parsing options
 * @param {number} options.maxDepth - Maximum nesting depth (default: 20)
 * @param {number} options.maxSize - Maximum JSON string size in bytes (default: 1MB)
 * @returns {*} Parsed JSON object
 * @throws {Error} If validation fails or parsing errors
 */
function safeJSONParse(text, options = {}) {
  const maxDepth = options.maxDepth || 20;
  const maxSize = options.maxSize || 1024 * 1024; // 1MB default

  // SECURITY: Validate size before parsing to prevent memory exhaustion
  if (typeof text !== 'string') {
    throw new Error('JSON input must be a string');
  }

  if (text.length > maxSize) {
    throw new Error(`JSON payload too large: ${text.length} bytes exceeds maximum ${maxSize} bytes`);
  }

  // SECURITY: Validate depth to prevent stack overflow from deeply nested objects
  // Count maximum nesting level by tracking bracket/brace depth
  let depth = 0;
  let maxDepthFound = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{' || char === '[') {
      depth++;
      if (depth > maxDepthFound) {
        maxDepthFound = depth;
      }
      if (depth > maxDepth) {
        throw new Error(`JSON nesting depth ${depth} exceeds maximum allowed depth ${maxDepth}`);
      }
    } else if (char === '}' || char === ']') {
      depth--;
    }
  }

  // Parse the JSON after validation
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Stringify JSON with size validation
 * @param {*} value - Value to stringify
 * @param {Object} options - Stringify options
 * @param {number} options.maxSize - Maximum output size (default: 1MB)
 * @returns {string} JSON string
 * @throws {Error} If output exceeds size limit
 */
function safeJSONStringify(value, options = {}) {
  const maxSize = options.maxSize || 1024 * 1024; // 1MB default

  try {
    const result = JSON.stringify(value);

    if (result.length > maxSize) {
      throw new Error(`JSON output too large: ${result.length} bytes exceeds maximum ${maxSize} bytes`);
    }

    return result;
  } catch (error) {
    // Handle circular references
    if (error.message && error.message.includes('circular')) {
      throw new Error('Cannot stringify circular JSON structure');
    }
    throw error;
  }
}

module.exports = {
  safeJSONParse,
  safeJSONStringify
};
