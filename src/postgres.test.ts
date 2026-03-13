/**
 * PostgreSQL Adapter Tests
 */

import { describe, expect, it } from 'vitest';
import {
  buildPostgresFilter,
  buildPostgresSort,
  transformBracketToPostgresFilter,
  BRACKET_TO_POSTGRES_OPERATOR,
} from './postgres.js';
import type { Sort } from './filter.js';

describe('BRACKET_TO_POSTGRES_OPERATOR', () => {
  it('has all required operators', () => {
    expect(BRACKET_TO_POSTGRES_OPERATOR).toEqual({
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
    });
  });
});

describe('transformBracketToPostgresFilter', () => {
  describe('simple equality filters', () => {
    it('handles string equality', () => {
      const result = transformBracketToPostgresFilter({ status: 'published' });
      expect(result.sql).toBe('"status" = $1');
      expect(result.params).toEqual(['published']);
    });

    it('handles number equality', () => {
      const result = transformBracketToPostgresFilter({ count: 42 });
      expect(result.sql).toBe('"count" = $1');
      expect(result.params).toEqual([42]);
    });

    it('handles boolean equality', () => {
      const result = transformBracketToPostgresFilter({ active: true });
      expect(result.sql).toBe('"active" = $1');
      expect(result.params).toEqual([true]);
    });

    it('handles null value', () => {
      const result = transformBracketToPostgresFilter({ deleted: null });
      expect(result.sql).toBe('"deleted" = $1');
      expect(result.params).toEqual([null]);
    });
  });

  describe('comparison operators', () => {
    it('handles gt', () => {
      const result = transformBracketToPostgresFilter({ count: { gt: 10 } });
      expect(result.sql).toBe('"count" > $1');
      expect(result.params).toEqual([10]);
    });

    it('handles gte', () => {
      const result = transformBracketToPostgresFilter({ count: { gte: 10 } });
      expect(result.sql).toBe('"count" >= $1');
      expect(result.params).toEqual([10]);
    });

    it('handles lt', () => {
      const result = transformBracketToPostgresFilter({ count: { lt: 100 } });
      expect(result.sql).toBe('"count" < $1');
      expect(result.params).toEqual([100]);
    });

    it('handles lte', () => {
      const result = transformBracketToPostgresFilter({ count: { lte: 100 } });
      expect(result.sql).toBe('"count" <= $1');
      expect(result.params).toEqual([100]);
    });

    it('handles ne', () => {
      const result = transformBracketToPostgresFilter({ status: { ne: 'deleted' } });
      expect(result.sql).toBe('"status" != $1');
      expect(result.params).toEqual(['deleted']);
    });

    it('handles eq explicitly', () => {
      const result = transformBracketToPostgresFilter({ status: { eq: 'active' } });
      expect(result.sql).toBe('"status" = $1');
      expect(result.params).toEqual(['active']);
    });
  });

  describe('array operators', () => {
    it('handles in with array', () => {
      const result = transformBracketToPostgresFilter({
        status: { in: ['active', 'pending'] },
      });
      expect(result.sql).toBe('"status" IN ($1, $2)');
      expect(result.params).toEqual(['active', 'pending']);
    });

    it('handles in with single value', () => {
      const result = transformBracketToPostgresFilter({
        status: { in: ['active'] },
      });
      expect(result.sql).toBe('"status" IN ($1)');
      expect(result.params).toEqual(['active']);
    });

    it('handles nin', () => {
      const result = transformBracketToPostgresFilter({
        status: { nin: ['deleted', 'banned'] },
      });
      expect(result.sql).toBe('"status" NOT IN ($1, $2)');
      expect(result.params).toEqual(['deleted', 'banned']);
    });

    it('handles empty in array', () => {
      const result = transformBracketToPostgresFilter({
        status: { in: [] },
      });
      expect(result.sql).toBe('1 = 0');
      expect(result.params).toEqual([]);
    });
  });

  describe('string operators', () => {
    it('handles like', () => {
      const result = transformBracketToPostgresFilter({
        name: { like: '%john%' },
      });
      expect(result.sql).toBe('"name" LIKE $1');
      expect(result.params).toEqual(['%john%']);
    });

    it('handles ilike', () => {
      const result = transformBracketToPostgresFilter({
        name: { ilike: 'john%' },
      });
      expect(result.sql).toBe('"name" ILIKE $1');
      expect(result.params).toEqual(['john%']);
    });

    it('handles regex', () => {
      const result = transformBracketToPostgresFilter({
        pattern: { regex: '^abc.*' },
      });
      expect(result.sql).toBe('"pattern" ~ $1');
      expect(result.params).toEqual(['^abc.*']);
    });
  });

  describe('exists operator', () => {
    it('handles exists true', () => {
      const result = transformBracketToPostgresFilter({
        deleted: { exists: true },
      });
      expect(result.sql).toBe('"deleted" IS NOT NULL');
      expect(result.params).toEqual([]);
    });

    it('handles exists false', () => {
      const result = transformBracketToPostgresFilter({
        deleted: { exists: false },
      });
      expect(result.sql).toBe('"deleted" IS NULL');
      expect(result.params).toEqual([]);
    });
  });

  describe('nested objects with dot notation', () => {
    it('handles simple nested field', () => {
      const result = transformBracketToPostgresFilter({
        'user.profile.name': 'John',
      });
      expect(result.sql).toBe('"user"."profile"."name" = $1');
      expect(result.params).toEqual(['John']);
    });

    it('handles nested field with operator', () => {
      const result = transformBracketToPostgresFilter({
        'user.profile.age': { gte: 18 },
      });
      expect(result.sql).toBe('"user"."profile"."age" >= $1');
      expect(result.params).toEqual([18]);
    });
  });

  describe('complex mixed filters', () => {
    it('handles multiple fields with AND', () => {
      const result = transformBracketToPostgresFilter({
        status: 'published',
        count: { gte: 10 },
      });
      expect(result.sql).toBe('"status" = $1 AND "count" >= $2');
      expect(result.params).toEqual(['published', 10]);
    });

    it('handles multiple operators on same field', () => {
      const result = transformBracketToPostgresFilter({
        price: { gte: 10, lte: 100 },
      });
      expect(result.sql).toBe('"price" >= $1 AND "price" <= $2');
      expect(result.params).toEqual([10, 100]);
    });

    it('handles complex combination', () => {
      const result = transformBracketToPostgresFilter({
        status: { in: ['active', 'pending'] },
        count: { gte: 10 },
        name: { like: '%test%' },
      });
      expect(result.sql).toBe('"status" IN ($1, $2) AND "count" >= $3 AND "name" LIKE $4');
      expect(result.params).toEqual(['active', 'pending', 10, '%test%']);
    });
  });

  describe('JSONB support', () => {
    it('handles simple JSONB field access', () => {
      const result = transformBracketToPostgresFilter({
        'data->>settings': { eq: 'value' },
      });
      expect(result.sql).toBe('"data"->>\'settings\' = $1');
      expect(result.params).toEqual(['value']);
    });

    it('handles nested JSONB path', () => {
      const result = transformBracketToPostgresFilter({
        'data->>settings->>theme': 'dark',
      });
      expect(result.sql).toBe('"data"->>\'settings\'->>\'theme\' = $1');
      expect(result.params).toEqual(['dark']);
    });

    it('handles JSONB with operators', () => {
      const result = transformBracketToPostgresFilter({
        'data->>count': { gte: 10 },
      });
      expect(result.sql).toBe('"data"->>\'count\' >= $1');
      expect(result.params).toEqual([10]);
    });

    it('handles JSONB with like', () => {
      const result = transformBracketToPostgresFilter({
        'metadata->>tags->>name': { like: '%test%' },
      });
      expect(result.sql).toBe('"metadata"->>\'tags\'->>\'name\' LIKE $1');
      expect(result.params).toEqual(['%test%']);
    });

    it('handles JSONB keys with single quotes (escaped)', () => {
      const result = transformBracketToPostgresFilter({
        "data->>key'with'quotes": { eq: 'value' },
      });
      expect(result.sql).toBe('"data"->>\'key\'\'with\'\'quotes\' = $1');
      expect(result.params).toEqual(['value']);
    });
  });

  describe('logical operators', () => {
    it('handles and with multiple conditions', () => {
      const result = transformBracketToPostgresFilter({
        and: [{ status: { eq: 'active' } }, { count: { gte: 10 } }],
      });
      expect(result.sql).toBe('("status" = $1 AND "count" >= $2)');
      expect(result.params).toEqual(['active', 10]);
    });

    it('handles or with multiple conditions', () => {
      const result = transformBracketToPostgresFilter({
        or: [{ status: { eq: 'admin' } }, { role: { eq: 'superuser' } }],
      });
      expect(result.sql).toBe('("status" = $1 OR "role" = $2)');
      expect(result.params).toEqual(['admin', 'superuser']);
    });

    it('handles not with single condition', () => {
      const result = transformBracketToPostgresFilter({
        not: { status: { eq: 'deleted' } },
      });
      expect(result.sql).toBe('NOT ("status" = $1)');
      expect(result.params).toEqual(['deleted']);
    });

    it('handles nested logical operators', () => {
      const result = transformBracketToPostgresFilter({
        and: [
          { status: { eq: 'active' } },
          {
            or: [{ role: { eq: 'admin' } }, { role: { eq: 'moderator' } }],
          },
        ],
      });
      expect(result.sql).toBe('("status" = $1 AND ("role" = $2 OR "role" = $3))');
      expect(result.params).toEqual(['active', 'admin', 'moderator']);
    });

    it('handles logical operators with field filters', () => {
      const result = transformBracketToPostgresFilter({
        status: 'published',
        or: [{ count: { gte: 10 } }, { featured: { eq: true } }],
      });
      expect(result.sql).toBe('"status" = $1 AND ("count" >= $2 OR "featured" = $3)');
      expect(result.params).toEqual(['published', 10, true]);
    });
  });
});

