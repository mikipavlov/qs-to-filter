# qs-to-filter

Type-safe query string to database filter conversion with security built-in.

Transform URL query strings into database-ready filter objects with automatic type conversion, validation, and protection against common attacks.

## Features

- **Two-step conversion** - Query string → Filter → Database query
- **MongoDB adapter** - Convert filters to MongoDB queries
- **PostgreSQL adapter** - Convert filters to parameterized SQL queries
- **Type-safe** - Full TypeScript support with inference
- **Schema validation** - Adapters for Zod, Valibot, and TypeBox
- **Security** - ReDoS protection, field access control, operator restrictions
- **Bidirectional** - Parse query strings and build them back from filters
- **Extensible** - Register custom operators

## Installation

```bash
npm install qs-to-filter
# or
pnpm add qs-to-filter
# or
yarn add qs-to-filter
```

### Optional Peer Dependencies

Install only what you need:

```bash
# For MongoDB support
npm install mongodb

# For schema validation (choose one)
npm install zod          # Zod adapter
npm install valibot      # Valibot adapter (lightweight)
npm install @sinclair/typebox  # TypeBox adapter (JSON Schema)
```

## Quick Start

`qs-to-filter` provides two conversions:

1. **Query String → Filter** - Parse URL query strings into filter objects
2. **Filter → Database** - Convert filter objects to database queries

```typescript
import { parseQueryString } from 'qs-to-filter';
import { buildMongoFilter, buildMongoSort } from 'qs-to-filter/mongo';

// Step 1: Parse query string to filter
const parsed = parseQueryString('status=published&price[gte]=10&sort=name:asc');
const { sort, ...filter } = parsed;

// Step 2: Convert filter to database format
const mongoFilter = buildMongoFilter(filter);
const mongoSort = buildMongoSort(sort);

// Use in your database query
db.collection('items').find(mongoFilter).sort(mongoSort).toArray();
```

### PostgreSQL

```typescript
import { parseQueryString } from 'qs-to-filter';
import { buildPostgresFilter, buildPostgresSort } from 'qs-to-filter/postgres';

const parsed = parseQueryString('status=published&price[gte]=10&sort=name:asc');
const { sort, ...filter } = parsed;

const { sql, params } = buildPostgresFilter(filter);
// { sql: '"status" = $1 AND "price" >= $2', params: ['published', 10] }

const sortSql = buildPostgresSort(sort);
// 'ORDER BY "name" ASC'
```

## Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal to | `status[eq]=published` |
| `ne` | Not equal | `status[ne]=draft` |
| `gt` | Greater than | `price[gt]=10` |
| `gte` | Greater than or equal | `price[gte]=10` |
| `lt` | Less than | `price[lt]=100` |
| `lte` | Less than or equal | `price[lte]=100` |
| `in` | In array | `status[in]=published,draft` |
| `nin` | Not in array | `status[nin]=archived,deleted` |
| `like` | Pattern match (case-sensitive) | `name[like]=john` |
| `ilike` | Pattern match (case-insensitive) | `name[ilike]=john` |
| `exists` | Field exists | `email[exists]=true` |
| `size` | Array size | `tags[size]=3` |
| `all` | Array contains all | `tags[all]=node,typescript` |
| `regex` | Regular expression | `name[regex]=^John` |

## Security

### Field Access Control

```typescript
import { validateFilter } from 'qs-to-filter';

const filter = parseQueryString(userProvidedQueryString);

// Validate field access
validateFilter(filter, {
  // Whitelist approach: only these fields can be queried
  allowedFields: ['status', 'price', 'name', 'createdAt'],

  // Blacklist approach: these fields are always blocked
  blockedFields: ['password', 'apiKey', 'secret'],

  // Per-field operator restrictions
  fieldConfig: {
    status: { operators: ['eq', 'in'] },           // Only eq and in
    price: { operators: ['eq', 'gte', 'lte'] },    // Only comparison
    name: { allowRegex: false },                    // No regex on name
  },
});
```

### ReDoS Protection

The library automatically validates regex patterns for potential ReDoS vulnerabilities:

