/**
 * Adapter Interfaces
 *
 * Defines formal interfaces for database adapters and schema adapters.
 * These interfaces ensure consistency across different adapter implementations.
 */

import type { FilterOperator, Sort, SortDirection } from '../types.js';

// ============================================
// DATABASE ADAPTER INTERFACES
// ============================================

/**
 * Result of building a database filter
 */
export interface FilterResult<T> {
  /** The database-specific filter object */
  filter: T;
  /** Any warnings generated during transformation */
  warnings?: string[];
}

/**
 * Options for building database filters
 */
export interface DatabaseAdapterOptions {
  /**
   * Custom operator mappings to override or extend defaults.
   * Key is bracket-style operator, value is database-specific operator.
   */
  customOperators?: Record<string, string>;

  /**
   * Whether to flatten nested objects to dot notation.
   * Default: true for most databases
   */
  flattenObjects?: boolean;

  /**
   * Field name transformations.
   * Common use: 'id' -> '_id' for MongoDB
   */
  fieldTransforms?: Record<string, string>;
}

/**
 * Interface for database adapters
 */
export interface DatabaseAdapter<TFilter, TSort> {
  /** Name of the database this adapter is for */
  readonly name: string;

  /** Operator mapping from bracket-style to database-specific */
  readonly operatorMap: Record<string, string>;

  /** Operators supported by this database */
  readonly supportedOperators: readonly FilterOperator[];

  /**
   * Build a database-specific filter from a bracket-style filter object
   */
  buildFilter(filter: Record<string, unknown>, options?: DatabaseAdapterOptions): TFilter;

  /**
   * Build a database-specific sort from a sort array
   */
  buildSort(sort: Sort): TSort;

  /**
   * Check if an operator is supported by this database
   */
  isOperatorSupported(operator: string): boolean;
}

/**
 * Base class for database adapters with shared functionality
 */
export abstract class BaseDatabaseAdapter<TFilter, TSort>
  implements DatabaseAdapter<TFilter, TSort>
{
  abstract readonly name: string;
  abstract readonly operatorMap: Record<string, string>;

  get supportedOperators(): FilterOperator[] {
    return Object.keys(this.operatorMap) as FilterOperator[];
  }

  isOperatorSupported(operator: string): boolean {
    return operator in this.operatorMap;
  }

  abstract buildFilter(filter: Record<string, unknown>, options?: DatabaseAdapterOptions): TFilter;

  abstract buildSort(sort: Sort): TSort;

  /**
   * Flatten a nested object to dot notation
   */
  protected flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !this.isOperatorObject(value as Record<string, unknown>)
      ) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = value;
      }
    }

    return result;
  }

  /**
   * Check if an object contains operator keys
   */
  protected isOperatorObject(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => this.isOperatorSupported(key));
  }

  /**
   * Transform a field name using fieldTransforms option
   */
  protected transformFieldName(field: string, transforms?: Record<string, string>): string {
    if (!transforms) return field;
    return transforms[field] ?? field;
  }
}

// ============================================
// SCHEMA ADAPTER INTERFACES
// ============================================

/**
 * Interface for schema adapters
 */
export interface SchemaAdapter<TSchema, TOutput> {
  /** Name of the schema library */
  readonly name: string;

  /**
   * Create a filter value schema for a value type
   */
  FilterValue(valueSchema: TSchema): TSchema;

  /**
   * Direction enum/union schema for sort direction
   */
  Direction: TSchema;

  /**
   * Build a sort schema with allowed fields
   */
  buildSortSchema<T extends string>(allowedFields: readonly T[]): TSchema;

  /**
   * Build a complete filter schema from a shape
   */
  buildFilterSchema(shape: Record<string, TSchema>): TSchema;

  /**
   * Parse/validate a value against a schema
   */
  parse(schema: TSchema, value: unknown): TOutput;

  /**
   * Check if a value is valid against a schema (non-throwing)
   */
  safeParse(
    schema: TSchema,
    value: unknown
  ): { success: true; data: TOutput } | { success: false; error: unknown };
}

// ============================================
// TYPE UTILITIES FOR ADAPTERS
// ============================================

/**
 * Extract the filter type from a database adapter
 */
export type AdapterFilterType<T extends DatabaseAdapter<unknown, unknown>> =
  T extends DatabaseAdapter<infer F, unknown> ? F : never;

/**
 * Extract the sort type from a database adapter
 */
export type AdapterSortType<T extends DatabaseAdapter<unknown, unknown>> =
  T extends DatabaseAdapter<unknown, infer S> ? S : never;

/**
 * Sort item structure used across adapters
 */
export interface SortItem {
  field: string;
  direction: SortDirection;
}

/**
 * Common sort array type
 */
export type SortArray = SortItem[];
