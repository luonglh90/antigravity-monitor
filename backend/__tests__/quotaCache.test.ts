import * as assert from 'assert';
import { QuotaCache } from '../quotaCache';

describe('QuotaCache', () => {
  let quotaCache: QuotaCache;

  beforeEach(() => {
    quotaCache = new QuotaCache();
  });

  describe('setQuota and getQuota', () => {
    it('should set and retrieve quota data', () => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };

      quotaCache.setQuota(email, quotaData);
      const retrieved = quotaCache.getQuota(email);

      assert.deepStrictEqual(retrieved, quotaData);
    });

    it('should use default TTL of 5 minutes when not specified', () => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };

      quotaCache.setQuota(email, quotaData);
      const retrieved = quotaCache.getQuota(email);

      assert.notStrictEqual(retrieved, null);
      assert.deepStrictEqual(retrieved, quotaData);
    });

    it('should accept custom TTL', () => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };
      const customTtlMs = 10000; // 10 seconds

      quotaCache.setQuota(email, quotaData, customTtlMs);
      const retrieved = quotaCache.getQuota(email);

      assert.deepStrictEqual(retrieved, quotaData);
    });

    it('should return null for non-existent email', () => {
      const retrieved = quotaCache.getQuota('nonexistent@example.com');
      assert.strictEqual(retrieved, null);
    });

    it('should throw error when email is missing', () => {
      const quotaData = { models: 100, used: 50 };

      assert.throws(() => {
        quotaCache.setQuota('', quotaData);
      }, /Email is required/);

      assert.throws(() => {
        quotaCache.getQuota('');
      }, /Email is required/);
    });

    it('should throw error when quota data is missing', () => {
      const email = 'test@example.com';

      assert.throws(() => {
        quotaCache.setQuota(email, null as any);
      }, /Quota data is required/);
    });
  });

  describe('cache expiration', () => {
    it('should return null for expired cache entries', (done) => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };
      const shortTtlMs = 100; // 100ms

      quotaCache.setQuota(email, quotaData, shortTtlMs);

      // Verify data is cached initially
      assert.deepStrictEqual(quotaCache.getQuota(email), quotaData);

      // Wait for cache to expire
      setTimeout(() => {
        const retrieved = quotaCache.getQuota(email);
        assert.strictEqual(retrieved, null);
        done();
      }, 150);
    });

    it('should not return expired data even if cache entry exists', (done) => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };
      const shortTtlMs = 50; // 50ms

      quotaCache.setQuota(email, quotaData, shortTtlMs);

      setTimeout(() => {
        const retrieved = quotaCache.getQuota(email);
        assert.strictEqual(retrieved, null);
        done();
      }, 100);
    });
  });

  describe('invalidateQuota', () => {
    it('should remove cached quota data', () => {
      const email = 'test@example.com';
      const quotaData = { models: 100, used: 50 };

      quotaCache.setQuota(email, quotaData);
      assert.deepStrictEqual(quotaCache.getQuota(email), quotaData);

      quotaCache.invalidateQuota(email);
      assert.strictEqual(quotaCache.getQuota(email), null);
    });

    it('should handle invalidation of non-existent entries gracefully', () => {
      // Should not throw error
      assert.doesNotThrow(() => {
        quotaCache.invalidateQuota('nonexistent@example.com');
      });
    });

    it('should throw error when email is missing', () => {
      assert.throws(() => {
        quotaCache.invalidateQuota('');
      }, /Email is required/);
    });
  });

  describe('clearAllQuotas', () => {
    it('should clear all cached quota entries', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      const quotaData = { models: 100, used: 50 };

      quotaCache.setQuota(email1, quotaData);
      quotaCache.setQuota(email2, quotaData);

      assert.deepStrictEqual(quotaCache.getQuota(email1), quotaData);
      assert.deepStrictEqual(quotaCache.getQuota(email2), quotaData);

      quotaCache.clearAllQuotas();

      assert.strictEqual(quotaCache.getQuota(email1), null);
      assert.strictEqual(quotaCache.getQuota(email2), null);
    });

    it('should handle clearing empty cache gracefully', () => {
      // Should not throw error
      assert.doesNotThrow(() => {
        quotaCache.clearAllQuotas();
      });
    });
  });

  describe('multiple accounts', () => {
    it('should maintain separate cache entries for different accounts', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      const quotaData1 = { models: 100, used: 50 };
      const quotaData2 = { models: 200, used: 100 };

      quotaCache.setQuota(email1, quotaData1);
      quotaCache.setQuota(email2, quotaData2);

      assert.deepStrictEqual(quotaCache.getQuota(email1), quotaData1);
      assert.deepStrictEqual(quotaCache.getQuota(email2), quotaData2);
    });

    it('should invalidate one account without affecting others', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      const quotaData = { models: 100, used: 50 };

      quotaCache.setQuota(email1, quotaData);
      quotaCache.setQuota(email2, quotaData);

      quotaCache.invalidateQuota(email1);

      assert.strictEqual(quotaCache.getQuota(email1), null);
      assert.deepStrictEqual(quotaCache.getQuota(email2), quotaData);
    });

    it('should allow updating quota for same account', () => {
      const email = 'test@example.com';
      const quotaData1 = { models: 100, used: 50 };
      const quotaData2 = { models: 150, used: 75 };

      quotaCache.setQuota(email, quotaData1);
      assert.deepStrictEqual(quotaCache.getQuota(email), quotaData1);

      quotaCache.setQuota(email, quotaData2);
      assert.deepStrictEqual(quotaCache.getQuota(email), quotaData2);
    });
  });
});
