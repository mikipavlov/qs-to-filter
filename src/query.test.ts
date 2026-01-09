import { describe, expect, it } from 'vitest';
import { buildSearchParams, parseQueryString } from './query.js';

describe('parseQueryString', () => {
  describe('array operators', () => {
    it('should convert single value for "in" operator to array', () => {
      const result = parseQueryString('urlSlug[in]=krietzauto.com');
      expect(result).toEqual({
        urlSlug: { in: ['krietzauto.com'] },
      });
    });

    it('should handle multiple values for "in" operator as array', () => {
      const result = parseQueryString('urlSlug[in]=site1.com,site2.com');
      expect(result).toEqual({
        urlSlug: { in: ['site1.com', 'site2.com'] },
      });
    });

    it('should convert single value for "nin" operator to array', () => {
      const result = parseQueryString('status[nin]=draft');
      expect(result).toEqual({
        status: { nin: ['draft'] },
      });
    });

    it('should convert single value for "all" operator to array', () => {
      const result = parseQueryString('tags[all]=featured');
      expect(result).toEqual({
        tags: { all: ['featured'] },
      });
    });
  });

  describe('numeric operators', () => {
    it('should convert string numbers to actual numbers for "gt" operator', () => {
      const result = parseQueryString('couponCount[gt]=10');
      expect(result).toEqual({
        couponCount: { gt: 10 },
      });
    });

    it('should convert string numbers for "gte" operator', () => {
      const result = parseQueryString('couponCount[gte]=5');
      expect(result).toEqual({
        couponCount: { gte: 5 },
      });
    });

    it('should convert string numbers for "lt" operator', () => {
      const result = parseQueryString('couponCount[lt]=100');
      expect(result).toEqual({
        couponCount: { lt: 100 },
      });
    });

    it('should convert string numbers for "lte" operator', () => {
      const result = parseQueryString('couponCount[lte]=50');
      expect(result).toEqual({
        couponCount: { lte: 50 },
      });
    });

    it('should handle negative numbers', () => {
      const result = parseQueryString('temperature[gte]=-10');
      expect(result).toEqual({
        temperature: { gte: -10 },
      });
    });

    it('should handle decimal numbers', () => {
      const result = parseQueryString('price[lte]=99.99');
      expect(result).toEqual({
        price: { lte: 99.99 },
      });
    });
  });

  describe('boolean operators', () => {
    it('should convert "true" string to boolean for "exists" operator', () => {
      const result = parseQueryString('publishedAt[exists]=true');
      expect(result).toEqual({
        publishedAt: { exists: true },
      });
    });

    it('should convert "false" string to boolean for "exists" operator', () => {
      const result = parseQueryString('publishedAt[exists]=false');
      expect(result).toEqual({
        publishedAt: { exists: false },
      });
    });
  });

  describe('string operators', () => {
    it('should handle "like" operator', () => {
      const result = parseQueryString('name[like]=test');
      expect(result).toEqual({
        name: { like: 'test' },
      });
    });

    it('should handle "ilike" operator', () => {
      const result = parseQueryString('name[ilike]=TEST');
      expect(result).toEqual({
        name: { ilike: 'TEST' },
      });
    });

    it('should handle "regex" operator', () => {
      const result = parseQueryString('email[regex]=^test@');
      expect(result).toEqual({
        email: { regex: '^test@' },
      });
    });
  });

  describe('sort', () => {
    it('should parse single sort field', () => {
      const result = parseQueryString('sort=createdAt:desc');
      expect(result).toEqual({
        sort: [{ field: 'createdAt', direction: 'desc' }],
      });
    });

    it('should parse multiple sort fields', () => {
      const result = parseQueryString('sort=couponCount:desc|createdAt:asc');
      expect(result).toEqual({
        sort: [
          { field: 'couponCount', direction: 'desc' },
          { field: 'createdAt', direction: 'asc' },
        ],
      });
    });

    it('should not include sort when not present', () => {
      const result = parseQueryString('status=published');
      expect(result).not.toHaveProperty('sort');
    });
  });

  describe('nested fields', () => {
    it('should handle nested object filters', () => {
      const result = parseQueryString('origins[urlSlug][in]=site1.com,site2.com');
      expect(result).toEqual({
        origins: {
          urlSlug: { in: ['site1.com', 'site2.com'] },
        },
      });
    });

    it('should handle deeply nested filters', () => {
      const result = parseQueryString('traffic[organic][etv][gt]=1000');
      expect(result).toEqual({
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      });
    });
  });

  describe('complex queries', () => {
    it('should handle multiple filters and sort', () => {
      const result = parseQueryString(
        'urlSlug[in]=site1.com&status[nin]=draft,skipped&couponCount[gte]=5&sort=createdAt:desc'
      );
      expect(result).toEqual({
        urlSlug: { in: ['site1.com'] },
        status: { nin: ['draft', 'skipped'] },
        couponCount: { gte: 5 },
        sort: [{ field: 'createdAt', direction: 'desc' }],
      });
    });

    it('should handle simple equality values', () => {
      const result = parseQueryString('status=published&category=tech');
      expect(result).toEqual({
        status: 'published',
        category: 'tech',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty query string', () => {
      const result = parseQueryString('');
      expect(result).toEqual({});
    });

    it('should handle query string with leading ?', () => {
      const result = parseQueryString('?status=published');
      expect(result).toEqual({
        status: 'published',
      });
    });
  });

  describe('custom options', () => {
    it('should respect custom arrayLimit', () => {
      const longArray = Array.from({ length: 200 }, (_, i) => `item${i}`).join(',');
      const result = parseQueryString(`tags[in]=${longArray}`, { arrayLimit: 50 });
      expect((result.tags as { in: string[] }).in.length).toBeLessThanOrEqual(50);
    });
  });
});

describe('buildSearchParams', () => {
  it('should build search params with "in" operator', () => {
    const params = buildSearchParams({ urlSlug: { in: ['site1.com', 'site2.com'] } });
    expect(params.toString()).toBe('urlSlug%5Bin%5D=site1.com%2Csite2.com');
  });

  it('should build search params with numeric operators', () => {
    const params = buildSearchParams({ couponCount: { gte: 10 } });
    expect(params.toString()).toBe('couponCount%5Bgte%5D=10');
  });

  it('should build search params with sort', () => {
    const params = buildSearchParams(
      {},
      { sort: [{ field: 'createdAt', direction: 'desc' as const }] }
    );
    expect(params.toString()).toBe('sort=createdAt%3Adesc');
  });

  it('should build search params with multiple sort fields', () => {
    const params = buildSearchParams(
      {},
      {
        sort: [
          { field: 'name', direction: 'asc' as const },
          { field: 'createdAt', direction: 'desc' as const },
        ],
      }
    );
    expect(params.toString()).toBe('sort=name%3Aasc%7CcreatedAt%3Adesc');
  });

  it('should build complex query params', () => {
    const params = buildSearchParams(
      { status: 'published', price: { gte: 10 } },
      { limit: 50, skip: 0 }
    );
    const decoded = decodeURIComponent(params.toString());
    expect(decoded).toContain('status=published');
    expect(decoded).toContain('price[gte]=10');
    expect(decoded).toContain('limit=50');
    expect(decoded).toContain('skip=0');
  });

  it('should handle nested objects', () => {
    const params = buildSearchParams({
      origins: {
        urlSlug: { in: ['site1.com', 'site2.com'] },
      },
    });
    expect(params.toString()).toBe('origins%5BurlSlug%5D%5Bin%5D=site1.com%2Csite2.com');
  });

  it('should handle empty filter and options', () => {
    const params = buildSearchParams({}, {});
    expect(params.toString()).toBe('');
  });

  it('should skip null values', () => {
    const params = buildSearchParams({ status: 'active', deleted: null } as Record<
      string,
      unknown
    >);
    const decoded = decodeURIComponent(params.toString());
    expect(decoded).toBe('status=active');
  });
});
