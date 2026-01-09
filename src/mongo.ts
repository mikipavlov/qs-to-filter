/**
 * MongoDB Adapter Layer
 *
 * This module transforms database-agnostic filter DSL into MongoDB-specific queries.
 *
 * Responsibilities:
 * - Transform bracket-style operators to MongoDB $ operators
 * - Flatten nested objects for MongoDB dot notation
 * - Convert application id ↔ MongoDB _id
 * - Build MongoDB Filter and Sort objects
 * - Apply security validation (field access, regex safety)
 */

import type { Filter } from 'mongodb';
import type { DatabaseAdapterOptions } from './adapters/interface.js';
import { isFilterOperator, type Sort } from './filter.js';
import type { SecurityOptions } from './security.js';
import { validateFilter, validateRegexPattern } from './security.js';
import type { WithDashId, WithId } from './types.js';

/**
 * Options for MongoDB filter building
 */
export interface MongoFilterOptions extends DatabaseAdapterOptions {
  /**
   * Security options for validating the filter
   */
  security?: SecurityOptions;

  /**
   * Whether to validate the filter before building.
   * Default: true
   */
  validate?: boolean;
}

/**
 * Checks if an object contains bracket-style filter operators (without $).
 */
export function isBracketOperator(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const keys = Object.keys(obj);
  return keys.some((key) => isFilterOperator(key));
}

/**
 * Flattens an object while preserving bracket-style operator objects.
 */
export function flattenObjectPreserveOperators(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.entries(obj).forEach(([key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof val === 'object' && val !== null && !Array.isArray(val) && !isBracketOperator(val)) {
      Object.assign(
        result,
        flattenObjectPreserveOperators(val as Record<string, unknown>, fullKey)
      );
    } else {
      result[fullKey] = val;
    }
  });

  return result;
}

/**
 * Flattens a filter object while preserving bracket-style operators.
 * Used internally before converting to MongoDB format.
 */
export function flattenMongoQuery(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const valueObj = value as Record<string, unknown>;

      // Handle nested objects with operators
      for (const [subKey, subValue] of Object.entries(valueObj)) {
        if (isFilterOperator(subKey)) {
          // Keep bracket operator at current level
          if (!result[key]) result[key] = {};
          (result[key] as Record<string, unknown>)[subKey] = subValue;
        } else if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
          // If nested object has operators, flatten with parent key
          if (Object.keys(subValue as Record<string, unknown>).some((k) => isFilterOperator(k))) {
            result[`${newKey}.${subKey}`] = subValue;
          } else {
            // Regular nested object, continue flattening
            Object.assign(result, flattenMongoQuery({ [subKey]: subValue }, newKey));
          }
        } else {
          // Regular value, flatten
          result[`${newKey}.${subKey}`] = subValue;
        }
      }
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Default operator mapping from bracket-style (no $) to MongoDB operators (with $).
 */
export const BRACKET_TO_MONGO_OPERATOR: Record<string, string> = {
  eq: '$eq',
  ne: '$ne',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  in: '$in',
  nin: '$nin',
  like: '$regex',
  ilike: '$regex',
  exists: '$exists',
  size: '$size',
  all: '$all',
  regex: '$regex',
};

/**
 * Get the full operator mapping including custom operators
 */
function getOperatorMapping(customOperators?: Record<string, string>): Record<string, string> {
  if (!customOperators) return BRACKET_TO_MONGO_OPERATOR;
  return { ...BRACKET_TO_MONGO_OPERATOR, ...customOperators };
}

/**
 * Checks if a key is a bracket-style operator (without $).
 */
function isBracketOperatorKey(key: string, operatorMap: Record<string, string>): boolean {
  return key in operatorMap;
}

/**
 * Transforms bracket-style filter notation to MongoDB filter format.
 * This is the boundary function that converts internal bracket operators to MongoDB $ operators.
 *
 * Note: Type conversion should be done by filter.ts before calling this function.
 * This function only transforms operator names and handles MongoDB-specific concerns.
 *
 * @param parsed - Parsed filter object with bracket-style operators
 * @param options - Optional transformation options
 * @param parentKey - Parent key for nested objects (used internally for recursion)
 * @returns MongoDB-compatible filter object with $ operators
 *
 * @example
 * transformBracketToMongoFilter({ status: "published" })
 * // Returns: { status: "published" }
 *
 * @example
 * transformBracketToMongoFilter({ couponCount: { gte: 10 } })
 * // Returns: { couponCount: { $gte: 10 } }
 *
 * @example
 * transformBracketToMongoFilter({ traffic: { organic: { etv: { gt: 1000 } } } })
 * // Returns: { "traffic.organic.etv": { $gt: 1000 } }
 */
