import { describe, expect, it } from 'vitest';
import {
  buildMongoFilter,
  buildMongoSort,
  fromMongo,
  toMongo,
  transformBracketToMongoFilter,
} from './mongo.js';

describe('transformBracketToMongoFilter', () => {
  describe('simple equality filters', () => {
    it('transforms simple string equality', () => {
      const input = { status: 'published' };
      const expected = { status: 'published' };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms simple number equality', () => {
      const input = { count: 42 };
      const expected = { count: 42 };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms multiple simple fields', () => {
      const input = { status: 'published', category: 'tech' };
      const expected = { status: 'published', category: 'tech' };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('comparison operators', () => {
    it('transforms gt operator', () => {
      const input = { count: { gt: 10 } };
      const expected = { count: { $gt: 10 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms gte operator', () => {
      const input = { couponCount: { gte: 10 } };
      const expected = { couponCount: { $gte: 10 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms lt operator', () => {
      const input = { price: { lt: 100 } };
      const expected = { price: { $lt: 100 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms lte operator', () => {
      const input = { age: { lte: 65 } };
      const expected = { age: { $lte: 65 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms eq operator', () => {
      const input = { status: { eq: 'active' } };
      const expected = { status: { $eq: 'active' } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms ne operator', () => {
      const input = { status: { ne: 'deleted' } };
      const expected = { status: { $ne: 'deleted' } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms multiple operators on same field', () => {
      const input = { age: { gte: 18, lte: 65 } };
      const expected = { age: { $gte: 18, $lte: 65 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('array operators', () => {
    it('transforms in operator', () => {
      const input = { status: { in: ['published', 'draft', 'pending'] } };
      const expected = { status: { $in: ['published', 'draft', 'pending'] } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms nin operator', () => {
      const input = { status: { nin: ['deleted', 'archived'] } };
      const expected = { status: { $nin: ['deleted', 'archived'] } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms all operator', () => {
      const input = { tags: { all: ['javascript', 'typescript'] } };
      const expected = { tags: { $all: ['javascript', 'typescript'] } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms size operator', () => {
      const input = { items: { size: 5 } };
      const expected = { items: { $size: 5 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('string matching operators', () => {
    it('transforms like operator to regex', () => {
      const input = { name: { like: 'john' } };
      const expected = { name: { $regex: 'john' } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms ilike operator to case-insensitive regex', () => {
      const input = { name: { ilike: 'john' } };
      const expected = { name: { $regex: 'john', $options: 'i' } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms regex operator', () => {
      const input = { email: { regex: '^[a-z]+@' } };
      const expected = { email: { $regex: '^[a-z]+@' } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('exists operator', () => {
    it('transforms exists=true', () => {
      const input = { field: { exists: true } };
      const expected = { field: { $exists: true } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms exists=false', () => {
      const input = { field: { exists: false } };
      const expected = { field: { $exists: false } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('nested objects', () => {
    it('transforms simple nested object', () => {
      const input = {
        user: {
          name: 'John',
        },
      };
      const expected = { 'user.name': 'John' };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms nested object with operator', () => {
      const input = {
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      };
      const expected = { 'traffic.organic.etv': { $gt: 1000 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: { gte: 100 },
            },
          },
        },
      };
      const expected = { 'level1.level2.level3.value': { $gte: 100 } };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms multiple nested fields', () => {
      const input = {
        traffic: {
          organic: {
            etv: { gt: 1000 },
            keywords: { gte: 50 },
          },
        },
      };
      const expected = {
        'traffic.organic.etv': { $gt: 1000 },
        'traffic.organic.keywords': { $gte: 50 },
      };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('complex filters', () => {
    it('transforms mixed simple and operator filters', () => {
      const input = {
        status: 'published',
        couponCount: { gte: 10 },
        category: 'fashion',
      };
      const expected = {
        status: 'published',
        couponCount: { $gte: 10 },
        category: 'fashion',
      };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('transforms complex multi-field filter', () => {
      const input = {
        status: 'published',
        couponCount: { gte: 10 },
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
        categories: { in: ['fashion', 'beauty'] },
      };
      const expected = {
        status: 'published',
        couponCount: { $gte: 10 },
        'traffic.organic.etv': { $gt: 1000 },
        categories: { $in: ['fashion', 'beauty'] },
      };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });

  describe('edge cases', () => {
    it('handles empty object', () => {
      const input = {};
      const expected = {};
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('handles null values', () => {
      const input = { field: null };
      const expected = { field: null };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });

    it('handles array values without operators', () => {
      const input = { tags: ['tag1', 'tag2'] };
      const expected = { tags: ['tag1', 'tag2'] };
      expect(transformBracketToMongoFilter(input)).toEqual(expected);
    });
  });
});

describe('buildMongoFilter', () => {
  it('should convert id to _id', () => {
    const result = buildMongoFilter({ id: '123' });
    expect(result).toEqual({ _id: '123' });
  });

  it('should handle complex filters', () => {
    const result = buildMongoFilter({
      status: 'published',
      count: { gte: 10 },
    });
    expect(result).toEqual({
      status: 'published',
      count: { $gte: 10 },
    });
  });
});

describe('buildMongoSort', () => {
  it('should convert sort array to MongoDB sort object', () => {
    const result = buildMongoSort([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
    expect(result).toEqual({
      createdAt: -1,
      name: 1,
    });
  });

  it('should convert id to _id in sort', () => {
    const result = buildMongoSort([{ field: 'id', direction: 'asc' }]);
    expect(result).toEqual({ _id: 1 });
  });

  it('should handle empty sort array', () => {
    const result = buildMongoSort([]);
    expect(result).toEqual({});
  });
});

describe('fromMongo', () => {
  it('should convert _id to id', () => {
    const mongoDoc = { _id: '123', name: 'test', count: 42 };
    const result = fromMongo(mongoDoc);
    expect(result).toEqual({ id: '123', name: 'test', count: 42 });
    expect(result).not.toHaveProperty('_id');
  });

  it('should throw if _id is missing', () => {
    const invalidDoc = { name: 'test' } as never;
    expect(() => fromMongo(invalidDoc)).toThrow('Cannot transform object without _id property');
  });
});

describe('toMongo', () => {
  it('should convert id to _id', () => {
    const appObj = { id: '123', name: 'test', count: 42 };
    const result = toMongo(appObj);
    expect(result).toEqual({ _id: '123', name: 'test', count: 42 });
    expect(result).not.toHaveProperty('id');
  });

  it('should throw if id is missing', () => {
    const invalidObj = { name: 'test' } as never;
    expect(() => toMongo(invalidObj)).toThrow("Cannot transform object without 'id' property");
  });
});
