import { describe, expect, it } from 'vitest';
import {
  buildSortString,
  convertFilterValue,
  hasFilterOperators,
  isFilterOperator,
  limitFilterArraySizes,
  normalizeFilter,
  parseSortString,
} from './filter.js';

describe('isFilterOperator', () => {
  it('should return true for valid operators', () => {
    expect(isFilterOperator('eq')).toBe(true);
    expect(isFilterOperator('ne')).toBe(true);
    expect(isFilterOperator('gt')).toBe(true);
    expect(isFilterOperator('gte')).toBe(true);
    expect(isFilterOperator('lt')).toBe(true);
    expect(isFilterOperator('lte')).toBe(true);
    expect(isFilterOperator('in')).toBe(true);
    expect(isFilterOperator('nin')).toBe(true);
    expect(isFilterOperator('like')).toBe(true);
    expect(isFilterOperator('ilike')).toBe(true);
    expect(isFilterOperator('exists')).toBe(true);
    expect(isFilterOperator('size')).toBe(true);
    expect(isFilterOperator('all')).toBe(true);
    expect(isFilterOperator('regex')).toBe(true);
    expect(isFilterOperator('or')).toBe(true);
  });

  it('should return false for invalid operators', () => {
    expect(isFilterOperator('$eq')).toBe(false);
    expect(isFilterOperator('foo')).toBe(false);
    expect(isFilterOperator('')).toBe(false);
    expect(isFilterOperator('EQ')).toBe(false);
  });
});

describe('hasFilterOperators', () => {
  it('should return true for objects with filter operators', () => {
    expect(hasFilterOperators({ eq: 10 })).toBe(true);
    expect(hasFilterOperators({ gte: 5, lte: 100 })).toBe(true);
    expect(hasFilterOperators({ in: ['a', 'b'] })).toBe(true);
  });

  it('should return false for objects without filter operators', () => {
    expect(hasFilterOperators({ foo: 10 })).toBe(false);
    expect(hasFilterOperators({ name: 'test' })).toBe(false);
    expect(hasFilterOperators({})).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(hasFilterOperators(null)).toBe(false);
    expect(hasFilterOperators(undefined)).toBe(false);
    expect(hasFilterOperators('string')).toBe(false);
    expect(hasFilterOperators(123)).toBe(false);
    expect(hasFilterOperators(['array'])).toBe(false);
  });
});

describe('convertFilterValue', () => {
  describe('numeric operators', () => {
    it('should convert string numbers to numbers for gt', () => {
      expect(convertFilterValue('gt', '10')).toBe(10);
      expect(convertFilterValue('gt', '-5')).toBe(-5);
      expect(convertFilterValue('gt', '3.14')).toBe(3.14);
    });

    it('should convert string numbers to numbers for gte', () => {
      expect(convertFilterValue('gte', '100')).toBe(100);
    });

    it('should convert string numbers to numbers for lt', () => {
      expect(convertFilterValue('lt', '50')).toBe(50);
    });

    it('should convert string numbers to numbers for lte', () => {
      expect(convertFilterValue('lte', '25')).toBe(25);
    });

    it('should convert string numbers to numbers for eq', () => {
      expect(convertFilterValue('eq', '42')).toBe(42);
    });

    it('should convert string numbers to numbers for ne', () => {
      expect(convertFilterValue('ne', '0')).toBe(0);
    });

    it('should convert string numbers to numbers for size', () => {
      expect(convertFilterValue('size', '5')).toBe(5);
    });

    it('should not convert non-numeric strings', () => {
      expect(convertFilterValue('eq', 'hello')).toBe('hello');
      expect(convertFilterValue('gt', 'not-a-number')).toBe('not-a-number');
    });
  });

  describe('boolean operators', () => {
    it('should convert string "true" to boolean for exists', () => {
      expect(convertFilterValue('exists', 'true')).toBe(true);
    });

    it('should convert string "false" to boolean for exists', () => {
      expect(convertFilterValue('exists', 'false')).toBe(false);
    });

    it('should keep boolean values as-is', () => {
      expect(convertFilterValue('exists', true)).toBe(true);
      expect(convertFilterValue('exists', false)).toBe(false);
    });
  });

  describe('array operators', () => {
    it('should wrap single value in array for in', () => {
      expect(convertFilterValue('in', 'single')).toEqual(['single']);
    });

    it('should wrap single value in array for nin', () => {
      expect(convertFilterValue('nin', 'value')).toEqual(['value']);
    });

    it('should wrap single value in array for all', () => {
      expect(convertFilterValue('all', 'item')).toEqual(['item']);
    });

    it('should keep arrays as-is', () => {
      expect(convertFilterValue('in', ['a', 'b'])).toEqual(['a', 'b']);
    });
  });

  describe('string operators', () => {
    it('should keep string values for like', () => {
      expect(convertFilterValue('like', 'pattern')).toBe('pattern');
    });

    it('should keep string values for ilike', () => {
      expect(convertFilterValue('ilike', 'PATTERN')).toBe('PATTERN');
    });

    it('should keep string values for regex', () => {
      expect(convertFilterValue('regex', '^test.*')).toBe('^test.*');
    });
  });
});

