/**
 * Security utilities for qs-to-filter
 *
 * Provides protection against common attack vectors:
 * - ReDoS (Regular Expression Denial of Service)
 * - Field injection
 * - Operator injection
 * - Value overflow
 */

import {
  DangerousRegexError,
  FieldAccessError,
  OperatorNotAllowedError,
  ValueLimitError,
} from './errors.js';
import type { FilterOperator } from './types.js';

/**
 * Configuration for field-level security
 */
export interface FieldConfig {
  /** Allowed operators for this field (if undefined, all operators allowed) */
  operators?: readonly FilterOperator[];
  /** Maximum string length for values */
  maxLength?: number;
  /** Maximum array size for in/nin/all operators */
  maxArraySize?: number;
  /** Whether regex operators are allowed for this field */
  allowRegex?: boolean;
}

/**
 * Security options for filter operations
 */
export interface SecurityOptions {
  /**
   * List of fields that are allowed to be queried.
   * If specified, only these fields can be used in filters.
   */
  allowedFields?: string[];

  /**
   * List of fields that are blocked from querying.
   * Default: ['password', 'hash', 'secret', 'token', '__v']
   */
  blockedFields?: string[];

  /**
   * Per-field configuration for operators and limits
   */
  fieldConfig?: Record<string, FieldConfig>;

  /**
   * Maximum length for string values. Default: 1000
   */
  maxStringLength?: number;

  /**
   * Maximum length for regex patterns. Default: 100
   */
  maxRegexLength?: number;

  /**
   * Whether to allow regex operators at all. Default: true
   */
  allowRegex?: boolean;

  /**
   * Whether to validate regex patterns for ReDoS. Default: true
   */
  validateRegex?: boolean;
}

/**
 * Default blocked fields that should never be queried
 */
export const DEFAULT_BLOCKED_FIELDS = [
  'password',
  'passwordHash',
  'hash',
  'secret',
  'secretKey',
  'apiKey',
  'token',
  'refreshToken',
  'accessToken',
  '__v',
  '__proto__',
  'constructor',
  'prototype',
];

/**
 * Default security options
 */
export const DEFAULT_SECURITY_OPTIONS: Required<
  Pick<
    SecurityOptions,
    'blockedFields' | 'maxStringLength' | 'maxRegexLength' | 'allowRegex' | 'validateRegex'
  >
> = {
  blockedFields: DEFAULT_BLOCKED_FIELDS,
  maxStringLength: 1000,
  maxRegexLength: 100,
  allowRegex: true,
  validateRegex: true,
};

/**
 * Patterns that indicate potentially dangerous regex constructs
 */
const DANGEROUS_REGEX_PATTERNS = [
  // Nested quantifiers - classic ReDoS pattern
  { pattern: /\([^)]*[+*]\)[+*]/, reason: 'nested quantifiers (e.g., (a+)+)' },
  { pattern: /\([^)]*\)\{\d+,\}/, reason: 'nested unbounded quantifiers' },

  // Overlapping alternations
  { pattern: /\([^|)]*\|[^|)]*\)\+/, reason: 'overlapping alternation with quantifier' },

  // Backreferences with quantifiers
  { pattern: /\\[1-9][+*]/, reason: 'backreference with quantifier' },

  // Very long bounded quantifiers
  { pattern: /\{\d{3,},/, reason: 'extremely large quantifier bound' },

  // Multiple wildcards
  { pattern: /\.\*\.\*\.\*/, reason: 'multiple consecutive wildcards' },
];

/**
 * Validates a regex pattern for potential ReDoS vulnerabilities.
 *
 * @param pattern - The regex pattern to validate
 * @param maxLength - Maximum allowed pattern length
 * @throws {DangerousRegexError} If the pattern is potentially dangerous
 */
export function validateRegexPattern(pattern: string, maxLength: number = 100): void {
  // Check length
  if (pattern.length > maxLength) {
    throw new DangerousRegexError(pattern, `pattern exceeds maximum length of ${maxLength}`);
  }

  // Check for dangerous patterns
  for (const { pattern: dangerous, reason } of DANGEROUS_REGEX_PATTERNS) {
    if (dangerous.test(pattern)) {
      throw new DangerousRegexError(pattern, reason);
    }
  }

  // Try to compile the regex to catch syntax errors
  try {
    new RegExp(pattern);
  } catch {
    throw new DangerousRegexError(pattern, 'invalid regex syntax');
  }
}

/**
 * Validates that a field is allowed to be queried.
 *
 * @param field - The field name to validate
 * @param options - Security options
 * @throws {FieldAccessError} If the field is not allowed
 */
