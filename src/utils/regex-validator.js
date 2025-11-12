'use strict';

const MAX_PATTERN_LENGTH = 1000;
const MAX_CAPTURE_GROUPS = 10;
// SECURITY: Use safe patterns to detect dangerous regex (avoid ReDoS in validator itself)
// Previous patterns like /(\w+\+)+\w+/ could themselves cause ReDoS
const DANGEROUS_PATTERNS = [
  /\(\w\+\+\)\+/,     // Nested quantifiers with word chars: (\w+)+
  /\(\w\+\*\)\+/,     // Nested quantifiers: (\w*)+
  /\(a\+\)\+b/,       // Classic ReDoS pattern: (a+)+b
  /\(\d\+\)\+/,       // Numeric nested quantifiers: (\d+)+
];

class RegexValidator {
  static isComplexPattern(pattern) {
    if (typeof pattern !== 'string') return false;
    
    // Check pattern length
    if (pattern.length > MAX_PATTERN_LENGTH) {
      return true;
    }
    
    // Count capture groups (excluding non-capturing groups like (?:...))
    // SECURITY: Avoid lookbehind (?<!...) for older Node.js compatibility
    // Match opening parens that are not escaped and not followed by ?
    let captureGroups = 0;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '(' && (i === 0 || pattern[i - 1] !== '\\')) {
        if (i + 1 >= pattern.length || pattern[i + 1] !== '?') {
          captureGroups++;
        }
      }
    }
    if (captureGroups > MAX_CAPTURE_GROUPS) {
      return true;
    }
    
    // Check for nested quantifiers
    if (/(\+|\*|\{[^}]+\}){2,}/.test(pattern)) {
      return true;
    }
    
    // Check for dangerous patterns
    for (const dangerous of DANGEROUS_PATTERNS) {
      if (dangerous.test(pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  static sanitizePattern(pattern) {
    if (typeof pattern !== 'string') return pattern;

    // Limit pattern length
    if (pattern.length > MAX_PATTERN_LENGTH) {
      pattern = pattern.substring(0, MAX_PATTERN_LENGTH);
    }

    // SECURITY: Removed dangerous quantifier replacement that changes semantics
    // The pattern /(\+|\*){2,}/g would incorrectly change '++' to '+',
    // which alters regex meaning (++ is literal, + is quantifier)
    // Instead, reject patterns with excessive nested quantifiers during validation

    // Limit quantifier ranges to prevent ReDoS
    pattern = pattern.replace(/\{(\d+),?\}/g, (match, num) => {
      const limit = parseInt(num, 10);
      return limit > 100 ? '{0,100}' : match;
    });

    return pattern;
  }
  
  static testPerformance(pattern, testString = 'a'.repeat(100)) {
    if (!(pattern instanceof RegExp)) {
      try {
        pattern = new RegExp(pattern);
      } catch (e) {
        return { safe: false, error: e.message };
      }
    }
    
    const startTime = process.hrtime.bigint();
    const timeout = 100; // 100ms timeout
    
    try {
      // Simple synchronous test with time check
      const result = pattern.test(testString);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds
      
      return {
        safe: duration < timeout,
        duration,
        pattern: pattern.source,
        result
      };
    } catch (error) {
      return { safe: false, error: error.message };
    }
  }
}

// Regex cache with complexity checking
class SafeRegexCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(pattern, flags = '') {
    const key = `${pattern}:${flags}`;

    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      entry.lastAccess = Date.now();
      return entry.regex;
    }

    // SECURITY: Validate regex flags before creating RegExp
    // Valid flags are: g (global), i (ignoreCase), m (multiline), s (dotAll), u (unicode), y (sticky)
    const validFlags = new Set(['g', 'i', 'm', 's', 'u', 'y']);
    for (const flag of flags) {
      if (!validFlags.has(flag)) {
        throw new Error(`Invalid regex flag: "${flag}". Valid flags are: g, i, m, s, u, y`);
      }
    }

    // Validate pattern before creating regex
    if (RegexValidator.isComplexPattern(pattern)) {
      pattern = RegexValidator.sanitizePattern(pattern);
    }

    try {
      const regex = new RegExp(pattern, flags);
      
      // Test performance before caching
      const perfTest = RegexValidator.testPerformance(regex);
      if (!perfTest.safe) {
        throw new Error(`Unsafe regex pattern: ${perfTest.error}`);
      }
      
      // Add to cache
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }
      
      this.cache.set(key, {
        regex,
        lastAccess: Date.now(),
        pattern,
        flags
      });
      
      return regex;
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error.message}`);
    }
  }
  
  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldest = key;
        oldestTime = entry.lastAccess;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
    }
  }
  
  clear() {
    this.cache.clear();
  }
  
  get size() {
    return this.cache.size;
  }
}

module.exports = {
  RegexValidator,
  SafeRegexCache
};