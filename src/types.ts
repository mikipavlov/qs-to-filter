/**
 * Pure TypeScript Filter Types
 *
 * Zero-dependency type definitions for database-agnostic filtering.
 * These types provide compile-time safety without any runtime overhead.
 */

// ============================================
// FILTER OPERATORS
// ============================================

/**
 * Supported filter operators (bracket-style, no $ prefix)
 */
export const FILTER_OPERATORS = [
  'eq', // Equal
  'ne', // Not equal
  'gt', // Greater than
  'gte', // Greater than or equal
  'lt', // Less than
  'lte', // Less than or equal
  'in', // In array
  'nin', // Not in array
  'like', // Pattern match (case-sensitive)
  'ilike', // Pattern match (case-insensitive)
  'exists', // Field exists
  'size', // Array size
  'all', // All elements in array
  'regex', // Regular expression
  'or', // Logical OR
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

// ============================================
// SORT TYPES
// ============================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort specification
 */
export type Sort = Array<{ field: string; direction: SortDirection }>;

// ============================================
// FILTER VALUE TYPES (Pure TypeScript)
// ============================================

/**
 * Base filter operators that work with any type
 */
export interface BaseFilterOperators<T> {
  /** Equal to value */
  eq?: T;
  /** Not equal to value */
  ne?: T;
  /** In array of values */
  in?: T[];
  /** Not in array of values */
  nin?: T[];
  /** Field exists (not null/undefined) */
  exists?: boolean;
}

/**
 * Comparison operators for orderable types (numbers, dates, strings)
 */
export interface ComparisonOperators<T> {
  /** Greater than */
  gt?: T;
  /** Greater than or equal */
  gte?: T;
  /** Less than */
  lt?: T;
  /** Less than or equal */
  lte?: T;
}

/**
 * String-specific operators
 */
export interface StringOperators {
  /** Pattern match (case-sensitive) */
  like?: string;
  /** Pattern match (case-insensitive) */
  ilike?: string;
  /** Regular expression match */
  regex?: string;
}

/**
 * Array-specific operators
 */
export interface ArrayOperators<T> {
  /** Array size equals */
  size?: number;
  /** Array contains all values */
  all?: T[];
}

/**
 * Logical operators for combining filters
 */
export interface LogicalOperators<T> {
  /** OR condition - matches if any filter matches */
  or?: Array<T | FilterOperators<T>>;
}

/**
 * Complete filter operators for a value type
 */
export type FilterOperators<T> = BaseFilterOperators<T> &
  ComparisonOperators<T> &
  StringOperators &
  ArrayOperators<T extends (infer U)[] ? U : T> &
  LogicalOperators<T>;

/**
 * Filter value - either a direct value or an object with operators
 *
 * @example
 * // Direct value (shorthand for { eq: value })
 * const filter1: FilterValue<string> = 'published';
 *
 * // With operators
 * const filter2: FilterValue<number> = { gte: 10, lte: 100 };
 *
 * // Array operator
 * const filter3: FilterValue<string> = { in: ['draft', 'published'] };
 */
export type FilterValue<T> = T | Partial<FilterOperators<T>>;

/**
 * Filter object for a model - maps each field to a FilterValue
 *
 * @example
 * interface User { id: string; age: number; status: string; }
 * type UserFilter = FilterObject<User>;
 * // { id?: FilterValue<string>; age?: FilterValue<number>; status?: FilterValue<string>; }
 */
export type FilterObject<T> = {
  [K in keyof T]?: FilterValue<T[K]>;
};

// ============================================
// TYPE-SPECIFIC FILTER VALUES
// ============================================

/**
 * String filter with all applicable operators
 */
export type StringFilterValue =
  | string
  | Partial<BaseFilterOperators<string> & ComparisonOperators<string> & StringOperators>;

/**
 * Number filter with all applicable operators
 */
export type NumberFilterValue =
  | number
  | Partial<BaseFilterOperators<number> & ComparisonOperators<number>>;

/**
 * Boolean filter (limited operators)
 */
export type BooleanFilterValue =
  | boolean
  | Partial<Pick<BaseFilterOperators<boolean>, 'eq' | 'ne' | 'exists'>>;

/**
 * Date filter with comparison operators
 */
export type DateFilterValue = Date | Partial<BaseFilterOperators<Date> & ComparisonOperators<Date>>;

/**
 * Array filter with array-specific operators
 */
export type ArrayFilterValue<T> =
  | T[]
  | Partial<Pick<BaseFilterOperators<T[]>, 'eq' | 'ne' | 'exists'> & ArrayOperators<T>>;

// ============================================
// ADVANCED FILTER TYPES (Prisma-style)
// ============================================

/**
 * Where input with AND/OR/NOT logical operators
 *
 * @example
 * const filter: WhereInput<User> = {
 *   status: { eq: 'active' },
 *   OR: [
 *     { age: { gte: 18 } },
 *     { role: { eq: 'admin' } }
 *   ]
 * };
 */
export type WhereInput<T> = FilterObject<T> & {
  AND?: WhereInput<T> | WhereInput<T>[];
  OR?: WhereInput<T>[];
  NOT?: WhereInput<T> | WhereInput<T>[];
};

// ============================================
// MONGODB-SPECIFIC TYPES
// ============================================

/**
 * Type utility that changes the 'id' field to '_id' in a type.
 * Used for MongoDB documents which use '_id' instead of 'id'.
 */
export type WithDashId<T> = Omit<T, 'id'> & { _id: string };

/**
 * Type utility that changes the '_id' field to 'id' in a type.
 * Used for application-side objects which typically use 'id'.
 */
export type WithId<T> = Omit<T, '_id'> & { id: string };

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Configuration options for query string parsing
 */
export interface ParseOptions {
  /** Maximum nesting depth (default: 5) */
  depth?: number;
  /** Maximum number of parameters (default: 1000) */
  parameterLimit?: number;
  /** Maximum array size (default: 100) */
  arrayLimit?: number;
}

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Extract keys of a specific type from an object
 *
 * @example
 * interface User { id: string; age: number; name: string; }
 * type StringKeys = KeysOfType<User, string>; // 'id' | 'name'
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Deep partial - makes all nested properties optional
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
