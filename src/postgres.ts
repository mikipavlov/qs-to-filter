/**
 * PostgreSQL Adapter Layer
 *
 * This module transforms database-agnostic filter DSL into PostgreSQL-specific queries.
 *
 * Responsibilities:
 * - Transform bracket-style operators to PostgreSQL SQL operators
 * - Generate parameterized queries (prevents SQL injection)
 * - Handle JSONB field access with ->> operators
 * - Support table/alias prefix for columns
 * - Build PostgreSQL WHERE and ORDER BY clauses
 * - Apply security validation (field access, regex safety)
 */

import type { DatabaseAdapterOptions } from './adapters/interface.js';
import type { Sort } from './filter.js';
import type { SecurityOptions } from './security.js';
import { validateFilter } from './security.js';

/**
 * Options for PostgreSQL filter building
 */
export interface PostgresFilterOptions extends DatabaseAdapterOptions {
  /**
   * Security options for validating the filter
   */
  security?: SecurityOptions;

  /**
   * Whether to validate the filter before building.
   * Default: true
   */
  validate?: boolean;

  /**
   * Table/alias prefix to add to all column names.
   * Example: 'users' will output 'users.status = $1'
   */
  tablePrefix?: string;
}

/**
 * Operator mapping from bracket-style (no $) to PostgreSQL SQL operators
 */
export const BRACKET_TO_POSTGRES_OPERATOR: Record<string, string> = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'IN',
  nin: 'NOT IN',
  like: 'LIKE',
  ilike: 'ILIKE',
  exists: 'IS NOT NULL',
  regex: '~',
};

/**
 * Get the full operator mapping including custom operators
 */
function getOperatorMapping(customOperators?: Record<string, string>): Record<string, string> {
  if (!customOperators) return BRACKET_TO_POSTGRES_OPERATOR;
  return { ...BRACKET_TO_POSTGRES_OPERATOR, ...customOperators };
}

/**
 * Checks if a key is a bracket-style operator (without $)
 */
function isBracketOperatorKey(key: string, operatorMap: Record<string, string>): boolean {
  return key in operatorMap;
}

/**
 * Build context for tracking parameters during SQL generation
 */
interface BuildContext {
  params: unknown[];
  paramIndex: number;
  options: PostgresFilterOptions;
  operatorMap: Record<string, string>;
}

/**
 * Creates a new parameter placeholder
 */
function addParam(ctx: BuildContext, value: unknown): string {
  ctx.params.push(value);
  return `$${ctx.paramIndex++}`;
}

/**
 * Applies table prefix and quoting to a field name
 */
function formatFieldName(field: string, ctx: BuildContext): string {
  let formatted = field;

  // Apply table prefix if specified
  if (ctx.options.tablePrefix) {
    // Check if field already contains JSONB operators
    if (formatted.includes('->>')) {
      // For JSONB, prefix only the root field
      const jsonbParts = formatted.split('->>');
      formatted = `${ctx.options.tablePrefix}."${jsonbParts[0]}"->>${jsonbParts.slice(1).join('->>')}`;
    } else if (formatted.includes('.')) {
      // For nested dot notation, prefix the root and quote each part
      const parts = formatted.split('.');
      formatted = `${ctx.options.tablePrefix}.${parts.map((p) => `"${p}"`).join('.')}`;
    } else {
      // Simple field - quote it
      formatted = `${ctx.options.tablePrefix}."${formatted}"`;
    }
  } else {
    // No table prefix - just quote the field
    if (formatted.includes('->>')) {
      // JSONB field - quote the root only
      const jsonbParts = formatted.split('->>');
      formatted = `"${jsonbParts[0]}"->>${jsonbParts.slice(1).join('->>')}`;
    } else if (formatted.includes('.')) {
      // Nested dot notation - quote each part
      const parts = formatted.split('.');
      formatted = parts.map((p) => `"${p}"`).join('.');
    } else {
      // Simple field
      formatted = `"${formatted}"`;
    }
  }

  return formatted;
}

/**
 * Processes JSONB field access (preserves ->> operators)
 * Converts { "data->>settings->>theme": ... } to proper SQL
 * Escapes single quotes in JSONB keys for safety
 */
function formatJsonbField(field: string): string {
  // Replace ->> with proper PostgreSQL JSONB path syntax
  // The parser uses ->> as a separator, we need to convert it to ->>
  // with proper quoting: data->>'settings'->>'theme'
  if (!field.includes('->>')) return field;

  const parts = field.split('->>');
  const root = parts[0];
  const pathParts = parts.slice(1).map((p) => {
    // Escape single quotes by doubling them (PostgreSQL standard)
    const escaped = p.replace(/'/g, "''");
    return `'${escaped}'`;
  });

  return `${root}->>${pathParts.join('->>')}`;
}

/**
 * Handles a single operator-value pair for a field
 * Returns just the SQL string; params are accumulated in context
 */
function processOperator(
  field: string,
  operator: string,
  value: unknown,
  ctx: BuildContext
): string | null {
  const pgOp = ctx.operatorMap[operator];
  if (!pgOp) return null;

  const formattedField = formatJsonbField(formatFieldName(field, ctx));

  // Handle exists operator (special case)
  if (operator === 'exists') {
    const exists = value === true;
    return `${formattedField} IS ${exists ? 'NOT NULL' : 'NULL'}`;
  }

  // Handle IN/NOT IN with arrays
  if (operator === 'in' || operator === 'nin') {
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0) {
      // Empty IN array - return false condition
      return '1 = 0';
    }
    const placeholders = values.map((v) => addParam(ctx, v)).join(', ');
    return `${formattedField} ${pgOp} (${placeholders})`;
  }

  // Handle all other operators
  const param = addParam(ctx, value);
  return `${formattedField} ${pgOp} ${param}`;
}

