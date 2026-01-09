import { describe, expect, it } from 'vitest';
import {
  getOperatorNames,
  isOperator,
  OPERATOR_DEFINITIONS,
  operatorRegistry,
} from './operators.js';

describe('Operator Registry', () => {
  describe('OPERATOR_DEFINITIONS', () => {
    it('should have base operators', () => {
      const base = OPERATOR_DEFINITIONS.base;
      expect(base.map((op) => op.name)).toContain('eq');
      expect(base.map((op) => op.name)).toContain('ne');
      expect(base.map((op) => op.name)).toContain('in');
      expect(base.map((op) => op.name)).toContain('nin');
      expect(base.map((op) => op.name)).toContain('exists');
    });

    it('should have comparison operators', () => {
      const comparison = OPERATOR_DEFINITIONS.comparison;
      expect(comparison.map((op) => op.name)).toContain('gt');
      expect(comparison.map((op) => op.name)).toContain('gte');
      expect(comparison.map((op) => op.name)).toContain('lt');
      expect(comparison.map((op) => op.name)).toContain('lte');
    });

    it('should have string operators', () => {
      const string = OPERATOR_DEFINITIONS.string;
      expect(string.map((op) => op.name)).toContain('like');
      expect(string.map((op) => op.name)).toContain('ilike');
      expect(string.map((op) => op.name)).toContain('regex');
    });

    it('should have array operators', () => {
      const array = OPERATOR_DEFINITIONS.array;
      expect(array.map((op) => op.name)).toContain('size');
      expect(array.map((op) => op.name)).toContain('all');
    });

    it('should have logical operators', () => {
      const logical = OPERATOR_DEFINITIONS.logical;
      expect(logical.map((op) => op.name)).toContain('or');
    });
  });

  describe('operatorRegistry', () => {
    it('should have all built-in operators', () => {
      expect(operatorRegistry.has('eq')).toBe(true);
      expect(operatorRegistry.has('ne')).toBe(true);
      expect(operatorRegistry.has('gt')).toBe(true);
      expect(operatorRegistry.has('gte')).toBe(true);
      expect(operatorRegistry.has('lt')).toBe(true);
      expect(operatorRegistry.has('lte')).toBe(true);
      expect(operatorRegistry.has('in')).toBe(true);
      expect(operatorRegistry.has('nin')).toBe(true);
      expect(operatorRegistry.has('like')).toBe(true);
      expect(operatorRegistry.has('ilike')).toBe(true);
      expect(operatorRegistry.has('regex')).toBe(true);
      expect(operatorRegistry.has('exists')).toBe(true);
      expect(operatorRegistry.has('size')).toBe(true);
      expect(operatorRegistry.has('all')).toBe(true);
      expect(operatorRegistry.has('or')).toBe(true);
    });

    it('should return operator definition by name', () => {
      const eq = operatorRegistry.get('eq');
      expect(eq).toBeDefined();
      expect(eq?.name).toBe('eq');
      expect(eq?.description).toBe('Equal to value');
      expect(eq?.category).toBe('base');
    });

    it('should return undefined for unknown operators', () => {
      expect(operatorRegistry.get('unknown')).toBeUndefined();
    });

    it('should list all operator names', () => {
      const names = operatorRegistry.names();
      expect(names).toContain('eq');
      expect(names).toContain('gte');
      expect(names).toContain('like');
      expect(names.length).toBeGreaterThanOrEqual(15);
    });

    it('should get operators by category', () => {
      const comparison = operatorRegistry.byCategory('comparison');
      expect(comparison.length).toBe(4);
      expect(comparison.every((op) => op.category === 'comparison')).toBe(true);
    });

    it('should get all operator definitions', () => {
      const all = operatorRegistry.all();
      expect(all.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('custom operator registration', () => {
    it('should register custom operator', () => {
      operatorRegistry.register({
        name: 'between',
        description: 'Value between range',
        category: 'comparison',
        valueTypes: ['array'],
        validate: (v) =>
          Array.isArray(v) && v.length === 2 ? true : 'between requires [min, max] array',
      });

      expect(operatorRegistry.has('between')).toBe(true);
      const between = operatorRegistry.get('between');
      expect(between?.description).toBe('Value between range');
    });

    it('should list custom operators', () => {
      const custom = operatorRegistry.custom();
      expect(custom.map((op) => op.name)).toContain('between');
    });

    it('should validate custom operator values', () => {
      const result1 = operatorRegistry.validate('between', [1, 10]);
      expect(result1).toBe(true);

      const result2 = operatorRegistry.validate('between', 'invalid');
      expect(result2).toBe('between requires [min, max] array');
    });

    it('should unregister custom operator', () => {
      expect(operatorRegistry.unregister('between')).toBe(true);
      expect(operatorRegistry.has('between')).toBe(false);
    });

    it('should return false when unregistering non-existent operator', () => {
      expect(operatorRegistry.unregister('nonexistent')).toBe(false);
    });
  });

  describe('operator conversion', () => {
    it('should convert string numbers for comparison operators', () => {
      expect(operatorRegistry.convert('gt', '100')).toBe(100);
      expect(operatorRegistry.convert('gte', '50.5')).toBe(50.5);
      expect(operatorRegistry.convert('lt', '-10')).toBe(-10);
    });

    it('should not convert non-numeric strings for comparison operators', () => {
      expect(operatorRegistry.convert('gt', 'hello')).toBe('hello');
    });

    it('should convert boolean strings for exists operator', () => {
      expect(operatorRegistry.convert('exists', 'true')).toBe(true);
      expect(operatorRegistry.convert('exists', 'false')).toBe(false);
    });

    it('should ensure arrays for in/nin/all operators', () => {
      expect(operatorRegistry.convert('in', 'single')).toEqual(['single']);
      expect(operatorRegistry.convert('nin', 'single')).toEqual(['single']);
      expect(operatorRegistry.convert('all', 'single')).toEqual(['single']);
      expect(operatorRegistry.convert('in', [1, 2])).toEqual([1, 2]);
    });

    it('should convert string to number for size operator', () => {
      expect(operatorRegistry.convert('size', '5')).toBe(5);
    });

    it('should return value unchanged for operators without conversion', () => {
      expect(operatorRegistry.convert('eq', 'hello')).toBe('hello');
      expect(operatorRegistry.convert('like', 'pattern')).toBe('pattern');
    });
  });

  describe('getOperatorNames', () => {
    it('should return all operator names', () => {
      const names = getOperatorNames();
      expect(names).toContain('eq');
      expect(names).toContain('gte');
      expect(names).toContain('like');
    });
  });

  describe('isOperator', () => {
    it('should return true for valid operators', () => {
      expect(isOperator('eq')).toBe(true);
      expect(isOperator('gte')).toBe(true);
      expect(isOperator('like')).toBe(true);
    });

    it('should return false for invalid operators', () => {
      expect(isOperator('invalid')).toBe(false);
      expect(isOperator('$eq')).toBe(false); // MongoDB style not valid
    });
  });
});
