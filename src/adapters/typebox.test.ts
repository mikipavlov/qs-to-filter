import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { buildFilterSchema, buildSortSchema, Direction, FilterValue, Type } from './typebox.js';

describe('TypeBox Adapter', () => {
  describe('FilterValue', () => {
    describe('with number type', () => {
      const numberFilter = FilterValue(Type.Number());

      it('should accept direct number value', () => {
        expect(Value.Check(numberFilter, 42)).toBe(true);
        expect(Value.Decode(numberFilter, 42)).toBe(42);
      });

      it('should accept operator object with single operator', () => {
        expect(Value.Check(numberFilter, { gte: 10 })).toBe(true);
      });

      it('should accept operator object with multiple operators', () => {
        expect(Value.Check(numberFilter, { gte: 10, lte: 100 })).toBe(true);
      });

      it('should accept in operator with array', () => {
        expect(Value.Check(numberFilter, { in: [1, 2, 3] })).toBe(true);
      });

      it('should accept exists operator', () => {
        expect(Value.Check(numberFilter, { exists: true })).toBe(true);
      });

      it('should accept empty operator object', () => {
        // TypeBox allows empty objects by default
        expect(Value.Check(numberFilter, {})).toBe(true);
      });

      it('should reject invalid value type', () => {
        expect(Value.Check(numberFilter, 'not a number')).toBe(false);
      });
    });

    describe('with string type', () => {
      const stringFilter = FilterValue(Type.String());

      it('should accept direct string value', () => {
        expect(Value.Check(stringFilter, 'hello')).toBe(true);
      });

      it('should accept like operator', () => {
        expect(Value.Check(stringFilter, { like: 'pattern' })).toBe(true);
      });

      it('should accept ilike operator', () => {
        expect(Value.Check(stringFilter, { ilike: 'PATTERN' })).toBe(true);
      });

      it('should accept regex operator', () => {
        expect(Value.Check(stringFilter, { regex: '^test.*' })).toBe(true);
      });

      it('should accept in operator with string array', () => {
        expect(Value.Check(stringFilter, { in: ['a', 'b', 'c'] })).toBe(true);
      });
    });

    describe('with literal union (enum) type', () => {
      const statusSchema = Type.Union([
        Type.Literal('draft'),
        Type.Literal('published'),
        Type.Literal('archived'),
      ]);
      const statusFilter = FilterValue(statusSchema);

      it('should accept valid enum value', () => {
        expect(Value.Check(statusFilter, 'published')).toBe(true);
      });

      it('should accept in operator with valid enum values', () => {
        expect(Value.Check(statusFilter, { in: ['draft', 'published'] })).toBe(true);
      });

      it('should accept eq operator with valid enum value', () => {
        expect(Value.Check(statusFilter, { eq: 'archived' })).toBe(true);
      });

      it('should reject invalid enum value', () => {
        expect(Value.Check(statusFilter, 'invalid')).toBe(false);
      });
    });

    describe('with boolean type', () => {
      const boolFilter = FilterValue(Type.Boolean());

      it('should accept direct boolean value', () => {
        expect(Value.Check(boolFilter, true)).toBe(true);
        expect(Value.Check(boolFilter, false)).toBe(true);
      });

      it('should accept eq operator', () => {
        expect(Value.Check(boolFilter, { eq: true })).toBe(true);
      });

      it('should accept exists operator', () => {
        expect(Value.Check(boolFilter, { exists: false })).toBe(true);
      });
    });
  });

  describe('Direction', () => {
    it('should accept "asc"', () => {
      expect(Value.Check(Direction, 'asc')).toBe(true);
    });

    it('should accept "desc"', () => {
      expect(Value.Check(Direction, 'desc')).toBe(true);
    });

    it('should reject invalid direction', () => {
      expect(Value.Check(Direction, 'invalid')).toBe(false);
    });
  });

  describe('buildSortSchema', () => {
    const allowedFields = ['createdAt', 'updatedAt', 'name', 'price'] as const;
    const sortSchema = buildSortSchema(allowedFields);

    it('should accept valid sort array', () => {
      expect(
        Value.Check(sortSchema, [
          { field: 'createdAt', direction: 'desc' },
          { field: 'name', direction: 'asc' },
        ])
      ).toBe(true);
    });

    it('should accept empty array', () => {
      expect(Value.Check(sortSchema, [])).toBe(true);
    });

    it('should accept single sort field', () => {
      expect(Value.Check(sortSchema, [{ field: 'price', direction: 'asc' }])).toBe(true);
    });

    it('should reject invalid field', () => {
      expect(Value.Check(sortSchema, [{ field: 'invalid', direction: 'asc' }])).toBe(false);
    });

    it('should reject invalid direction', () => {
      expect(Value.Check(sortSchema, [{ field: 'name', direction: 'invalid' }])).toBe(false);
    });
  });

  describe('buildFilterSchema', () => {
    const userFilterSchema = buildFilterSchema({
      name: Type.String(),
      age: Type.Number(),
      status: Type.Union([Type.Literal('active'), Type.Literal('inactive')]),
    });

    it('should accept valid filter object', () => {
      expect(
        Value.Check(userFilterSchema, {
          name: { like: 'John' },
          age: { gte: 18 },
        })
      ).toBe(true);
    });

    it('should accept direct values', () => {
      expect(
        Value.Check(userFilterSchema, {
          name: 'John',
          status: 'active',
        })
      ).toBe(true);
    });

    it('should accept empty filter', () => {
      expect(Value.Check(userFilterSchema, {})).toBe(true);
    });
  });
});
