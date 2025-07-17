const { describe, it, expect, beforeEach } = require('../../../test-helper');
const { RegexValidator, SafeRegexCache } = require('../../../src/utils/regex-validator');

describe('ReDoS Protection', () => {
  let cache;
  
  beforeEach(() => {
    cache = new SafeRegexCache();
  });

  describe('RegexValidator', () => {
    it('should detect complex patterns that could cause ReDoS', () => {
      const dangerousPatterns = [
        '(a+)+b',           // Classic ReDoS pattern
        '(a*)*b',           // Nested quantifiers
        '(a+)*b',           // Mixed quantifiers
        '(\\d+)+\\w',       // Numeric ReDoS
        'a'.repeat(1001),   // Too long pattern
        '('.repeat(11) + 'a' + ')'.repeat(11) // Too many capture groups
      ];

      dangerousPatterns.forEach(pattern => {
        expect(RegexValidator.isComplexPattern(pattern)).toBe(true);
      });
    });

    it('should allow safe patterns', () => {
      const safePatterns = [
        '/users/\\d+',
        '/api/v\\d+/.*',
        '^[a-zA-Z0-9_-]+$',
        '\\w+@\\w+\\.\\w+',
        '/posts/[0-9]+'
      ];

      safePatterns.forEach(pattern => {
        expect(RegexValidator.isComplexPattern(pattern)).toBe(false);
      });
    });

    it('should sanitize dangerous patterns', () => {
      const sanitized = RegexValidator.sanitizePattern('(a+)+b');
      expect(sanitized).toBe('(a+)b');
    });

    it('should limit pattern length', () => {
      const longPattern = 'a'.repeat(1500);
      const sanitized = RegexValidator.sanitizePattern(longPattern);
      expect(sanitized.length).toBe(1000);
    });

    it('should test regex performance', () => {
      const safePattern = /^[a-z]+$/;
      const result = RegexValidator.testPerformance(safePattern);
      
      expect(result.safe).toBe(true);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('SafeRegexCache', () => {
    it('should cache compiled regexes', () => {
      const pattern = '/users/\\d+';
      
      const regex1 = cache.get(pattern);
      const regex2 = cache.get(pattern);
      
      expect(regex1).toBe(regex2);
      expect(cache.size).toBe(1);
    });

    it('should reject unsafe patterns', () => {
      const dangerousPattern = '(a+)+b';
      
      expect(() => {
        cache.get(dangerousPattern);
      }).toThrow('Unsafe regex pattern');
    });

    it('should sanitize and cache borderline patterns', () => {
      const borderlinePattern = '(a+)(a+)b';
      
      expect(() => {
        const regex = cache.get(borderlinePattern);
        expect(regex).toBeInstanceOf(RegExp);
      }).not.toThrow();
    });

    it('should evict oldest entries when cache is full', () => {
      const smallCache = new SafeRegexCache(2);
      
      smallCache.get('pattern1');
      smallCache.get('pattern2');
      smallCache.get('pattern3');
      
      expect(smallCache.size).toBe(2);
    });

    it('should handle cache clearing', () => {
      cache.get('pattern1');
      cache.get('pattern2');
      
      expect(cache.size).toBe(2);
      
      cache.clear();
      
      expect(cache.size).toBe(0);
    });

    it('should handle invalid regex patterns', () => {
      const invalidPattern = '[invalid';
      
      expect(() => {
        cache.get(invalidPattern);
      }).toThrow('Invalid regex pattern');
    });

    it('should support regex flags', () => {
      const pattern = 'test';
      
      const regex1 = cache.get(pattern, 'i');
      const regex2 = cache.get(pattern, 'g');
      
      expect(regex1).not.toBe(regex2);
      expect(regex1.flags).toBe('i');
      expect(regex2.flags).toBe('g');
    });
  });

  describe('Router Integration', () => {
    it('should protect route patterns from ReDoS', () => {
      const Router = require('../../../src/router/router');
      const router = new Router();
      
      // This should not throw due to ReDoS protection
      expect(() => {
        router.pathToRegExp('/users/:id(\\d+)');
      }).not.toThrow();
    });

    it('should handle complex route patterns safely', () => {
      const Router = require('../../../src/router/router');
      const router = new Router();
      
      const complexPattern = '/api/v:version(\\d+)/users/:id([0-9]+)';
      
      expect(() => {
        const result = router.pathToRegExp(complexPattern);
        expect(result.regexp).toBeInstanceOf(RegExp);
        expect(Array.isArray(result.keys)).toBe(true);
      }).not.toThrow();
    });

    it('should reject extremely dangerous route patterns', () => {
      const Router = require('../../../src/router/router');
      const router = new Router();
      
      const dangerousPattern = '/users/:id((a+)+)';
      
      expect(() => {
        router.pathToRegExp(dangerousPattern);
      }).toThrow('Invalid route pattern');
    });
  });

  describe('Performance Testing', () => {
    it('should complete regex compilation within timeout', () => {
      const startTime = Date.now();
      
      // Test multiple patterns
      const patterns = [
        '/users/\\d+',
        '/api/v\\d+/.*',
        '^[a-zA-Z0-9_-]+$',
        '\\w+@\\w+\\.\\w+',
        '/posts/[0-9]+'
      ];
      
      patterns.forEach(pattern => {
        cache.get(pattern);
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle stress testing', () => {
      const cache = new SafeRegexCache(1000);
      
      // Generate many safe patterns
      for (let i = 0; i < 100; i++) {
        const pattern = `/route${i}/\\d+`;
        cache.get(pattern);
      }
      
      expect(cache.size).toBe(100);
    });
  });
});