describe('buildPostgresFilter', () => {
  it('transforms bracket-style filter to PostgreSQL', () => {
    const result = buildPostgresFilter({
      status: 'published',
      count: { gte: 10 },
    });
    expect(result.sql).toBe('"status" = $1 AND "count" >= $2');
    expect(result.params).toEqual(['published', 10]);
  });

  it('applies security validation when options provided', () => {
    expect(() => {
      buildPostgresFilter(
        { password: 'secret' },
        {
          security: {
            blockedFields: ['password'],
          },
        }
      );
    }).toThrow();
  });

  it('skips validation when validate is false', () => {
    const result = buildPostgresFilter(
      { password: 'secret' },
      {
        security: {
          blockedFields: ['password'],
        },
        validate: false,
      }
    );
    expect(result.sql).toBe('"password" = $1');
  });
});

describe('buildPostgresSort', () => {
  it('handles single field ascending', () => {
    const sort: Sort = [{ field: 'createdAt', direction: 'asc' }];
    const result = buildPostgresSort(sort);
    expect(result).toBe('ORDER BY "createdAt" ASC');
  });

  it('handles single field descending', () => {
    const sort: Sort = [{ field: 'createdAt', direction: 'desc' }];
    const result = buildPostgresSort(sort);
    expect(result).toBe('ORDER BY "createdAt" DESC');
  });

  it('handles multiple fields', () => {
    const sort: Sort = [
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ];
    const result = buildPostgresSort(sort);
    expect(result).toBe('ORDER BY "createdAt" DESC, "name" ASC');
  });

  it('returns empty string for empty sort array', () => {
    const result = buildPostgresSort([]);
    expect(result).toBe('');
  });

  it('handles JSONB field in sort', () => {
    const sort: Sort = [{ field: 'data->>priority', direction: 'desc' }];
    const result = buildPostgresSort(sort);
    expect(result).toBe("ORDER BY data->>'priority' DESC");
  });
});

