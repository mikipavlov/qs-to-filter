import { describe, expect, it } from 'vitest';
import { buildMongoFilter } from './mongo.js';
import { buildSearchParams, parseQueryString } from './query.js';

describe('Integration Tests', () => {
  describe('Array element queries', () => {
    it('should handle origins.urlSlug[in] query', () => {
      // URL: origins[urlSlug][in]=site1.com,site2.com
      const queryString = 'origins[urlSlug][in]=site1.com,site2.com';
      const parsed = parseQueryString(queryString);

      // After parsing
      expect(parsed).toEqual({
        origins: {
          urlSlug: { in: ['site1.com', 'site2.com'] },
        },
      });

      // After MongoDB transformation
      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        'origins.urlSlug': { $in: ['site1.com', 'site2.com'] },
      });
    });

    it('should handle single value in nested array query', () => {
      const queryString = 'origins[urlSlug][in]=example.com';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        origins: {
          urlSlug: { in: ['example.com'] },
        },
      });

      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        'origins.urlSlug': { $in: ['example.com'] },
      });
    });

    it('should handle multiple nested conditions on same array', () => {
      const queryString = 'origins[urlSlug][in]=site1.com&origins[origin][eq]=wethrift.com';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        origins: {
          urlSlug: { in: ['site1.com'] },
          origin: { eq: 'wethrift.com' },
        },
      });

      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        'origins.urlSlug': { $in: ['site1.com'] },
        'origins.origin': { $eq: 'wethrift.com' },
      });
    });
  });

  describe('Deeply nested queries', () => {
    it('should handle traffic.organic.etv[gt] query', () => {
      const queryString = 'traffic[organic][etv][gt]=1000';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      });

      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        'traffic.organic.etv': { $gt: 1000 },
      });
    });

    it('should handle multiple nested fields at different levels', () => {
      const queryString = 'traffic[organic][etv][gt]=1000&traffic[organic][count][gte]=50';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        traffic: {
          organic: {
            etv: { gt: 1000 },
            count: { gte: 50 },
          },
        },
      });

      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        'traffic.organic.etv': { $gt: 1000 },
        'traffic.organic.count': { $gte: 50 },
      });
    });
  });

  describe('Complex mixed queries', () => {
    it('should handle mix of simple, nested, and array queries', () => {
      const queryString =
        'status=published&couponCount[gte]=10&origins[urlSlug][in]=site1.com,site2.com&traffic[organic][etv][gt]=1000';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        status: 'published',
        couponCount: { gte: 10 },
        origins: {
          urlSlug: { in: ['site1.com', 'site2.com'] },
        },
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      });

      const mongoFilter = buildMongoFilter(parsed);
      expect(mongoFilter).toEqual({
        status: 'published',
        couponCount: { $gte: 10 },
        'origins.urlSlug': { $in: ['site1.com', 'site2.com'] },
        'traffic.organic.etv': { $gt: 1000 },
      });
    });
  });

  describe('Bidirectional conversion', () => {
    it('should build URL params for nested array queries', () => {
      const params = buildSearchParams({
        origins: {
          urlSlug: { in: ['site1.com', 'site2.com'] },
        },
      });

      expect(params.toString()).toBe('origins%5BurlSlug%5D%5Bin%5D=site1.com%2Csite2.com');
      // Decodes to: origins[urlSlug][in]=site1.com,site2.com
    });

    it('should build URL params for deeply nested queries', () => {
      const params = buildSearchParams({
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      });

      expect(params.toString()).toBe('traffic%5Borganic%5D%5Betv%5D%5Bgt%5D=1000');
      // Decodes to: traffic[organic][etv][gt]=1000
    });

    it('should build complex mixed queries', () => {
      const params = buildSearchParams({
        status: 'published',
        couponCount: { gte: 10 },
        origins: {
          urlSlug: { in: ['example.com'] },
        },
      });

      const decoded = decodeURIComponent(params.toString());
      expect(decoded).toContain('status=published');
      expect(decoded).toContain('couponCount[gte]=10');
      expect(decoded).toContain('origins[urlSlug][in]=example.com');
    });
  });

  describe('Real-world query scenarios', () => {
    it('should query by origin URL and status', () => {
      const queryString = 'status=published&origins[urlSlug][in]=krietzauto.com&limit=50';
      const parsed = parseQueryString(queryString);

      expect(parsed).toEqual({
        status: 'published',
        origins: {
          urlSlug: { in: ['krietzauto.com'] },
        },
        limit: '50',
      });

      // Extract filter (without limit/skip/sort)
      const { limit: _limit, ...filter } = parsed;
      const mongoFilter = buildMongoFilter(filter);

      expect(mongoFilter).toEqual({
        status: 'published',
        'origins.urlSlug': { $in: ['krietzauto.com'] },
      });
    });

    it('should query with high traffic from specific origin', () => {
      const queryString =
        'origins[origin][eq]=wethrift.com&traffic[organic][etv][gte]=10000&status=published';
      const parsed = parseQueryString(queryString);

      const mongoFilter = buildMongoFilter(parsed);

      expect(mongoFilter).toEqual({
        'origins.origin': { $eq: 'wethrift.com' },
        'traffic.organic.etv': { $gte: 10000 },
        status: 'published',
      });
    });

    it('should query with multiple origin conditions', () => {
      const queryString =
        'origins[origin][in]=wethrift.com,simplycodes.com&origins[urlSlug][like]=example';
      const parsed = parseQueryString(queryString);

      const mongoFilter = buildMongoFilter(parsed);

      expect(mongoFilter).toEqual({
        'origins.origin': { $in: ['wethrift.com', 'simplycodes.com'] },
        'origins.urlSlug': { $regex: 'example' },
      });
    });
  });

  describe('Round-trip consistency', () => {
    it('should parse and rebuild scalar filters consistently', () => {
      const original = { status: 'published', count: { gte: 10 }, name: { like: 'test' } };
      const params = buildSearchParams(original);
      const parsed = parseQueryString(params.toString());

      expect(parsed).toEqual(original);
    });

    it('should parse and rebuild nested filters consistently', () => {
      const original = {
        traffic: {
          organic: {
            etv: { gt: 1000 },
          },
        },
      };
      const params = buildSearchParams(original);
      const parsed = parseQueryString(params.toString());

      expect(parsed).toEqual(original);
    });

    it('should parse and rebuild single-value array filters consistently', () => {
      // Single values in array operators round-trip correctly
      const original = { status: { in: ['active'] }, tags: { nin: ['spam'] } };
      const params = buildSearchParams(original);
      const parsed = parseQueryString(params.toString());

      expect(parsed).toEqual(original);
    });

    it('should handle multi-value arrays (qs comma format limitation)', () => {
      // Note: Multi-value arrays with comma format have a known round-trip limitation
      // When serialized as `status[in]=a,b` and parsed back, qs treats it as single string
      // This is expected behavior - use bracket format if exact round-trip is needed
      const original = { status: { in: ['active', 'pending'] } };
      const params = buildSearchParams(original);
      const decoded = decodeURIComponent(params.toString());

      // Verify serialization is correct
      expect(decoded).toBe('status[in]=active,pending');

      // Parsing from raw query string works correctly
      const parsed = parseQueryString('status[in]=active,pending');
      expect(parsed).toEqual(original);
    });
  });
});
