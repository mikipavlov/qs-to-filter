import { describe, expect, it } from 'vitest';
import {
  DangerousRegexError,
  FieldAccessError,
  OperatorNotAllowedError,
  ValueLimitError,
} from './errors.js';
import {
  DEFAULT_BLOCKED_FIELDS,
  validateArrayValue,
  validateFieldAccess,
  validateFilter,
  validateOperator,
  validateRegexPattern,
  validateStringValue,
} from './security.js';

describe('Security Module', () => {
  describe('validateRegexPattern', () => {
    it('should accept safe regex patterns', () => {
      expect(() => validateRegexPattern('hello')).not.toThrow();
      expect(() => validateRegexPattern('^test$')).not.toThrow();
      expect(() => validateRegexPattern('[a-z]+')).not.toThrow();
      expect(() => validateRegexPattern('\\d{3}-\\d{4}')).not.toThrow();
    });

    it('should reject patterns exceeding max length', () => {
      const longPattern = 'a'.repeat(101);
      expect(() => validateRegexPattern(longPattern)).toThrow(DangerousRegexError);
      expect(() => validateRegexPattern(longPattern)).toThrow(/exceeds maximum length/);
    });

    it('should reject nested quantifiers (ReDoS)', () => {
      expect(() => validateRegexPattern('(a+)+')).toThrow(DangerousRegexError);
      expect(() => validateRegexPattern('(a+)*')).toThrow(DangerousRegexError);
      expect(() => validateRegexPattern('(.*)*')).toThrow(DangerousRegexError);
    });

    it('should reject overlapping alternation with quantifiers', () => {
      expect(() => validateRegexPattern('(a|aa)+')).toThrow(DangerousRegexError);
    });

    it('should reject multiple consecutive wildcards', () => {
      expect(() => validateRegexPattern('.*.*.*')).toThrow(DangerousRegexError);
    });

    it('should reject invalid regex syntax', () => {
      expect(() => validateRegexPattern('[')).toThrow(DangerousRegexError);
      expect(() => validateRegexPattern('(abc')).toThrow(DangerousRegexError);
    });

    it('should accept custom max length', () => {
      const pattern = 'a'.repeat(50);
      expect(() => validateRegexPattern(pattern, 50)).not.toThrow();
      expect(() => validateRegexPattern(pattern, 49)).toThrow(DangerousRegexError);
    });
  });

  describe('validateFieldAccess', () => {
    it('should allow unrestricted fields by default', () => {
      expect(() => validateFieldAccess('status')).not.toThrow();
      expect(() => validateFieldAccess('name')).not.toThrow();
      expect(() => validateFieldAccess('user.email')).not.toThrow();
    });

    it('should block default blocked fields', () => {
      expect(() => validateFieldAccess('password')).toThrow(FieldAccessError);
      expect(() => validateFieldAccess('hash')).toThrow(FieldAccessError);
      expect(() => validateFieldAccess('secret')).toThrow(FieldAccessError);
      expect(() => validateFieldAccess('token')).toThrow(FieldAccessError);
      expect(() => validateFieldAccess('__proto__')).toThrow(FieldAccessError);
    });

    it('should block nested blocked fields', () => {
      expect(() => validateFieldAccess('password.hash')).toThrow(FieldAccessError);
      expect(() => validateFieldAccess('secret.key')).toThrow(FieldAccessError);
    });

    it('should respect custom blocked fields', () => {
      expect(() => validateFieldAccess('internal', { blockedFields: ['internal'] })).toThrow(
        FieldAccessError
      );
      expect(() => validateFieldAccess('internal.data', { blockedFields: ['internal'] })).toThrow(
        FieldAccessError
      );
    });

    it('should respect allowedFields when specified', () => {
      const options = { allowedFields: ['status', 'name'] };
      expect(() => validateFieldAccess('status', options)).not.toThrow();
      expect(() => validateFieldAccess('name', options)).not.toThrow();
      expect(() => validateFieldAccess('email', options)).toThrow(FieldAccessError);
    });

    it('should allow nested paths of allowed fields', () => {
      const options = { allowedFields: ['user'] };
      expect(() => validateFieldAccess('user.name', options)).not.toThrow();
      expect(() => validateFieldAccess('user.email', options)).not.toThrow();
    });

    it('should include field name in error', () => {
      try {
        validateFieldAccess('password');
      } catch (e) {
        expect(e).toBeInstanceOf(FieldAccessError);
        expect((e as FieldAccessError).fieldName).toBe('password');
        expect((e as FieldAccessError).reason).toBe('blocked');
      }
    });
  });

  describe('validateOperator', () => {
    it('should allow all operators by default', () => {
      expect(() => validateOperator('name', 'eq')).not.toThrow();
      expect(() => validateOperator('name', 'like')).not.toThrow();
      expect(() => validateOperator('age', 'gte')).not.toThrow();
    });

    it('should respect field-specific operator restrictions', () => {
      const options = {
        fieldConfig: {
          status: { operators: ['eq', 'in'] as const },
        },
      };
      expect(() => validateOperator('status', 'eq', options)).not.toThrow();
      expect(() => validateOperator('status', 'in', options)).not.toThrow();
      expect(() => validateOperator('status', 'like', options)).toThrow(OperatorNotAllowedError);
      expect(() => validateOperator('status', 'gte', options)).toThrow(OperatorNotAllowedError);
    });

    it('should block regex operators when allowRegex is false', () => {
      const options = { allowRegex: false };
      expect(() => validateOperator('name', 'like', options)).toThrow(OperatorNotAllowedError);
      expect(() => validateOperator('name', 'ilike', options)).toThrow(OperatorNotAllowedError);
      expect(() => validateOperator('name', 'regex', options)).toThrow(OperatorNotAllowedError);
      expect(() => validateOperator('name', 'eq', options)).not.toThrow();
    });

    it('should include operator info in error', () => {
      try {
        validateOperator('status', 'like', {
          fieldConfig: { status: { operators: ['eq', 'in'] as const } },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(OperatorNotAllowedError);
        expect((e as OperatorNotAllowedError).fieldName).toBe('status');
        expect((e as OperatorNotAllowedError).operator).toBe('like');
        expect((e as OperatorNotAllowedError).allowedOperators).toEqual(['eq', 'in']);
      }
    });
  });

  describe('validateStringValue', () => {
    it('should allow strings within default limit', () => {
      expect(() => validateStringValue('name', 'John Doe')).not.toThrow();
      expect(() => validateStringValue('name', 'a'.repeat(1000))).not.toThrow();
    });

    it('should reject strings exceeding default limit', () => {
      expect(() => validateStringValue('name', 'a'.repeat(1001))).toThrow(ValueLimitError);
    });

    it('should respect custom max length', () => {
      expect(() =>
        validateStringValue('name', 'a'.repeat(100), { maxStringLength: 100 })
      ).not.toThrow();
      expect(() => validateStringValue('name', 'a'.repeat(101), { maxStringLength: 100 })).toThrow(
        ValueLimitError
      );
    });

    it('should respect field-specific max length', () => {
      const options = {
        fieldConfig: { shortField: { maxLength: 10 } },
      };
      expect(() => validateStringValue('shortField', 'a'.repeat(10), options)).not.toThrow();
      expect(() => validateStringValue('shortField', 'a'.repeat(11), options)).toThrow(
        ValueLimitError
      );
    });
  });

  describe('validateArrayValue', () => {
    it('should allow arrays within default limit', () => {
      expect(() => validateArrayValue('tags', new Array(100).fill('tag'))).not.toThrow();
    });

    it('should reject arrays exceeding default limit', () => {
      expect(() => validateArrayValue('tags', new Array(101).fill('tag'))).toThrow(ValueLimitError);
    });

    it('should respect field-specific max array size', () => {
      const options = {
        fieldConfig: { smallArray: { maxArraySize: 5 } },
      };
      expect(() => validateArrayValue('smallArray', [1, 2, 3, 4, 5], options)).not.toThrow();
      expect(() => validateArrayValue('smallArray', [1, 2, 3, 4, 5, 6], options)).toThrow(
        ValueLimitError
      );
    });
  });

  describe('validateFilter', () => {
    it('should pass valid filters', () => {
      expect(() =>
        validateFilter({
          status: 'published',
          count: { gte: 10 },
        })
      ).not.toThrow();
    });

    it('should validate all fields recursively', () => {
      expect(() =>
        validateFilter(
          {
            user: { email: 'test@example.com' },
            status: { eq: 'active' },
          },
          { allowedFields: ['user', 'status'] }
        )
      ).not.toThrow();
    });

    it('should validate regex patterns in filter', () => {
      expect(() =>
        validateFilter({
          name: { regex: '(a+)+' }, // ReDoS pattern
        })
      ).toThrow(DangerousRegexError);
    });

    it('should validate string lengths in filter', () => {
      expect(() =>
        validateFilter(
          {
            name: { like: 'a'.repeat(101) },
          },
          { maxRegexLength: 100 }
        )
      ).toThrow(DangerousRegexError);
    });

    it('should validate operator restrictions in filter', () => {
      expect(() =>
        validateFilter(
          {
            status: { like: 'test' },
          },
          {
            fieldConfig: {
              status: { operators: ['eq', 'in'] as const },
            },
          }
        )
      ).toThrow(OperatorNotAllowedError);
    });

    it('should validate field access in filter', () => {
      expect(() =>
        validateFilter({
          password: { eq: 'secret' },
        })
      ).toThrow(FieldAccessError);
    });
  });

  describe('DEFAULT_BLOCKED_FIELDS', () => {
    it('should contain common sensitive field names', () => {
      expect(DEFAULT_BLOCKED_FIELDS).toContain('password');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('hash');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('secret');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('token');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('apiKey');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('__proto__');
      expect(DEFAULT_BLOCKED_FIELDS).toContain('constructor');
    });
  });
});