```typescript
import { validateRegexPattern, DangerousRegexError } from 'qs-to-filter';

try {
  validateRegexPattern(userProvidedRegex);
} catch (e) {
  if (e instanceof DangerousRegexError) {
    console.error('Dangerous regex pattern rejected');
  }
}
```

### Default Blocked Fields

These fields are blocked by default:

- `password`, `passwordHash`, `hash`
- `secret`, `secretKey`, `apiKey`
- `token`, `refreshToken`, `accessToken`
- `__v`, `__proto__`, `constructor`, `prototype`

## Schema Validation

### Zod

```typescript
import { FilterValue, buildFilterSchema, buildWhereSchema } from 'qs-to-filter/adapters/zod';
import { z } from 'zod';

// Single field filter
const priceFilter = FilterValue(z.number());
priceFilter.parse(100);                     // Valid: direct value
priceFilter.parse({ gte: 10, lte: 100 });   // Valid: with operators

// Complete filter schema
const productFilterSchema = buildFilterSchema({
  name: z.string(),
  price: z.number(),
  status: z.enum(['draft', 'published', 'archived']),
});

productFilterSchema.parse({
  name: { like: 'widget' },
  price: { gte: 10, lte: 100 },
  status: 'published',
});

// With logical operators (and/or/not)
const whereSchema = buildWhereSchema({
  name: z.string(),
  price: z.number(),
});

whereSchema.parse({
  price: { gte: 100 },
  or: [
    { name: { like: 'premium' } },
    { name: { like: 'pro' } },
  ],
});
```

### Valibot

```typescript
import { FilterValue, buildFilterSchema } from 'qs-to-filter/adapters/valibot';
import * as v from 'valibot';

const priceFilter = FilterValue(v.number());
v.parse(priceFilter, { gte: 10 }); // Validated!
```

### TypeBox

```typescript
import { FilterValue } from 'qs-to-filter/adapters/typebox';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const priceFilter = FilterValue(Type.Number());
Value.Check(priceFilter, { gte: 10 }); // true
```

## Custom Operators

Register custom operators for domain-specific filtering:

```typescript
import { operatorRegistry } from 'qs-to-filter';

operatorRegistry.register({
  name: 'between',
  description: 'Value between range [min, max]',
  category: 'comparison',
  valueTypes: ['array'],
  validate: (v) => Array.isArray(v) && v.length === 2
    ? true
    : 'between requires [min, max] array',
});
```

## API Reference

### Core

#### `parseQueryString(str, options?)`

Parse a URL query string into a filter object.

```typescript
const filter = parseQueryString('status=published&price[gte]=10');
```

**Options:**
- `depth` - Maximum nesting depth (default: 5)
- `parameterLimit` - Maximum parameters (default: 1000)
- `arrayLimit` - Maximum array size (default: 100)

#### `buildSearchParams(filter, opts?)`

Build URLSearchParams from a filter object.

```typescript
const params = buildSearchParams({ status: { in: ['a', 'b'] } });
```

### MongoDB Adapter

#### `buildMongoFilter(filter, options?)`

Convert a filter object to MongoDB format.

```typescript
import { buildMongoFilter } from 'qs-to-filter/mongo';

const mongoFilter = buildMongoFilter(parsedFilter, {
  security: { allowedFields: ['status', 'price'] },
});
```

#### `buildMongoSort(sortArray)`

Convert sort array to MongoDB sort object.

```typescript
import { buildMongoSort } from 'qs-to-filter/mongo';

const sort = buildMongoSort([{ field: 'createdAt', direction: 'desc' }]);
// { createdAt: -1 }
```

### PostgreSQL Adapter

#### `buildPostgresFilter(filter, options?)`

Convert a filter object to PostgreSQL WHERE clause with parameters.

```typescript
import { buildPostgresFilter } from 'qs-to-filter/postgres';

const { sql, params } = buildPostgresFilter(filter, {
  tablePrefix: 'users',           // Optional: add table/alias prefix
  security: { allowedFields: ['status', 'name'] },
});
// { sql: 'users.status = $1', params: ['active'] }
```