export function validateFieldAccess(field: string, options: SecurityOptions = {}): void {
  const blockedFields = options.blockedFields ?? DEFAULT_SECURITY_OPTIONS.blockedFields;
  const allowedFields = options.allowedFields;

  // Extract base field (before any dots for nested fields)
  const baseField = field.split('.')[0];

  // Check blocked fields
  if (blockedFields.some((blocked) => baseField === blocked || field.startsWith(`${blocked}.`))) {
    throw new FieldAccessError(field, 'blocked');
  }

  // Check allowed fields (if specified)
  if (allowedFields && allowedFields.length > 0) {
    const isAllowed = allowedFields.some(
      (allowed) => baseField === allowed || field.startsWith(`${allowed}.`)
    );
    if (!isAllowed) {
      throw new FieldAccessError(field, 'not_allowed');
    }
  }
}

/**
 * Validates that an operator is allowed for a field.
 *
 * @param field - The field name
 * @param operator - The operator being used
 * @param options - Security options
 * @throws {OperatorNotAllowedError} If the operator is not allowed
 */
export function validateOperator(
  field: string,
  operator: string,
  options: SecurityOptions = {}
): void {
  const fieldConfig = options.fieldConfig?.[field];

  // Check if regex operators are allowed
  if (operator === 'regex' || operator === 'like' || operator === 'ilike') {
    const allowRegex =
      fieldConfig?.allowRegex ?? options.allowRegex ?? DEFAULT_SECURITY_OPTIONS.allowRegex;
    if (!allowRegex) {
      throw new OperatorNotAllowedError(field, operator, fieldConfig?.operators);
    }
  }

  // Check field-specific operator restrictions
  if (fieldConfig?.operators && !fieldConfig.operators.includes(operator as FilterOperator)) {
    throw new OperatorNotAllowedError(field, operator, fieldConfig.operators);
  }
}

/**
 * Validates a string value against length limits.
 *
 * @param field - The field name
 * @param value - The string value
 * @param options - Security options
 * @throws {ValueLimitError} If the value exceeds limits
 */
export function validateStringValue(
  field: string,
  value: string,
  options: SecurityOptions = {}
): void {
  const fieldConfig = options.fieldConfig?.[field];
  const maxLength =
    fieldConfig?.maxLength ?? options.maxStringLength ?? DEFAULT_SECURITY_OPTIONS.maxStringLength;

  if (value.length > maxLength) {
    throw new ValueLimitError(field, maxLength, value.length, 'length');
  }
}

/**
 * Validates an array value against size limits.
 *
 * @param field - The field name
 * @param value - The array value
 * @param options - Security options
 * @throws {ValueLimitError} If the array exceeds size limits
 */
export function validateArrayValue(
  field: string,
  value: unknown[],
  options: SecurityOptions = {}
): void {
  const fieldConfig = options.fieldConfig?.[field];
  const maxSize = fieldConfig?.maxArraySize ?? 100;

  if (value.length > maxSize) {
    throw new ValueLimitError(field, maxSize, value.length, 'size');
  }
}

/**
 * Comprehensive filter validation with all security checks.
 *
 * @param filter - The filter object to validate
 * @param options - Security options
 * @throws Various security errors if validation fails
 */
export function validateFilter(
  filter: Record<string, unknown>,
  options: SecurityOptions = {}
): void {
  const validateRegex = options.validateRegex ?? DEFAULT_SECURITY_OPTIONS.validateRegex;
  const maxRegexLength = options.maxRegexLength ?? DEFAULT_SECURITY_OPTIONS.maxRegexLength;

  function validateValue(field: string, value: unknown, inOperator?: string): void {
    if (typeof value === 'string') {
      validateStringValue(field, value, options);

      // Validate regex patterns
      if (
        inOperator &&
        (inOperator === 'regex' || inOperator === 'like' || inOperator === 'ilike')
      ) {
        if (validateRegex) {
          validateRegexPattern(value, maxRegexLength);
        }
      }
    } else if (Array.isArray(value)) {
      validateArrayValue(field, value, options);
      // Validate each element
      for (const item of value) {
        if (typeof item === 'string') {
          validateStringValue(field, item, options);
        }
      }
    }
  }

  function traverse(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Check if this is an operator
      const isOperator = [
        'eq',
        'ne',
        'gt',
        'gte',
        'lt',
        'lte',
        'in',
        'nin',
        'like',
        'ilike',
        'exists',
        'size',
        'all',
        'regex',
        'or',
      ].includes(key);

      if (isOperator && prefix) {
        // Validate operator usage
        validateOperator(prefix, key, options);
        validateValue(prefix, value, key);
      } else if (!isOperator) {
        // This is a field
        validateFieldAccess(fullKey, options);

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value as Record<string, unknown>, fullKey);
        } else {
          validateValue(fullKey, value);
        }
      }
    }
  }

  traverse(filter);
}
