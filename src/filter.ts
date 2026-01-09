/**
 * Database-agnostic filter DSL
 *
 * This module provides a unified filter query language that can be used across
 * different databases (MongoDB, PostgreSQL, etc.). It uses bracket-style operators
 * (without $ prefix) as the internal representation.
 *
 * Flow: HTTP Query String → Filter DSL → Database-Specific Query
 */

import { FILTER_OPERATORS, type FilterOperator, type Sort, type SortDirection } from './types.js';

/**
 * Checks if a key is a valid filter operator
 */
export function isFilterOperator(key: string): key is FilterOperator {
  return FILTER_OPERATORS.includes(key as FilterOperator);
}

/**
 * Checks if an object contains filter operators
 */
export function hasFilterOperators(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  return Object.keys(obj).some((key) => isFilterOperator(key));
}

/**
 * Type conversion for filter operator values.
 * Converts string values to appropriate types based on the operator.
 */
export function convertFilterValue(operator: FilterOperator, value: unknown): unknown {
  // Numeric operators: convert string numbers to actual numbers
  if (
    (operator === 'gt' ||
      operator === 'gte' ||
      operator === 'lt' ||
      operator === 'lte' ||
      operator === 'eq' ||
      operator === 'ne' ||
      operator === 'size') &&
    typeof value === 'string' &&
    /^-?\d+(\.\d+)?$/.test(value)
  ) {
    return Number(value);
  }

  // Boolean operators: convert string booleans to actual booleans
  if (operator === 'exists' && typeof value === 'string') {
    return value === 'true';
  }

  // Array operators: ensure values are always arrays
  if ((operator === 'in' || operator === 'nin' || operator === 'all') && !Array.isArray(value)) {
    return [value];
  }

  // String operators: keep as-is
  return value;
}

/**
 * Recursively applies type conversion to filter operator values.
 * This normalizes the filter to ensure all values have the correct types.
 */
export function normalizeFilter(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isFilterOperator(key)) {
      // This is a filter operator, apply type conversion
      result[key] = convertFilterValue(key, value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively process nested objects
      result[key] = normalizeFilter(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Limits array sizes in a filter to prevent DoS attacks.
 * Recursively traverses the filter and truncates any arrays exceeding the limit.
 */
export function limitFilterArraySizes(
  filter: Record<string, unknown>,
  maxSize: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (Array.isArray(value)) {
      // Truncate arrays that exceed the limit
      result[key] = value.slice(0, maxSize);
    } else if (value && typeof value === 'object') {
      // Recursively process nested objects
      result[key] = limitFilterArraySizes(value as Record<string, unknown>, maxSize);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Parses a sort string in the format "field1:asc|field2:desc"
 */
export function parseSortString(sortString: string): Sort {
  return sortString.split('|').map((part) => {
    const [field, direction] = part.split(':');

    if (!field || !direction) {
      throw new Error('Invalid sort string');
    }

    return {
      field: decodeURIComponent(field),
      direction: (direction as SortDirection) === 'desc' ? 'desc' : 'asc',
    };
  });
}

/**
 * Builds a sort string from a sort array
 */
export function buildSortString(sortArray: Sort): string {
  return sortArray
    .map(({ field, direction }) => `${encodeURIComponent(field)}:${direction}`)
    .join('|');
}

// Re-export types
export { FILTER_OPERATORS, type FilterOperator, type Sort, type SortDirection };
