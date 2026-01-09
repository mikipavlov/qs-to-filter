/**
 * Operator Registry and Definitions
 *
 * Provides a centralized registry for filter operators with extensibility support.
 * Users can register custom operators without modifying the core library.
 */

import type { FilterOperator } from './types.js';

/**
 * Categories of operators
 */
export type OperatorCategory = 'base' | 'comparison' | 'string' | 'array' | 'logical';

/**
 * Definition for a filter operator
 */
export interface OperatorDefinition {
  /** Operator name (e.g., 'eq', 'gte', 'like') */
  name: string;

  /** Human-readable description */
  description: string;

  /** Category for grouping */
  category: OperatorCategory;

  /**
   * Value types this operator accepts.
   * Used for validation and documentation.
   */
  valueTypes: ('string' | 'number' | 'boolean' | 'array' | 'any')[];

  /**
   * Validate the operator value.
   * @returns true if valid, string with error message if invalid
   */
  validate?: (value: unknown) => true | string;

  /**
   * Convert string value to proper type.
   * Called during query string parsing.
   */
  convert?: (value: unknown) => unknown;
}

/**
 * Built-in operator definitions grouped by category
 */
export const OPERATOR_DEFINITIONS: Record<OperatorCategory, OperatorDefinition[]> = {
  base: [
    {
      name: 'eq',
      description: 'Equal to value',
      category: 'base',
      valueTypes: ['any'],
    },
    {
      name: 'ne',
      description: 'Not equal to value',
      category: 'base',
      valueTypes: ['any'],
    },
    {
      name: 'in',
      description: 'Value is in array',
      category: 'base',
      valueTypes: ['array'],
      convert: (v) => (Array.isArray(v) ? v : [v]),
    },
    {
      name: 'nin',
      description: 'Value is not in array',
      category: 'base',
      valueTypes: ['array'],
      convert: (v) => (Array.isArray(v) ? v : [v]),
    },
    {
      name: 'exists',
      description: 'Field exists (not null/undefined)',
      category: 'base',
      valueTypes: ['boolean'],
      convert: (v) => (typeof v === 'string' ? v === 'true' : Boolean(v)),
    },
  ],
  comparison: [
    {
      name: 'gt',
      description: 'Greater than',
      category: 'comparison',
      valueTypes: ['number', 'string'],
      convert: (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v),
    },
    {
      name: 'gte',
      description: 'Greater than or equal',
      category: 'comparison',
      valueTypes: ['number', 'string'],
      convert: (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v),
    },
    {
      name: 'lt',
      description: 'Less than',
      category: 'comparison',
      valueTypes: ['number', 'string'],
      convert: (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v),
    },
    {
      name: 'lte',
      description: 'Less than or equal',
      category: 'comparison',
      valueTypes: ['number', 'string'],
      convert: (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v),
    },
  ],
  string: [
    {
      name: 'like',
      description: 'Pattern match (case-sensitive)',
      category: 'string',
      valueTypes: ['string'],
    },
    {
      name: 'ilike',
      description: 'Pattern match (case-insensitive)',
      category: 'string',
      valueTypes: ['string'],
    },
    {
      name: 'regex',
      description: 'Regular expression match',
      category: 'string',
      valueTypes: ['string'],
      validate: (v) => {
        if (typeof v !== 'string') return 'regex value must be a string';
        try {
          new RegExp(v);
          return true;
        } catch {
          return 'invalid regex pattern';
        }
      },
    },
  ],
  array: [
    {
      name: 'size',
      description: 'Array size equals',
      category: 'array',
      valueTypes: ['number'],
      convert: (v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
      validate: (v) =>
        typeof v === 'number' && v >= 0 ? true : 'size must be a non-negative integer',
    },
    {
      name: 'all',
      description: 'Array contains all values',
      category: 'array',
      valueTypes: ['array'],
      convert: (v) => (Array.isArray(v) ? v : [v]),
    },
  ],
  logical: [
    {
      name: 'or',
      description: 'Logical OR - matches if any condition matches',
      category: 'logical',
      valueTypes: ['array'],
    },
  ],
};

/**
 * Operator Registry class for managing operators
 */
class OperatorRegistry {
  private operators = new Map<string, OperatorDefinition>();
  private customOperators = new Map<string, OperatorDefinition>();

  constructor() {
    // Register built-in operators
    for (const definitions of Object.values(OPERATOR_DEFINITIONS)) {
      for (const def of definitions) {
        this.operators.set(def.name, def);
      }
    }
  }

  /**
   * Register a custom operator
   */
  register(definition: OperatorDefinition): void {
    this.customOperators.set(definition.name, definition);
    this.operators.set(definition.name, definition);
  }

  /**
   * Unregister a custom operator
   */
  unregister(name: string): boolean {
    if (this.customOperators.has(name)) {
      this.customOperators.delete(name);
      // Restore built-in if it exists
      for (const definitions of Object.values(OPERATOR_DEFINITIONS)) {
        const builtIn = definitions.find((d) => d.name === name);
        if (builtIn) {
          this.operators.set(name, builtIn);
          return true;
        }
      }
      this.operators.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get an operator definition
   */
  get(name: string): OperatorDefinition | undefined {
    return this.operators.get(name);
  }

  /**
   * Check if an operator exists
   */
  has(name: string): boolean {
    return this.operators.has(name);
  }

  /**
   * Get all operator names
   */
  names(): string[] {
    return Array.from(this.operators.keys());
  }

  /**
   * Get all operators by category
   */
  byCategory(category: OperatorCategory): OperatorDefinition[] {
    return Array.from(this.operators.values()).filter((op) => op.category === category);
  }

  /**
   * Get all operator definitions
   */
  all(): OperatorDefinition[] {
    return Array.from(this.operators.values());
  }

  /**
   * Get only custom operators
   */
  custom(): OperatorDefinition[] {
    return Array.from(this.customOperators.values());
  }

  /**
   * Validate a value for an operator
   */
  validate(operatorName: string, value: unknown): true | string {
    const def = this.operators.get(operatorName);
    if (!def) return `unknown operator: ${operatorName}`;
    if (def.validate) return def.validate(value);
    return true;
  }

  /**
   * Convert a value for an operator
   */
  convert(operatorName: string, value: unknown): unknown {
    const def = this.operators.get(operatorName);
    if (!def || !def.convert) return value;
    return def.convert(value);
  }
}

/**
 * Global operator registry instance
 */
export const operatorRegistry = new OperatorRegistry();

/**
 * Get all operator names as a tuple for type inference
 */
export function getOperatorNames(): FilterOperator[] {
  return operatorRegistry.names() as FilterOperator[];
}

/**
 * Check if a string is a valid operator name
 */
export function isOperator(name: string): name is FilterOperator {
  return operatorRegistry.has(name);
}
