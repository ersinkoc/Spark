'use strict';

const MAX_PATTERN_LENGTH = 1000;
const MAX_CAPTURE_GROUPS = 10;
const DANGEROUS_PATTERNS = [
  /(\w+\+)+\w+/,  // Potential catastrophic backtracking
  /(\w+\*)+\w+/,  // Potential catastrophic backtracking
  /(a+)+b/,       // Classic ReDoS pattern
  /(\d+)+\w/,     // Numeric ReDoS pattern
];

class RegexValidator {
  static isComplexPattern(pattern) {
    if (typeof pattern !== 'string') return false;
    
    // Check pattern length
    if (pattern.length > MAX_PATTERN_LENGTH) {
      return true;
    }
    
    // Count capture groups, excluding non-capturing groups (?:...)
    const captureGroups = pattern.match(/\((?!\?:)[^)]*\)/g) || [];
    if (captureGroups.length > MAX_CAPTURE_GROUPS) {
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
    
    // Replace potentially dangerous quantifiers
    pattern = pattern.replace(/(\+|\*){2,}/g, '$1');
    pattern = pattern.replace(/\{(\d+),?\}/g, (match, num) => {
      const limit = parseInt(num);
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