describe('normalizeFilter', () => {
  it('should normalize filter with operators', () => {
    const result = normalizeFilter({
      count: { gte: '10', lte: '100' },
      status: { in: 'active' },
      hasData: { exists: 'true' },
    });

    expect(result).toEqual({
      count: { gte: 10, lte: 100 },
      status: { in: ['active'] },
      hasData: { exists: true },
    });
  });

  it('should handle nested objects', () => {
    const result = normalizeFilter({
      traffic: {
        organic: {
          etv: { gt: '1000' },
        },
      },
    });

    expect(result).toEqual({
      traffic: {
        organic: {
          etv: { gt: 1000 },
        },
      },
    });
  });

  it('should keep non-operator values unchanged', () => {
    const result = normalizeFilter({
      name: 'test',
      count: 42,
      active: true,
    });

    expect(result).toEqual({
      name: 'test',
      count: 42,
      active: true,
    });
  });
});

describe('limitFilterArraySizes', () => {
  it('should truncate arrays exceeding the limit', () => {
    const result = limitFilterArraySizes(
      {
        tags: ['a', 'b', 'c', 'd', 'e'],
      },
      3
    );

    expect(result).toEqual({
      tags: ['a', 'b', 'c'],
    });
  });

  it('should handle nested arrays', () => {
    const result = limitFilterArraySizes(
      {
        nested: {
          items: [1, 2, 3, 4, 5],
        },
      },
      2
    );

    expect(result).toEqual({
      nested: {
        items: [1, 2],
      },
    });
  });

  it('should keep arrays under the limit unchanged', () => {
    const result = limitFilterArraySizes(
      {
        tags: ['a', 'b'],
      },
      10
    );

    expect(result).toEqual({
      tags: ['a', 'b'],
    });
  });

  it('should keep non-array values unchanged', () => {
    const result = limitFilterArraySizes(
      {
        name: 'test',
        count: 42,
      },
      5
    );

    expect(result).toEqual({
      name: 'test',
      count: 42,
    });
  });
});

describe('parseSortString', () => {
  it('should parse single sort field', () => {
    const result = parseSortString('createdAt:desc');
    expect(result).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('should parse multiple sort fields', () => {
    const result = parseSortString('createdAt:desc|name:asc');
    expect(result).toEqual([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('should default to asc for invalid direction', () => {
    const result = parseSortString('field:invalid');
    expect(result).toEqual([{ field: 'field', direction: 'asc' }]);
  });

  it('should decode URI-encoded field names', () => {
    const result = parseSortString('user%20name:asc');
    expect(result).toEqual([{ field: 'user name', direction: 'asc' }]);
  });

  it('should throw for invalid sort string', () => {
    expect(() => parseSortString('invalid')).toThrow('Invalid sort string');
    expect(() => parseSortString('')).toThrow('Invalid sort string');
  });
});

describe('buildSortString', () => {
  it('should build sort string from array', () => {
    const result = buildSortString([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
    expect(result).toBe('createdAt:desc|name:asc');
  });

  it('should encode special characters in field names', () => {
    const result = buildSortString([{ field: 'user name', direction: 'asc' }]);
    expect(result).toBe('user%20name:asc');
  });

  it('should handle empty array', () => {
    const result = buildSortString([]);
    expect(result).toBe('');
  });
});
