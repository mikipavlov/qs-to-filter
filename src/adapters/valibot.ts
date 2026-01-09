/**
 * Valibot Schema Adapter for Filter Validation
 *
 * Provides Valibot schema builders for validating filter objects.
 * This adapter creates Valibot schemas that match the pure TypeScript
 * filter types defined in the core module.
 *
 * Valibot is a lightweight (~1kb) schema validation library with
 * tree-shakeable modular design.
 *
 * @example
 * import { FilterValue, buildSortSchema } from 'qs-to-filter/adapters/valibot';
 * import * as v from 'valibot';
 *
 * const priceFilter = FilterValue(v.number());
 * v.parse(priceFilter, { gte: 10, lte: 100 }); // Valid
 *
 * const sortSchema = buildSortSchema(['createdAt', 'name']);
 * v.parse(sortSchema, [{ field: 'createdAt', direction: 'desc' }]); // Valid
 */

import * as v from 'valibot';

/**
 * Creates a Valibot schema for a filter value that supports bracket-style operators.
 *
 * The schema accepts either a direct value or an object with filter operators.
 * All operators are optional, but at least one must be specified when using
 * the operator object form.
 *
 * @param value - The Valibot schema for the base value type
 * @returns A union schema that accepts either a direct value or an object with operators
 *
 * @example
 * const priceFilter = FilterValue(v.number());
 * v.parse(priceFilter, 100);                    // Valid: direct value
 * v.parse(priceFilter, { gte: 50, lte: 200 }); // Valid: operator object
 */
export const FilterValue = <T extends v.GenericSchema>(value: T) => {
  const operatorSchema = v.pipe(
    v.object({
      // Base operators
      eq: v.optional(value),
      ne: v.optional(value),
      in: v.optional(v.array(value)),
      nin: v.optional(v.array(value)),
      exists: v.optional(v.boolean()),

      // Comparison operators
      gt: v.optional(value),
      gte: v.optional(value),
      lt: v.optional(value),
      lte: v.optional(value),

      // String operators
      like: v.optional(v.string()),
      ilike: v.optional(v.string()),
      regex: v.optional(v.string()),

      // Array operators
      size: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
      all: v.optional(v.array(value)),

      // Logical operators - simplified without recursive lazy
      or: v.optional(v.array(value)),
    }),
    v.check(
      (obj) => Object.keys(obj).some((k) => obj[k as keyof typeof obj] !== undefined),
      'At least one operator must be specified'
    )
  );

  return v.union([value, operatorSchema]);
};

/**
 * Sort direction schema
 */
export const Direction = v.picklist(['asc', 'desc']);

/**
 * Creates a Valibot schema for sort specification with allowed fields.
 *
 * @param allowedFields - Array of field names that can be sorted
 * @returns A Valibot schema for validating sort arrays
 *
 * @example
 * const sortSchema = buildSortSchema(['createdAt', 'updatedAt', 'name']);
 * v.parse(sortSchema, [{ field: 'createdAt', direction: 'desc' }]); // Valid
 */
export function buildSortSchema<T extends string>(allowedFields: readonly T[]) {
  return v.array(
    v.object({
      field: v.picklist(allowedFields as unknown as [T, ...T[]]),
      direction: Direction,
    })
  );
}

/**
 * Creates a Valibot schema for a complete filter object.
 *
 * @param shape - Object mapping field names to their value schemas
 * @returns A Valibot schema for the filter object
 *
 * @example
 * const userFilterSchema = buildFilterSchema({
 *   name: v.string(),
 *   age: v.number(),
 *   status: v.picklist(['active', 'inactive']),
 * });
 *
 * v.parse(userFilterSchema, {
 *   name: { like: 'John' },
 *   age: { gte: 18 },
 *   status: 'active',
 * });
 */
export function buildFilterSchema<T extends Record<string, v.GenericSchema>>(shape: T) {
  const filterShape = {} as Record<string, v.GenericSchema>;

  for (const [key, valueSchema] of Object.entries(shape)) {
    filterShape[key] = v.optional(FilterValue(valueSchema));
  }

  return v.object(filterShape);
}
