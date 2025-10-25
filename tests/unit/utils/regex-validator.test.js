'use strict';

const assert = require('assert');
const { RegexValidator } = require('../../../src/utils/regex-validator');

describe('RegexValidator', () => {
  describe('isComplexPattern', () => {
    it('should not count non-capturing groups as capture groups', () => {
      const pattern = '(?:a)(?:b)(?:c)(?:d)(?:e)(?:f)(?:g)(?:h)(?:i)(?:j)(?:k)';
      assert.strictEqual(RegexValidator.isComplexPattern(pattern), false);
    });
  });
});
