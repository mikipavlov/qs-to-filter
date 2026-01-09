import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildFilterSchema,
  buildSortSchema,
  buildWhereSchema,
  Direction,
  FilterValue,
} from './zod.js';

describe('Zod Adapter', () => {
  describe('FilterValue', () => {
    describe('with number type', () => {
      const numberFilter = FilterValue(z.number());

      it('should accept direct number value', () => {
        expect(numberFilter.parse(42)).toBe(42);
      });

      it('should accept operator object with single operator', () => {
        expect(numberFilter.parse({ gte: 10 })).toEqual({ gte: 10 });
      });

      it('should accept operator object with multiple operators', () => {
        expect(numberFilter.parse({ gte: 10, lte: 100 })).toEqual({ gte: 10, lte: 100 });
      });

      it('should accept in operator with array', () => {
        expect(numberFilter.parse({ in: [1, 2, 3] })).toEqual({ in: [1, 2, 3] });
      });

      it('should accept exists operator', () => {
        expect(numberFilter.parse({ exists: true })).toEqual({ exists: true });
      });

      it('should reject empty operator object', () => {
        expect(() => numberFilter.parse({})).toThrow('At least one operator must be specified');
      });

      it('should reject invalid value type', () => {
        expect(() => numberFilter.parse('not a number')).toThrow();
      });
    });

    describe('with string type', () => {
      const stringFilter = FilterValue(z.string());

      it('should accept direct string value', () => {
        expect(stringFilter.parse('hello')).toBe('hello');
      });

      it('should accept like operator', () => {
        expect(stringFilter.parse({ like: 'pattern' })).toEqual({ like: 'pattern' });
      });

      it('should accept ilike operator', () => {
        expect(stringFilter.parse({ ilike: 'PATTERN' })).toEqual({ ilike: 'PATTERN' });
      });

      it('should accept regex operator', () => {
        expect(stringFilter.parse({ regex: '^test.*' })).toEqual({ regex: '^test.*' });
      });

      it('should accept in operator with string array', () => {
        expect(stringFilter.parse({ in: ['a', 'b', 'c'] })).toEqual({ in: ['a', 'b', 'c'] });
      });
    });

    describe('with enum type', () => {
      const StatusEnum = z.enum(['draft', 'published', 'archived']);
      const statusFilter = FilterValue(StatusEnum);

      it('should accept valid enum value', () => {
        expect(statusFilter.parse('published')).toBe('published');
      });

      it('should accept in operator with valid enum values', () => {
        expect(statusFilter.parse({ in: ['draft', 'published'] })).toEqual({
          in: ['draft', 'published'],
        });
      });

      it('should accept eq operator with valid enum value', () => {
        expect(statusFilter.parse({ eq: 'archived' })).toEqual({ eq: 'archived' });
      });

      it('should reject invalid enum value', () => {
        expect(() => statusFilter.parse('invalid')).toThrow();
      });
    });

    describe('with boolean type', () => {
      const boolFilter = FilterValue(z.boolean());

      it('should accept direct boolean value', () => {
        expect(boolFilter.parse(true)).toBe(true);
        expect(boolFilter.parse(false)).toBe(false);
      });

      it('should accept eq operator', () => {
        expect(boolFilter.parse({ eq: true })).toEqual({ eq: true });
      });

      it('should accept exists operator', () => {
        expect(boolFilter.parse({ exists: false })).toEqual({ exists: false });
      });
    });
  });

  describe('Direction', () => {
    it('should accept "asc"', () => {
      expect(Direction.parse('asc')).toBe('asc');
    });

    it('should accept "desc"', () => {
      expect(Direction.parse('desc')).toBe('desc');
    });

    it('should reject invalid direction', () => {
      expect(() => Direction.parse('invalid')).toThrow();
    });
  });

  describe('buildSortSchema', () => {
    const allowedFields = ['createdAt', 'updatedAt', 'name', 'price'] as const;
    const sortSchema = buildSortSchema(allowedFields);

    it('should accept valid sort array', () => {
      const result = sortSchema.parse([
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]);
      expect(result).toEqual([
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]);
    });

    it('should accept empty array', () => {
      expect(sortSchema.parse([])).toEqual([]);
    });

    it('should accept single sort field', () => {
      expect(sortSchema.parse([{ field: 'price', direction: 'asc' }])).toEqual([
        { field: 'price', direction: 'asc' },
      ]);
    });

    it('should reject invalid field', () => {
      expect(() => sortSchema.parse([{ field: 'invalid', direction: 'asc' }])).toThrow();
    });

    it('should reject invalid direction', () => {
      expect(() => sortSchema.parse([{ field: 'name', direction: 'invalid' }])).toThrow();
    });

    it('should reject non-array input', () => {
      expect(() => sortSchema.parse({ field: 'name', direction: 'asc' })).toThrow();
    });
  });

  describe('buildFilterSchema', () => {
    const userFilterSchema = buildFilterSchema({
      name: z.string(),
      age: z.number(),
      status: z.enum(['active', 'inactive']),
    });

    it('should accept valid filter object', () => {
      const result = userFilterSchema.parse({
        name: { like: 'John' },
        age: { gte: 18 },
      });
      expect(result).toEqual({
        name: { like: 'John' },
        age: { gte: 18 },
      });
    });

    it('should accept direct values', () => {
      const result = userFilterSchema.parse({
        name: 'John',
        status: 'active',
      });
      expect(result).toEqual({
        name: 'John',
        status: 'active',
      });
    });

    it('should accept empty filter', () => {
      const result = userFilterSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('buildWhereSchema', () => {
    const userWhereSchema = buildWhereSchema({
      name: z.string(),
      age: z.number(),
    });

    it('should accept filter with AND', () => {
      const result = userWhereSchema.parse({
        AND: [{ name: { like: 'John' } }, { age: { gte: 18 } }],
      });
      expect(result.AND).toHaveLength(2);
    });

    it('should accept filter with OR', () => {
      const result = userWhereSchema.parse({
        OR: [{ name: 'John' }, { name: 'Jane' }],
      });
      expect(result.OR).toHaveLength(2);
    });

    it('should accept filter with NOT', () => {
      const result = userWhereSchema.parse({
        NOT: { name: 'banned' },
      });
      expect(result.NOT).toBeDefined();
    });

    it('should accept nested logical operators', () => {
      const result = userWhereSchema.parse({
        AND: [{ OR: [{ name: 'John' }, { name: 'Jane' }] }, { age: { gte: 18 } }],
      });
      expect(result.AND).toHaveLength(2);
    });
  });
});
