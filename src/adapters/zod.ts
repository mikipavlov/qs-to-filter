/**
 * Zod Schema Adapter for Filter Validation
 *
 * Provides Zod schema builders for validating filter objects.
 * This adapter creates Zod schemas that match the pure TypeScript
 * filter types defined in the core module.
 *
 * @example
 * import { FilterValue, buildSortSchema } from 'qs-to-filter/adapters/zod';
 * import { z } from 'zod';
 *
 * const priceFilter = FilterValue(z.number());
 * priceFilter.parse({ gte: 10, lte: 100 }); // Valid
 *
 * const sortSchema = buildSortSchema(['createdAt', 'name']);
 * sortSchema.parse([{ field: 'createdAt', direction: 'desc' }]); // Valid
 */

import { z } from 'zod';

/**
 * Creates a Zod schema for a filter value that supports bracket-style operators.
 *
 * The schema accepts either a direct value or an object with filter operators.
 * All operators are optional, but at least one must be specified when using
 * the operator object form.
 *
 * @param value - The Zod schema for the base value type
 * @returns A union schema that accepts either a direct value or an object with operators
 *
 * @example
 * const priceFilter = FilterValue(z.number());
 * priceFilter.parse(100);                    // Valid: direct value
 * priceFilter.parse({ gte: 50, lte: 200 }); // Valid: operator object
 *
 * @example
 * const statusFilter = FilterValue(z.enum(['draft', 'published', 'archived']));
 * statusFilter.parse('published');                     // Valid
 * statusFilter.parse({ in: ['draft', 'published'] }); // Valid
 */
export const FilterValue = <T extends z.ZodTypeAny>(value: T) => {
  const baseSchema = z
    .object({
      // Base operators - work with any type
      eq: value.optional(),
      ne: value.optional(),
      in: z.array(value).optional(),
      nin: z.array(value).optional(),
      exists: z.boolean().optional(),

      // Comparison operators - for orderable types
      gt: value.optional(),
      gte: value.optional(),
      lt: value.optional(),
      lte: value.optional(),

      // String operators
      like: z.string().optional(),
      ilike: z.string().optional(),
      regex: z.string().optional(),

      // Array operators
      size: z.number().int().nonnegative().optional(),
      all: z.array(value).optional(),
    })
    .partial();

  const filterSchema = z
    .object({
      ...baseSchema.shape,
      // Logical operators
      or: z.array(z.lazy(() => z.union([value, baseSchema]))).optional(),
    })
    .partial()
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'At least one operator must be specified',
    });

  return z.union([value, filterSchema]);
};

/**
 * Sort direction enum schema
 */
export const Direction = z.enum(['asc', 'desc']);

/**
 * Creates a Zod schema for sort specification with allowed fields.
 *
 * @param allowedFields - Array of field names that can be sorted
 * @returns A Zod schema for validating sort arrays
 *
 * @example
 * const sortSchema = buildSortSchema(['createdAt', 'updatedAt', 'name']);
 * sortSchema.parse([{ field: 'createdAt', direction: 'desc' }]); // Valid
 */
export function buildSortSchema<T extends string>(allowedFields: readonly T[]) {
  return z.array(
    z.object({
      field: z.enum(allowedFields as [T, ...T[]]),
      direction: Direction,
    })
  );
}

/**
 * Creates a Zod schema for a complete filter object.
 *
 * @param shape - Object mapping field names to their value schemas
 * @returns A Zod schema for the filter object
 *
 * @example
 * const userFilterSchema = buildFilterSchema({
 *   name: z.string(),
 *   age: z.number(),
 *   status: z.enum(['active', 'inactive']),
 * });
 *
 * userFilterSchema.parse({
 *   name: { like: 'John' },
 *   age: { gte: 18 },
 *   status: 'active',
 * });
 */
export function buildFilterSchema<T extends Record<string, z.ZodTypeAny>>(shape: T) {
  const filterShape = {} as Record<string, z.ZodTypeAny>;

  for (const [key, valueSchema] of Object.entries(shape)) {
    filterShape[key] = FilterValue(valueSchema).optional();
  }

  return z.object(filterShape).partial();
}

/**
 * Creates a Zod schema for WhereInput with AND/OR/NOT logical operators.
 *
 * @param shape - Object mapping field names to their value schemas
 * @returns A Zod schema for WhereInput with logical operators
 *
 * @example
 * const userWhereSchema = buildWhereSchema({
 *   name: z.string(),
 *   age: z.number(),
 * });
 *
 * userWhereSchema.parse({
 *   name: { like: 'John' },
 *   OR: [
 *     { age: { gte: 18 } },
 *     { status: 'admin' },
 *   ],
 * });
 */
export function buildWhereSchema<T extends Record<string, z.ZodTypeAny>>(shape: T) {
  const baseFilter = buildFilterSchema(shape);

  // Use z.lazy for recursive schema definition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereSchema: z.ZodType<any> = z.lazy(() =>
    baseFilter.extend({
      AND: z.union([whereSchema, z.array(whereSchema)]).optional(),
      OR: z.array(whereSchema).optional(),
      NOT: z.union([whereSchema, z.array(whereSchema)]).optional(),
    })
  );

  return whereSchema;
}
