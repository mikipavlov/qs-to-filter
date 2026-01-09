/**
 * Custom Error Classes for qs-to-filter
 *
 * Provides typed error classes for better error handling by consumers.
 */

/**
 * Base error class for all qs-to-filter errors
 */
export class QsToFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QsToFilterError';
  }
}

/**
 * Error thrown when parsing a filter fails
 */
export class FilterParseError extends QsToFilterError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'FilterParseError';
  }
}

/**
 * Error thrown when a security violation is detected
 */
export class SecurityError extends QsToFilterError {
  constructor(
    message: string,
    public readonly type: 'regex' | 'field' | 'operator' | 'value'
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Error thrown when accessing a blocked or non-allowed field
 */
export class FieldAccessError extends SecurityError {
  constructor(
    public readonly fieldName: string,
    public readonly reason: 'blocked' | 'not_allowed'
  ) {
    super(
      reason === 'blocked'
        ? `Field "${fieldName}" is blocked and cannot be queried`
        : `Field "${fieldName}" is not in the allowed fields list`,
      'field'
    );
    this.name = 'FieldAccessError';
  }
}

/**
 * Error thrown when an operator is not allowed for a field
 */
export class OperatorNotAllowedError extends SecurityError {
  constructor(
    public readonly fieldName: string,
    public readonly operator: string,
    public readonly allowedOperators?: readonly string[]
  ) {
    const allowedMsg = allowedOperators ? `. Allowed: ${allowedOperators.join(', ')}` : '';
    super(
      `Operator "${operator}" is not allowed for field "${fieldName}"${allowedMsg}`,
      'operator'
    );
    this.name = 'OperatorNotAllowedError';
  }
}

/**
 * Error thrown when a regex pattern is potentially dangerous
 */
export class DangerousRegexError extends SecurityError {
  constructor(
    public readonly pattern: string,
    public readonly reason: string
  ) {
    super(`Dangerous regex pattern detected: ${reason}`, 'regex');
    this.name = 'DangerousRegexError';
  }
}

/**
 * Error thrown when a value exceeds security limits
 */
export class ValueLimitError extends SecurityError {
  constructor(
    public readonly fieldName: string,
    public readonly limit: number,
    public readonly actual: number,
    public readonly limitType: 'length' | 'size' | 'depth'
  ) {
    super(`Value for "${fieldName}" exceeds ${limitType} limit (${actual} > ${limit})`, 'value');
    this.name = 'ValueLimitError';
  }
}