**Options:**
- `tablePrefix` - Add table/alias prefix to all columns
- `security` - Security options (same as MongoDB)
- `validate` - Enable/disable validation (default: true)
- `customOperators` - Custom operator mappings

#### `buildPostgresSort(sortArray, options?)`

Convert sort array to PostgreSQL ORDER BY clause.

```typescript
import { buildPostgresSort } from 'qs-to-filter/postgres';

const sort = buildPostgresSort(
  [{ field: 'createdAt', direction: 'desc' }],
  { tablePrefix: 'users' }
);
// 'ORDER BY users."createdAt" DESC'
```

### Security

#### `validateFilter(filter, options)`

Comprehensive filter validation.

```typescript
import { validateFilter } from 'qs-to-filter';

validateFilter(filter, {
  allowedFields: ['status', 'name'],
  fieldConfig: {
    status: { operators: ['eq', 'in'] },
  },
});
```

### Error Classes

```typescript
import {
  QsToFilterError,
  FilterParseError,
  SecurityError,
  FieldAccessError,
  OperatorNotAllowedError,
  DangerousRegexError,
  ValueLimitError,
} from 'qs-to-filter';
```

## Examples

### Express.js Middleware

```typescript
import { parseQueryString, validateFilter } from 'qs-to-filter';
import { buildMongoFilter, buildMongoSort } from 'qs-to-filter/mongo';

function filterMiddleware(allowedFields: string[]) {
  return (req, res, next) => {
    const parsed = parseQueryString(req.url.split('?')[1] || '');

    // Validate for security
    validateFilter(parsed, { allowedFields });

    // Extract pagination/sort
    const { sort, limit = 50, skip = 0, ...filter } = parsed;

    // Attach to request
    req.filter = buildMongoFilter(filter);
    req.sort = Array.isArray(sort) ? buildMongoSort(sort) : {};
    req.pagination = { limit: Number(limit), skip: Number(skip) };

    next();
  };
}

// Usage
app.get('/products', filterMiddleware(['name', 'price', 'status']), async (req, res) => {
  const products = await db.collection('products')
    .find(req.filter)
    .sort(req.sort)
    .skip(req.pagination.skip)
    .limit(req.pagination.limit)
    .toArray();

  res.json(products);
});
```

### Full Round-Trip Example

```typescript
import { parseQueryString, buildSearchParams } from 'qs-to-filter';
import { buildMongoFilter, buildMongoSort } from 'qs-to-filter/mongo';

// 1. Parse incoming query
const query = 'status=published&price[gte]=10&price[lte]=100&tags[in]=sale,new&sort=createdAt:desc';
const parsed = parseQueryString(query);

// 2. Separate concerns
const { sort, ...filter } = parsed;

// 3. Build MongoDB query
const mongoFilter = buildMongoFilter(filter);
// {
//   status: 'published',
//   price: { $gte: 10, $lte: 100 },
//   tags: { $in: ['sale', 'new'] }
// }

const mongoSort = buildMongoSort(sort);
// { createdAt: -1 }

// 4. Later, build URL for pagination link
const nextParams = buildSearchParams(filter, { sort, skip: 50, limit: 50 });
// Generates URL-safe params for "next page" link
```

## TypeScript Types

The package exports comprehensive TypeScript types:

```typescript
import type {
  FilterValue,
  FilterObject,
  FilterOperator,
  WhereInput,
  Sort,
  SortDirection,
  StringFilterValue,
  NumberFilterValue,
  BooleanFilterValue,
  DateFilterValue,
  ArrayFilterValue,
} from 'qs-to-filter';

// Use for type-safe filter definitions
interface Product {
  id: string;
  name: string;
  price: number;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
}

type ProductFilter = FilterObject<Product>;
// {
//   id?: FilterValue<string>;
//   name?: FilterValue<string>;
//   price?: FilterValue<number>;
//   status?: FilterValue<'draft' | 'published' | 'archived'>;
//   tags?: FilterValue<string[]>;
// }
```

## License

MIT