/**
 * Handles logical operators (and, or, not)
 * Returns just the SQL string; params are accumulated in context
 */
function handleLogicalOperator(
  operator: 'and' | 'or' | 'not',
  value: unknown,
  ctx: BuildContext
): string {
  if (operator === 'not') {
    const result = buildPostgresWhere(value as Record<string, unknown>, ctx);
    return `NOT (${result})`;
  }

  // and/or - value should be an array of filter objects
  const conditions = value as Record<string, unknown>[];
  const results = conditions.map((c) => buildPostgresWhere(c, ctx));
  const joinOp = operator === 'and' ? ' AND ' : ' OR ';

  return `(${results.join(joinOp)})`;
}

/**
 * Recursively builds a WHERE clause from a filter object
 * Returns just the SQL string; params are accumulated in context
 */
export function buildPostgresWhere(
  filter: Record<string, unknown>,
  ctx: BuildContext
): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filter)) {
    // Check if this is a logical operator
    if (key === 'and' || key === 'or' || key === 'not') {
      conditions.push(handleLogicalOperator(key, value, ctx));
      continue;
    }

    // Check if this is a bracket-style operator
    if (isBracketOperatorKey(key, ctx.operatorMap)) {
      // Operator at top level (unusual, but handle it)
      const sql = processOperator('', key, value, ctx);
      if (sql) conditions.push(sql);
      continue;
    }

    // This is a field - check if value contains operators
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const valueObj = value as Record<string, unknown>;
      const operatorKeys = Object.keys(valueObj).filter((k) => isBracketOperatorKey(k, ctx.operatorMap));

      if (operatorKeys.length > 0) {
        // Field has operators - process each operator
        for (const opKey of operatorKeys) {
          const sql = processOperator(key, opKey, valueObj[opKey], ctx);
          if (sql) conditions.push(sql);
        }
      } else {
        // No operators - treat as equality
        const sql = processOperator(key, 'eq', value, ctx);
        if (sql) conditions.push(sql);
      }
    } else {
      // Direct value - treat as equality
      const sql = processOperator(key, 'eq', value, ctx);
      if (sql) conditions.push(sql);
    }
  }

  return conditions.join(' AND ');
}

/**
 * Transforms a bracket-style filter to a PostgreSQL WHERE clause
 *
 * @param filter - Database-agnostic filter object
 * @param options - Optional configuration
 * @returns Object with SQL string and parameters array
 *
 * @example
 * transformBracketToPostgresFilter({ status: 'published', count: { gte: 10 } })
 * // Returns: { sql: 'status = $1 AND count >= $2', params: ['published', 10] }
 */
export function transformBracketToPostgresFilter(
  filter: Record<string, unknown>,
  options: PostgresFilterOptions = {}
): { sql: string; params: unknown[] } {
  const ctx: BuildContext = {
    params: [],
    paramIndex: 1,
    options,
    operatorMap: getOperatorMapping(options.customOperators),
  };

  const sql = buildPostgresWhere(filter, ctx);

  return {
    sql,
    params: ctx.params,
  };
}

/**
 * Builds a PostgreSQL filter (WHERE clause) from a database-agnostic filter
 *
 * @param filter - Database-agnostic filter object
 * @param options - Optional configuration for security and custom operators
 * @returns Object with SQL WHERE clause and parameters array
 *
 * @example
 * buildPostgresFilter({ status: 'published', count: { gte: 10 } })
 * // Returns: { sql: 'status = $1 AND count >= $2', params: ['published', 10] }
 *
 * @example
 * // With security validation
 * buildPostgresFilter(filter, {
 *   security: {
 *     allowedFields: ['status', 'count'],
 *     fieldConfig: {
 *       status: { operators: ['eq', 'in'] },
 *     },
 *   },
 * })
 */
export function buildPostgresFilter(
  filter: Record<string, unknown>,
  options: PostgresFilterOptions = {}
): { sql: string; params: unknown[] } {
  const shouldValidate = options.validate ?? true;

  // Validate filter if security options are provided
  if (shouldValidate && options.security) {
    validateFilter(filter, options.security);
  }

  return transformBracketToPostgresFilter(filter, options);
}

/**
 * Builds a PostgreSQL ORDER BY clause from a sort array
 *
 * @param sortArray - Sort array from filter.ts
 * @param options - Optional configuration
 * @returns PostgreSQL ORDER BY SQL string
 *
 * @example
 * buildPostgresSort([{ field: 'createdAt', direction: 'desc' }])
 * // Returns: 'ORDER BY "createdAt" DESC'
 *
 * @example
 * // With table prefix
 * buildPostgresSort([{ field: 'createdAt', direction: 'desc' }], { tablePrefix: 'users' })
 * // Returns: 'ORDER BY users."createdAt" DESC'
 */
export function buildPostgresSort(
  sortArray: Sort,
  options: PostgresFilterOptions = {}
): string {
  if (sortArray.length === 0) return '';

  const parts = sortArray.map(({ field, direction }) => {
    // Check for JSONB field
    const isJsonb = field.includes('->>');
    const formattedField = isJsonb ? formatJsonbField(field) : `"${field}"`;

    const withPrefix = options.tablePrefix
      ? `${options.tablePrefix}.${formattedField}`
      : formattedField;

    return `${withPrefix} ${direction.toUpperCase()}`;
  });

  return `ORDER BY ${parts.join(', ')}`;
}
