/**
 * HTTP Query String Layer
 *
 * This module handles parsing and building URL query strings.
 * It converts between HTTP query strings and the database-agnostic filter DSL.
 *
 * Responsibilities:
 * - Parse URL query strings into filter objects
 * - Build URL query strings from filter objects
 * - Security: DoS protection via limits
 * - Sort string handling
 */

import qs from 'qs';
import {
  buildSortString,
  limitFilterArraySizes,
  normalizeFilter,
  parseSortString,
  type Sort,
} from './filter.js';
import type { ParseOptions } from './types.js';

/**
 * Default configuration for query string parsing.
 * - comma: true - Parse comma-separated values as arrays
 * - ignoreQueryPrefix: true - Handle leading ?
 * - plainObjects: true - Security: prevent prototype pollution
 * - depth: 5 - Reasonable nesting limit
 * - parameterLimit: 1000 - Security: prevent DoS
 * - arrayLimit: 100 - Security: prevent DoS via extremely large arrays
 */
const DEFAULT_OPTIONS: ParseOptions = {
  depth: 5,
  parameterLimit: 1000,
  arrayLimit: 100,
};

/**
 * Parses a URL query string into a filter object with proper type conversion.
 *
 * @param str - The query string to parse (with or without leading ?)
 * @param options - Optional configuration for parsing limits
 * @returns An object with filter fields and optionally a sort array
 *
 * @example
 * parseQueryString('status=published&couponCount[gte]=10&sort=createdAt:desc')
 * // Returns: { status: 'published', couponCount: { gte: 10 }, sort: [{ field: 'createdAt', direction: 'desc' }] }
 */
export function parseQueryString(
  str: string,
  options: ParseOptions = {}
): { [key: string]: unknown } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const qsOptions: qs.IParseOptions = {
    comma: true,
    ignoreQueryPrefix: true,
    plainObjects: true,
    depth: opts.depth,
    parameterLimit: opts.parameterLimit,
    arrayLimit: opts.arrayLimit,
  };

  const parsed = qs.parse(str, qsOptions) as Record<string, unknown>;

  let sort: Sort = [];

  // Extract and parse sort parameter
  if (parsed.sort && typeof parsed.sort === 'string') {
    sort = parseSortString(parsed.sort);
  }

  const { sort: _sort, ...rest } = parsed;

  // Apply security limits to prevent DoS attacks
  const limited = limitFilterArraySizes(rest, opts.arrayLimit ?? 100);

  // Apply type conversion to bracket-style operators
  const normalized = normalizeFilter(limited);

  return sort.length ? { ...normalized, sort } : normalized;
}

/**
 * Builds a URLSearchParams object from filter and options.
 *
 * @param filter - The filter object
 * @param opts - Additional options (e.g., limit, skip, sort)
 * @returns URLSearchParams that can be used in fetch() or converted to string
 *
 * @example
 * buildSearchParams({ status: { in: ['published', 'draft'] } }, { limit: 50, sort: [...] })
 * // Returns URLSearchParams with: status[in]=published,draft&limit=50&sort=...
 */
export function buildSearchParams<
  TFilter extends Record<string, unknown> = Record<string, unknown>,
  TOpts extends Record<string, unknown> = Record<string, unknown>,
>(filter: TFilter = {} as TFilter, opts: TOpts = {} as TOpts): URLSearchParams {
  // Merge filter and opts at the top level
  const queryObj: Record<string, unknown> = { ...filter, ...opts };

  // Serialize the entire object with qs using bracket notation
  const queryString = qs.stringify(queryObj, {
    arrayFormat: 'comma',
    encode: true,
    serializeDate: (date: Date) => date.toISOString(),
    filter: (prefix, value) => {
      // Convert sort array to string format
      if (prefix === 'sort' && Array.isArray(value)) {
        return buildSortString(value);
      }
      // Convert null to string "null" for operator fields (e.g., lostAt[eq]=null)
      // This allows filtering for null values in the database
      if (value === null && /\[(:?eq|ne|gt|gte|lt|lte|in|nin|exists|all)\]$/.test(prefix)) {
        return 'null';
      }
      // Skip null values for non-operator fields
      if (value === null) {
        return undefined;
      }
      return value;
    },
  });

  return new URLSearchParams(queryString);
}