describe('table prefix option', () => {
  it('adds table prefix to columns', () => {
    const result = transformBracketToPostgresFilter(
      { status: 'active' },
      { tablePrefix: 'users' }
    );
    expect(result.sql).toBe('users."status" = $1');
    expect(result.params).toEqual(['active']);
  });

  it('handles prefix with nested fields', () => {
    const result = transformBracketToPostgresFilter(
      { 'user.profile.name': 'John' },
      { tablePrefix: 'users' }
    );
    expect(result.sql).toBe('users."user"."profile"."name" = $1');
    expect(result.params).toEqual(['John']);
  });

  it('handles prefix with JSONB fields', () => {
    const result = transformBracketToPostgresFilter(
      { 'data->>settings->>theme': 'dark' },
      { tablePrefix: 'users' }
    );
    expect(result.sql).toBe('users."data"->>\'settings\'->>\'theme\' = $1');
    expect(result.params).toEqual(['dark']);
  });

  it('handles prefix in sort', () => {
    const sort: Sort = [{ field: 'createdAt', direction: 'desc' }];
    const result = buildPostgresSort(sort, { tablePrefix: 'users' });
    expect(result).toBe('ORDER BY users."createdAt" DESC');
  });

  it('handles prefix with JSONB in sort', () => {
    const sort: Sort = [{ field: 'data->>priority', direction: 'desc' }];
    const result = buildPostgresSort(sort, { tablePrefix: 'users' });
    expect(result).toBe("ORDER BY users.data->>'priority' DESC");
  });
});

describe('identifier quoting edge cases', () => {
  it('quotes reserved keywords like "order" and "user"', () => {
    const result = transformBracketToPostgresFilter({
      order: 'desc',
      user: 'admin',
    });
    expect(result.sql).toBe('"order" = $1 AND "user" = $2');
    expect(result.params).toEqual(['desc', 'admin']);
  });

  it('quotes fields with spaces', () => {
    const result = transformBracketToPostgresFilter({
      'my field': 'value',
    });
    expect(result.sql).toBe('"my field" = $1');
    expect(result.params).toEqual(['value']);
  });
});

describe('integration - full pipeline', () => {
  it('handles query string -> parsed -> postgres pipeline', async () => {
    const { parseQueryString } = await import('./query.js');

    const qs = 'status=published&count[gte]=10&sort=createdAt:desc';
    const parsed = parseQueryString(qs);
    const { sort, ...filter } = parsed;
    const { sql, params } = buildPostgresFilter(filter);

    expect(sql).toBe('"status" = $1 AND "count" >= $2');
    expect(params).toEqual(['published', 10]);
  });

  it('handles complex query string', async () => {
    const { parseQueryString } = await import('./query.js');

    const qs = 'tags[in]=draft,published&name[like]=%test%&sort=name:asc';
    const parsed = parseQueryString(qs);
    const { sort, ...filter } = parsed;
    const { sql, params } = buildPostgresFilter(filter);
    const sortSql = buildPostgresSort(sort as Sort);

    expect(sql).toBe('"tags" IN ($1, $2) AND "name" LIKE $3');
    expect(params).toEqual(['draft', 'published', '%test%']);
    expect(sortSql).toBe('ORDER BY "name" ASC');
  });
});
