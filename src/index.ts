/**
 * qs-to-filter
 *
 * Type-safe query string to database filter conversion with security built-in.
 *
 * @example
 * // Core usage - parse HTTP query strings to filter objects
 * import { parseQueryString, buildSearchParams } from 'qs-to-filter';
 *
 * const filter = parseQueryString('status=published&price[gte]=10&sort=createdAt:desc');
 * // { status: 'published', price: { gte: 10 }, sort: [{ field: 'createdAt', direction: 'desc' }] }
 *
 * const params = buildSearchParams({ status: { in: ['published', 'draft'] } });
 * // status[in]=published,draft
 *
 * @example
 * // With security validation
 * import { validateFilter } from 'qs-to-filter';
 *
 * validateFilter(filter, {
 *   allowedFields: ['status', 'price', 'name'],
 *   blockedFields: ['password', 'secret'],
 *   fieldConfig: {
 *     status: { operators: ['eq', 'in'] },
 *     price: { operators: ['eq', 'gte', 'lte'] },
 *   },
 * });
 *
 * @example
 * // With MongoDB adapter
 * import { buildMongoFilter, buildMongoSort } from 'qs-to-filter/mongo';
 *
 * const mongoFilter = buildMongoFilter(filter);
 * // { status: 'published', price: { $gte: 10 } }
 *
 * @example
 * // With schema validation (Zod adapter)
 * import { FilterValue, buildFilterSchema } from 'qs-to-filter/adapters/zod';
 * import { z } from 'zod';
 *
 * const priceFilter = FilterValue(z.number());
 * priceFilter.parse({ gte: 10, lte: 100 }); // Validated!
 *
 * @example
 * // With schema validation (Valibot adapter - lightweight)
 * import { FilterValue } from 'qs-to-filter/adapters/valibot';
 * import * as v from 'valibot';
 *
 * const priceFilter = FilterValue(v.number());
 * v.parse(priceFilter, { gte: 10 }); // Validated!
 *
 * @example
 * // With schema validation (TypeBox adapter - JSON Schema)
 * import { FilterValue } from 'qs-to-filter/adapters/typebox';
 * import { Type } from '@sinclair/typebox';
 * import { Value } from '@sinclair/typebox/value';
 *
 * const priceFilter = FilterValue(Type.Number());
 * Value.Check(priceFilter, { gte: 10 }); // true
 *
 * @example
 * // Register custom operators
 * import { operatorRegistry } from 'qs-to-filter';
 *
 * operatorRegistry.register({
 *   name: 'between',
 *   description: 'Value between range [min, max]',
 *   category: 'comparison',
 *   valueTypes: ['array'],
 *   validate: (v) => Array.isArray(v) && v.length === 2 ? true : 'between requires [min, max] array',
 * });
 */

// Adapter interfaces
export {
  type AdapterFilterType,
  type AdapterSortType,
  BaseDatabaseAdapter,
  type DatabaseAdapter,
  type DatabaseAdapterOptions,
  type FilterResult,
  type SchemaAdapter,
  type SortArray,
  type SortItem,
} from './adapters/interface.js';
// Error classes
export {
  DangerousRegexError,
  FieldAccessError,
  FilterParseError,
  OperatorNotAllowedError,
  QsToFilterError,
  SecurityError,
  ValueLimitError,
} from './errors.js';
// Core filter DSL
export {
  buildSortString,
  convertFilterValue,
  FILTER_OPERATORS,
  type FilterOperator,
  hasFilterOperators,
  isFilterOperator,
  limitFilterArraySizes,
  normalizeFilter,
  parseSortString,
  type Sort,
  type SortDirection,
} from './filter.js';
// Operator registry
export {
  getOperatorNames,
  isOperator,
  OPERATOR_DEFINITIONS,
  type OperatorCategory,
  type OperatorDefinition,
  operatorRegistry,
} from './operators.js';
// HTTP Query String layer
export { buildSearchParams, parseQueryString } from './query.js';
// Security utilities
export {
  DEFAULT_BLOCKED_FIELDS,
  DEFAULT_SECURITY_OPTIONS,
  type FieldConfig,
  type SecurityOptions,
  validateArrayValue,
  validateFieldAccess,
  validateFilter,
  validateOperator,
  validateRegexPattern,
  validateStringValue,
} from './security.js';

// Pure TypeScript types (zero runtime)
export type {
  ArrayFilterValue,
  ArrayOperators,
  BaseFilterOperators,
  BooleanFilterValue,
  ComparisonOperators,
  DateFilterValue,
  DeepPartial,
  FilterObject,
  FilterOperators,
  FilterValue,
  KeysOfType,
  LogicalOperators,
  NumberFilterValue,
  ParseOptions,
  RequireKeys,
  StringFilterValue,
  StringOperators,
  WhereInput,
  WithDashId,
  WithId,
} from './types.js';
