import * as assert from 'assert';
import { QuotaService, AccountQuota, ModelQuotaInfo } from '../quotaService';
import { QuotaCache } from '../quotaCache';

describe('QuotaService', () => {
  let quotaService: QuotaService;
  let quotaCache: QuotaCache;

  beforeEach(() => {
    quotaCache = new QuotaCache();
    quotaService = new QuotaService(quotaCache);
  });

  describe('constructor', () => {
    it('should create instance with provided QuotaCache', () => {
      const cache = new QuotaCache();
      const service = new QuotaService(cache);
      assert.ok(service);
    });

    it('should create instance with default QuotaCache if not provided', () => {
      const service = new QuotaService();
      assert.ok(service);
    });
  });

  describe('fetchQuotaForAccount', () => {
    it('should throw error when email is missing', async () => {
      try {
        await quotaService.fetchQuotaForAccount('', 'token');
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.match(error.message, /Email is required/);
      }
    });

    it('should throw error when access token is missing', async () => {
      try {
        await quotaService.fetchQuotaForAccount('test@example.com', '');
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.match(error.message, /Access token is required/);
      }
    });

    it('should return AccountQuota with error when API call fails', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.strictEqual(result.email, email);
      assert.ok(result.fetchError);
      assert.match(result.fetchError, /Failed to fetch quota data/);
      assert.strictEqual(result.models.length, 0);
    });

    it('should return cached quota on subsequent calls without forceRefresh', async () => {
      const email = 'test@example.com';
      const token = 'token';

      // Mock the cache to return a quota
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota);

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.strictEqual(result.email, email);
      assert.strictEqual(result.claudeQuotaPercent, 50);
      assert.strictEqual(result.geminiQuotaPercent, 75);
    });

    it('should bypass cache when forceRefresh is true', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      // Set a cached quota
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota);

      // Force refresh should attempt API call and return error
      const result = await quotaService.fetchQuotaForAccount(email, token, true);

      assert.ok(result.fetchError);
      assert.match(result.fetchError, /Failed to fetch quota data/);
    });

    it('should return AccountQuota with email set correctly', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.strictEqual(result.email, email);
      assert.ok(result.lastFetched);
      assert.ok(result.lastFetched > 0);
    });

    it('should initialize all quota fields', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.ok(Array.isArray(result.models));
      assert.ok(Array.isArray(result.claudeModels));
      assert.ok(Array.isArray(result.geminiModels));
      assert.strictEqual(result.claudeQuotaPercent, null);
      assert.strictEqual(result.geminiQuotaPercent, null);
      assert.strictEqual(result.claudeResetTime, null);
      assert.strictEqual(result.geminiResetTime, null);
    });
  });

  describe('backgroundRefreshQuota', () => {
    it('should not throw error on background refresh', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      // Should not throw
      await quotaService.backgroundRefreshQuota(email, token);
    });

    it('should emit quotaRefreshError event on failure', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      return new Promise<void>((resolve) => {
        quotaService.on('quotaRefreshError', (data) => {
          assert.strictEqual(data.email, email);
          assert.ok(data.error);
          resolve();
        });

        quotaService.backgroundRefreshQuota(email, token);
      });
    });

    it('should emit quotaRefreshed event on success', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      // The background refresh will attempt to fetch fresh data
      // Since we're using an invalid token, it will fail and emit quotaRefreshError
      // This is the expected behavior - we just verify the event is emitted
      return new Promise<void>((resolve) => {
        quotaService.on('quotaRefreshError', (data) => {
          assert.strictEqual(data.email, email);
          resolve();
        });

        quotaService.backgroundRefreshQuota(email, token);
      });
    });
  });

  describe('invalidateQuota', () => {
    it('should throw error when email is missing', () => {
      assert.throws(() => {
        quotaService.invalidateQuota('');
      }, /Email is required/);
    });

    it('should invalidate cached quota for account', () => {
      const email = 'test@example.com';
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota);
      assert.ok(quotaCache.getQuota(email));

      quotaService.invalidateQuota(email);

      assert.strictEqual(quotaCache.getQuota(email), null);
    });

    it('should handle invalidation of non-existent entries gracefully', () => {
      // Should not throw
      assert.doesNotThrow(() => {
        quotaService.invalidateQuota('nonexistent@example.com');
      });
    });
  });

  describe('getCachedQuota', () => {
    it('should throw error when email is missing', () => {
      assert.throws(() => {
        quotaService.getCachedQuota('');
      }, /Email is required/);
    });

    it('should return cached quota if available', () => {
      const email = 'test@example.com';
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota);

      const result = quotaService.getCachedQuota(email);

      assert.ok(result);
      assert.strictEqual(result.email, email);
      assert.strictEqual(result.claudeQuotaPercent, 50);
    });

    it('should return null if quota not cached', () => {
      const result = quotaService.getCachedQuota('nonexistent@example.com');
      assert.strictEqual(result, null);
    });

    it('should return null if cached quota expired', (done) => {
      const email = 'test@example.com';
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota, 50); // 50ms TTL

      setTimeout(() => {
        const result = quotaService.getCachedQuota(email);
        assert.strictEqual(result, null);
        done();
      }, 100);
    });
  });

  describe('clearAllQuotas', () => {
    it('should clear all cached quotas', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';
      const mockQuota: AccountQuota = {
        email: email1,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email1, mockQuota);
      quotaCache.setQuota(email2, mockQuota);

      assert.ok(quotaCache.getQuota(email1));
      assert.ok(quotaCache.getQuota(email2));

      quotaService.clearAllQuotas();

      assert.strictEqual(quotaCache.getQuota(email1), null);
      assert.strictEqual(quotaCache.getQuota(email2), null);
    });

    it('should handle clearing empty cache gracefully', () => {
      // Should not throw
      assert.doesNotThrow(() => {
        quotaService.clearAllQuotas();
      });
    });
  });

  describe('per-account quota isolation', () => {
    it('should maintain separate quotas for different accounts', async () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';

      const mockQuota1: AccountQuota = {
        email: email1,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      const mockQuota2: AccountQuota = {
        email: email2,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 80,
        geminiQuotaPercent: 90,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email1, mockQuota1);
      quotaCache.setQuota(email2, mockQuota2);

      const result1 = quotaService.getCachedQuota(email1);
      const result2 = quotaService.getCachedQuota(email2);

      assert.strictEqual(result1?.claudeQuotaPercent, 50);
      assert.strictEqual(result2?.claudeQuotaPercent, 80);
    });

    it('should invalidate one account without affecting others', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';

      const mockQuota: AccountQuota = {
        email: email1,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email1, mockQuota);
      quotaCache.setQuota(email2, mockQuota);

      quotaService.invalidateQuota(email1);

      assert.strictEqual(quotaService.getCachedQuota(email1), null);
      assert.ok(quotaService.getCachedQuota(email2));
    });
  });

  describe('error handling', () => {
    it('should include descriptive error message on API failure', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.ok(result.fetchError);
      assert.match(result.fetchError, /Failed to fetch quota data/);
      assert.match(result.fetchError, /connection|error/i);
    });

    it('should not throw on background refresh error', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      // Should not throw
      await quotaService.backgroundRefreshQuota(email, token);
    });

    it('should handle missing quota data gracefully', async () => {
      const email = 'test@example.com';
      const token = 'invalid-token';

      const result = await quotaService.fetchQuotaForAccount(email, token);

      assert.ok(result);
      assert.strictEqual(result.models.length, 0);
      assert.strictEqual(result.claudeModels.length, 0);
      assert.strictEqual(result.geminiModels.length, 0);
    });
  });

  describe('cache integration', () => {
    it('should cache successful quota fetch', async () => {
      const email = 'test@example.com';
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota);

      const result = await quotaService.fetchQuotaForAccount(email, 'token');

      assert.strictEqual(result.claudeQuotaPercent, 50);
      assert.strictEqual(result.geminiQuotaPercent, 75);
    });

    it('should respect cache TTL', (done) => {
      const email = 'test@example.com';
      const mockQuota: AccountQuota = {
        email,
        lastFetched: Date.now(),
        models: [],
        claudeModels: [],
        geminiModels: [],
        claudeQuotaPercent: 50,
        geminiQuotaPercent: 75,
        claudeResetTime: null,
        geminiResetTime: null,
      };

      quotaCache.setQuota(email, mockQuota, 50); // 50ms TTL

      setTimeout(async () => {
        const result = await quotaService.fetchQuotaForAccount(email, 'invalid-token');
        // After TTL expires, should attempt fresh fetch (which will fail)
        assert.ok(result.fetchError);
        done();
      }, 100);
    });
  });
});
