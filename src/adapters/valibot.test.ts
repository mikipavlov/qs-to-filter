import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { buildFilterSchema, buildSortSchema, Direction, FilterValue } from './valibot.js';

describe('Valibot Adapter', () => {
  describe('FilterValue', () => {
    describe('with number type', () => {
      const numberFilter = FilterValue(v.number());

      it('should accept direct number value', () => {
        expect(v.parse(numberFilter, 42)).toBe(42);
      });

      it('should accept operator object with single operator', () => {
        expect(v.parse(numberFilter, { gte: 10 })).toEqual({ gte: 10 });
      });

      it('should accept operator object with multiple operators', () => {
        expect(v.parse(numberFilter, { gte: 10, lte: 100 })).toEqual({ gte: 10, lte: 100 });
      });

      it('should accept in operator with array', () => {
        expect(v.parse(numberFilter, { in: [1, 2, 3] })).toEqual({ in: [1, 2, 3] });
      });

      it('should accept exists operator', () => {
        expect(v.parse(numberFilter, { exists: true })).toEqual({ exists: true });
      });

      it('should reject empty operator object', () => {
        expect(() => v.parse(numberFilter, {})).toThrow();
      });

      it('should reject invalid value type', () => {
        expect(() => v.parse(numberFilter, 'not a number')).toThrow();
      });
    });

    describe('with string type', () => {
      const stringFilter = FilterValue(v.string());

      it('should accept direct string value', () => {
        expect(v.parse(stringFilter, 'hello')).toBe('hello');
      });

      it('should accept like operator', () => {
        expect(v.parse(stringFilter, { like: 'pattern' })).toEqual({ like: 'pattern' });
      });

      it('should accept ilike operator', () => {
        expect(v.parse(stringFilter, { ilike: 'PATTERN' })).toEqual({ ilike: 'PATTERN' });
      });

      it('should accept regex operator', () => {
        expect(v.parse(stringFilter, { regex: '^test.*' })).toEqual({ regex: '^test.*' });
      });

      it('should accept in operator with string array', () => {
        expect(v.parse(stringFilter, { in: ['a', 'b', 'c'] })).toEqual({ in: ['a', 'b', 'c'] });
      });
    });

    describe('with picklist (enum) type', () => {
      const statusFilter = FilterValue(v.picklist(['draft', 'published', 'archived']));

      it('should accept valid enum value', () => {
        expect(v.parse(statusFilter, 'published')).toBe('published');
      });

      it('should accept in operator with valid enum values', () => {
        expect(v.parse(statusFilter, { in: ['draft', 'published'] })).toEqual({
          in: ['draft', 'published'],
        });
      });

      it('should accept eq operator with valid enum value', () => {
        expect(v.parse(statusFilter, { eq: 'archived' })).toEqual({ eq: 'archived' });
      });

      it('should reject invalid enum value', () => {
        expect(() => v.parse(statusFilter, 'invalid')).toThrow();
      });
    });

    describe('with boolean type', () => {
      const boolFilter = FilterValue(v.boolean());

      it('should accept direct boolean value', () => {
        expect(v.parse(boolFilter, true)).toBe(true);
        expect(v.parse(boolFilter, false)).toBe(false);
      });

      it('should accept eq operator', () => {
        expect(v.parse(boolFilter, { eq: true })).toEqual({ eq: true });
      });

      it('should accept exists operator', () => {
        expect(v.parse(boolFilter, { exists: false })).toEqual({ exists: false });
      });
    });
  });

  describe('Direction', () => {
    it('should accept "asc"', () => {
      expect(v.parse(Direction, 'asc')).toBe('asc');
    });

    it('should accept "desc"', () => {
      expect(v.parse(Direction, 'desc')).toBe('desc');
    });

    it('should reject invalid direction', () => {
      expect(() => v.parse(Direction, 'invalid')).toThrow();
    });
  });

  describe('buildSortSchema', () => {
    const allowedFields = ['createdAt', 'updatedAt', 'name', 'price'] as const;
    const sortSchema = buildSortSchema(allowedFields);

    it('should accept valid sort array', () => {
      const result = v.parse(sortSchema, [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]);
      expect(result).toEqual([
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]);
    });

    it('should accept empty array', () => {
      expect(v.parse(sortSchema, [])).toEqual([]);
    });

    it('should accept single sort field', () => {
      expect(v.parse(sortSchema, [{ field: 'price', direction: 'asc' }])).toEqual([
        { field: 'price', direction: 'asc' },
      ]);
    });

    it('should reject invalid field', () => {
      expect(() => v.parse(sortSchema, [{ field: 'invalid', direction: 'asc' }])).toThrow();
    });

    it('should reject invalid direction', () => {
      expect(() => v.parse(sortSchema, [{ field: 'name', direction: 'invalid' }])).toThrow();
    });
  });

  describe('buildFilterSchema', () => {
    const userFilterSchema = buildFilterSchema({
      name: v.string(),
      age: v.number(),
      status: v.picklist(['active', 'inactive']),
    });

    it('should accept valid filter object', () => {
      const result = v.parse(userFilterSchema, {
        name: { like: 'John' },
        age: { gte: 18 },
      });
      expect(result).toEqual({
        name: { like: 'John' },
        age: { gte: 18 },
      });
    });

    it('should accept direct values', () => {
      const result = v.parse(userFilterSchema, {
        name: 'John',
        status: 'active',
      });
      expect(result).toEqual({
        name: 'John',
        status: 'active',
      });
    });

    it('should accept empty filter', () => {
      const result = v.parse(userFilterSchema, {});
      expect(result).toEqual({});
    });
  });
});
