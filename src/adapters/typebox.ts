/**
 * TypeBox Schema Adapter for Filter Validation
 *
 * Provides TypeBox schema builders for validating filter objects.
 * This adapter creates TypeBox schemas that match the pure TypeScript
 * filter types defined in the core module.
 *
 * TypeBox is a JSON Schema type builder with static type inference.
 * It produces standard JSON Schema that can be used with any JSON Schema
 * validator (e.g., Ajv).
 *
 * @example
 * import { FilterValue, buildSortSchema } from 'qs-to-filter/adapters/typebox';
 * import { Type } from '@sinclair/typebox';
 * import { Value } from '@sinclair/typebox/value';
 *
 * const priceFilter = FilterValue(Type.Number());
 * Value.Check(priceFilter, { gte: 10, lte: 100 }); // true
 *
 * const sortSchema = buildSortSchema(['createdAt', 'name']);
 * Value.Check(sortSchema, [{ field: 'createdAt', direction: 'desc' }]); // true
 */

import { type TSchema, Type } from '@sinclair/typebox';

/**
 * Creates a TypeBox schema for a filter value that supports bracket-style operators.
 *
 * The schema accepts either a direct value or an object with filter operators.
 *
 * @param value - The TypeBox schema for the base value type
 * @returns A union schema that accepts either a direct value or an object with operators
 *
 * @example
 * const priceFilter = FilterValue(Type.Number());
 * Value.Check(priceFilter, 100);                    // true: direct value
 * Value.Check(priceFilter, { gte: 50, lte: 200 }); // true: operator object
 */
export const FilterValue = <T extends TSchema>(value: T) => {
  const operatorSchema = Type.Object(
    {
      // Base operators
      eq: Type.Optional(value),
      ne: Type.Optional(value),
      in: Type.Optional(Type.Array(value)),
      nin: Type.Optional(Type.Array(value)),
      exists: Type.Optional(Type.Boolean()),

      // Comparison operators
      gt: Type.Optional(value),
      gte: Type.Optional(value),
      lt: Type.Optional(value),
      lte: Type.Optional(value),

      // String operators
      like: Type.Optional(Type.String()),
      ilike: Type.Optional(Type.String()),
      regex: Type.Optional(Type.String()),

      // Array operators
      size: Type.Optional(Type.Integer({ minimum: 0 })),
      all: Type.Optional(Type.Array(value)),

      // Logical operators - simplified
      or: Type.Optional(Type.Array(value)),
    },
    { additionalProperties: false }
  );

  return Type.Union([value, operatorSchema]);
};

/**
 * Sort direction schema
 */
export const Direction = Type.Union([Type.Literal('asc'), Type.Literal('desc')]);

/**
 * Creates a TypeBox schema for sort specification with allowed fields.
 *
 * @param allowedFields - Array of field names that can be sorted
 * @returns A TypeBox schema for validating sort arrays
 *
 * @example
 * const sortSchema = buildSortSchema(['createdAt', 'updatedAt', 'name']);
 * Value.Check(sortSchema, [{ field: 'createdAt', direction: 'desc' }]); // true
 */
export function buildSortSchema<T extends string>(allowedFields: readonly T[]) {
  const fieldUnion = Type.Union(allowedFields.map((f) => Type.Literal(f)));

  return Type.Array(
    Type.Object({
      field: fieldUnion,
      direction: Direction,
    })
  );
}

/**
 * Creates a TypeBox schema for a complete filter object.
 *
 * @param shape - Object mapping field names to their TypeBox schemas
 * @returns A TypeBox schema for the filter object
 *
 * @example
 * const userFilterSchema = buildFilterSchema({
 *   name: Type.String(),
 *   age: Type.Number(),
 *   status: Type.Union([Type.Literal('active'), Type.Literal('inactive')]),
 * });
 *
 * Value.Check(userFilterSchema, {
 *   name: { like: 'John' },
 *   age: { gte: 18 },
 *   status: 'active',
 * });
 */
export function buildFilterSchema<T extends Record<string, TSchema>>(shape: T) {
  const filterShape = {} as Record<string, TSchema>;

  for (const [key, valueSchema] of Object.entries(shape)) {
    filterShape[key] = Type.Optional(FilterValue(valueSchema));
  }

  return Type.Object(filterShape, { additionalProperties: false });
}

// Re-export Type for convenience
export { Type };