export function transformBracketToMongoFilter(
  parsed: Record<string, unknown>,
  options: MongoFilterOptions = {},
  parentKey = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const operatorMap = getOperatorMapping(options.customOperators);
  const validateRegex = options.security?.validateRegex ?? true;
  const maxRegexLength = options.security?.maxRegexLength ?? 100;

  for (const [key, value] of Object.entries(parsed)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    // Check if this is a bracket-style operator
    if (isBracketOperatorKey(key, operatorMap)) {
      const mongoOp = operatorMap[key];
      if (!mongoOp) continue;

      // Handle ilike operator (case-insensitive regex)
      if (key === 'ilike' && typeof value === 'string') {
        // Validate regex pattern if enabled
        if (validateRegex) {
          validateRegexPattern(value, maxRegexLength);
        }
        result.$regex = value;
        result.$options = 'i';
      } else if ((key === 'like' || key === 'regex') && typeof value === 'string') {
        // Validate regex pattern if enabled
        if (validateRegex) {
          validateRegexPattern(value, maxRegexLength);
        }
        result[mongoOp] = value;
      } else {
        // No type conversion here - already done by filter.ts
        result[mongoOp] = value;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if the nested object contains bracket operators
      const valueObj = value as Record<string, unknown>;
      const hasBracketOperators = Object.keys(valueObj).some((k) =>
        isBracketOperatorKey(k, operatorMap)
      );

      if (hasBracketOperators) {
        // Transform the nested operators
        const transformed = transformBracketToMongoFilter(valueObj, options);

        // If we're at a nested level, flatten the key
        if (parentKey) {
          result[fullKey] = transformed;
        } else {
          result[key] = transformed;
        }
      } else {
        // Regular nested object, continue flattening
        Object.assign(result, transformBracketToMongoFilter(valueObj, options, fullKey));
      }
    } else {
      // Regular value (no operator)
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Builds a MongoDB filter object from a database-agnostic filter.
 * Converts bracket-style operators to MongoDB operators with $ prefix.
 *
 * @param filter - Database-agnostic filter object (should be normalized by filter.ts first)
 * @param options - Optional configuration for security and custom operators
 * @returns MongoDB-compatible Filter object
 *
 * @example
 * buildMongoFilter({ status: 'published', couponCount: { gte: 10 } })
 * // Returns: { status: 'published', couponCount: { $gte: 10 } }
 *
 * @example
 * // With security validation
 * buildMongoFilter(filter, {
 *   security: {
 *     allowedFields: ['status', 'couponCount'],
 *     fieldConfig: {
 *       status: { operators: ['eq', 'in'] },
 *     },
 *   },
 * })
 */
export function buildMongoFilter<T extends { id: string }>(
  filter: Record<string, unknown>,
  options: MongoFilterOptions = {}
): Filter<WithDashId<T>> {
  const shouldValidate = options.validate ?? true;

  // Validate filter if security options are provided
  if (shouldValidate && options.security) {
    validateFilter(filter, options.security);
  }

  const flattenedFilter = flattenMongoQuery(filter);
  const mongoFilter = transformBracketToMongoFilter(flattenedFilter, options);

  // Apply field transforms
  const fieldTransforms = options.fieldTransforms ?? { id: '_id' };

  return Object.entries(mongoFilter).reduce(
    (f, [key, val]) => {
      const transformedKey = fieldTransforms[key] ?? key;
      if (transformedKey === '_id' && key === 'id') {
        f._id = val as WithDashId<T>['_id'];
      } else {
        (f as Record<string, unknown>)[transformedKey] = val;
      }
      return f;
    },
    {} as Filter<WithDashId<T>>
  );
}

/**
 * Builds a MongoDB sort object from a database-agnostic sort array.
 *
 * @param sortArray - Sort array from filter.ts
 * @returns MongoDB-compatible sort object
 *
 * @example
 * buildMongoSort([{ field: 'createdAt', direction: 'desc' }])
 * // Returns: { createdAt: -1 }
 */
export function buildMongoSort(sortArray: Sort): Record<string, 1 | -1> {
  const result: Record<string, 1 | -1> = {};
  for (const { field, direction } of sortArray) {
    const mongoField = field === 'id' ? '_id' : field;
    const mongoDirection = direction === 'desc' ? -1 : 1;
    result[mongoField] = mongoDirection;
  }
  return result;
}

/**
 * Transforms a MongoDB document (with '_id') to an application object (with 'id').
 * Throws an error if the input object doesn't have an '_id' property.
 */
export function fromMongo<T extends WithDashId<T>>(obj: T): WithId<T> {
  if (!obj._id) {
    throw new Error('Cannot transform object without _id property');
  }
  const { _id, ...rest } = obj;
  return { ...rest, id: _id } as WithId<T>;
}

/**
 * Transforms an application object (with 'id') to a MongoDB document (with '_id').
 * Throws an error if the input object doesn't have an 'id' property.
 */
export function toMongo<T extends WithId<T>>(obj: T): WithDashId<T> {
  if (obj.id === undefined) {
    throw new Error("Cannot transform object without 'id' property");
  }
  const { id, ...rest } = obj;
  return { ...rest, _id: id } as WithDashId<T>;
}

// Re-export types
export type { WithDashId, WithId };
