import * as assert from 'assert';
import * as fc from 'fast-check';
import { QuotaCache } from '../quotaCache';

/**
 * Property-Based Tests for Quota Cache TTL
 * **Validates: Requirements 15.1, 15.3, 15.4**
 * 
 * These tests verify that cache entries expire correctly after TTL
 * and that expired data is not returned to the user.
 */

describe('Quota Cache TTL (Property-Based Tests)', () => {
  describe('Property 1: Cache entries expire correctly after TTL', () => {
    it('should return cached data before TTL expires', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          fc.integer({ min: 100, max: 5000 }),
          (email, quotaData, ttlMs) => {
            const cache = new QuotaCache();

            cache.setQuota(email, quotaData, ttlMs);
            const retrieved = cache.getQuota(email);

            assert.deepStrictEqual(retrieved, quotaData);
          }
        )
      );
    });

    it('should return null for expired cache entries', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();
            const shortTtlMs = 50; // 50ms

            cache.setQuota(email, quotaData, shortTtlMs);

            // Verify data is cached initially
            assert.deepStrictEqual(cache.getQuota(email), quotaData);

            // Wait for cache to expire
            setTimeout(() => {
              const retrieved = cache.getQuota(email);
              assert.strictEqual(retrieved, null);
              done();
            }, 100);
          }
        )
      );
    });

    it('should respect custom TTL values', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          fc.integer({ min: 50, max: 200 }),
          (email, quotaData, ttlMs) => {
            const cache = new QuotaCache();

            cache.setQuota(email, quotaData, ttlMs);

            // Verify data is cached initially
            assert.deepStrictEqual(cache.getQuota(email), quotaData);

            // Wait for cache to expire
            setTimeout(() => {
              const retrieved = cache.getQuota(email);
              assert.strictEqual(retrieved, null);
              done();
            }, ttlMs + 50);
          }
        )
      );
    });

    it('should use default TTL when not specified', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();

            // Set without TTL (should use default 5 minutes)
            cache.setQuota(email, quotaData);

            // Verify data is cached
            assert.deepStrictEqual(cache.getQuota(email), quotaData);

            // Data should still be available after short delay
            setTimeout(() => {
              const retrieved = cache.getQuota(email);
              assert.deepStrictEqual(retrieved, quotaData);
              done();
            }, 100);
          }
        )
      );
    });
  });

  describe('Property 2: Expired data is not returned', () => {
    it('should not return expired data even if cache entry exists', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();
            const shortTtlMs = 50; // 50ms

            cache.setQuota(email, quotaData, shortTtlMs);

            setTimeout(() => {
              const retrieved = cache.getQuota(email);
              assert.strictEqual(retrieved, null);
              done();
            }, 100);
          }
        )
      );
    });

    it('should return null consistently after expiration', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();
            const shortTtlMs = 50; // 50ms

            cache.setQuota(email, quotaData, shortTtlMs);

            setTimeout(() => {
              // Multiple calls after expiration should all return null
              const retrieved1 = cache.getQuota(email);
              const retrieved2 = cache.getQuota(email);
              const retrieved3 = cache.getQuota(email);

              assert.strictEqual(retrieved1, null);
              assert.strictEqual(retrieved2, null);
              assert.strictEqual(retrieved3, null);
              done();
            }, 100);
          }
        )
      );
    });
  });

  describe('Property 3: Cache invalidation works immediately', () => {
    it('should remove cached quota data immediately on invalidation', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          fc.integer({ min: 100, max: 5000 }),
          (email, quotaData, ttlMs) => {
            const cache = new QuotaCache();

            cache.setQuota(email, quotaData, ttlMs);
            assert.deepStrictEqual(cache.getQuota(email), quotaData);

            cache.invalidateQuota(email);
            assert.strictEqual(cache.getQuota(email), null);
          }
        )
      );
    });

    it('should handle invalidation of non-existent entries gracefully', () => {
      fc.assert(
        fc.property(fc.emailAddress(), (email) => {
          const cache = new QuotaCache();

          // Should not throw error
          assert.doesNotThrow(() => {
            cache.invalidateQuota(email);
          });
        })
      );
    });

    it('should invalidate one account without affecting others', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              quotaData: fc.object({ maxDepth: 2 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 4 }),
          (accounts, invalidateIndex) => {
            if (accounts.length === 0) return;

            const cache = new QuotaCache();

            // Set quota for all accounts
            for (const account of accounts) {
              cache.setQuota(account.email, account.quotaData);
            }

            // Invalidate one account
            const accountToInvalidate = accounts[invalidateIndex % accounts.length];
            cache.invalidateQuota(accountToInvalidate.email);

            // Verify invalidated account has no cache
            assert.strictEqual(cache.getQuota(accountToInvalidate.email), null);

            // Verify other accounts still have cache
            for (const account of accounts) {
              if (account.email !== accountToInvalidate.email) {
                assert.deepStrictEqual(cache.getQuota(account.email), account.quotaData);
              }
            }
          }
        )
      );
    });
  });

  describe('Property 4: Multiple accounts maintain separate TTLs', () => {
    it('should maintain separate expiration times for different accounts', (done) => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              quotaData: fc.object({ maxDepth: 2 }),
              ttlMs: fc.integer({ min: 50, max: 150 }),
            }),
            { minLength: 2, maxLength: 3 }
          ),
          (accounts) => {
            if (accounts.length < 2) return;

            const cache = new QuotaCache();

            // Set quota for all accounts with different TTLs
            for (const account of accounts) {
              cache.setQuota(account.email, account.quotaData, account.ttlMs);
            }

            // Verify all are cached initially
            for (const account of accounts) {
              assert.deepStrictEqual(cache.getQuota(account.email), account.quotaData);
            }

            // Wait for shortest TTL to expire
            const minTtl = Math.min(...accounts.map((a) => a.ttlMs));

            setTimeout(() => {
              // At least one should have expired
              let expiredCount = 0;
              for (const account of accounts) {
                if (cache.getQuota(account.email) === null) {
                  expiredCount++;
                }
              }

              assert.ok(expiredCount > 0);
              done();
            }, minTtl + 50);
          }
        )
      );
    });
  });

  describe('Property 5: Cache update resets TTL', () => {
    it('should reset TTL when quota is updated', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          fc.object({ maxDepth: 2 }),
          (email, quotaData1, quotaData2) => {
            const cache = new QuotaCache();
            const shortTtlMs = 50; // 50ms

            // Set initial quota
            cache.setQuota(email, quotaData1, shortTtlMs);

            // Wait for it to almost expire
            setTimeout(() => {
              // Update quota (should reset TTL)
              cache.setQuota(email, quotaData2, shortTtlMs);

              // Should still be available
              const retrieved = cache.getQuota(email);
              assert.deepStrictEqual(retrieved, quotaData2);

              // Wait for new TTL to expire
              setTimeout(() => {
                const expired = cache.getQuota(email);
                assert.strictEqual(expired, null);
                done();
              }, 60);
            }, 40);
          }
        )
      );
    });
  });

  describe('Property 6: Clear all quotas removes all entries', () => {
    it('should clear all cached quota entries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              quotaData: fc.object({ maxDepth: 2 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (accounts) => {
            const cache = new QuotaCache();

            // Set quota for all accounts
            for (const account of accounts) {
              cache.setQuota(account.email, account.quotaData);
            }

            // Verify all are cached
            for (const account of accounts) {
              assert.deepStrictEqual(cache.getQuota(account.email), account.quotaData);
            }

            // Clear all
            cache.clearAllQuotas();

            // Verify all are cleared
            for (const account of accounts) {
              assert.strictEqual(cache.getQuota(account.email), null);
            }
          }
        )
      );
    });

    it('should handle clearing empty cache gracefully', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const cache = new QuotaCache();

          // Should not throw
          assert.doesNotThrow(() => {
            cache.clearAllQuotas();
          });

          return true;
        })
      );
    });
  });

  describe('Property 7: TTL boundary conditions', () => {
    it('should handle very small TTL values', (done) => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();
            const verySmallTtlMs = 10; // 10ms

            cache.setQuota(email, quotaData, verySmallTtlMs);

            setTimeout(() => {
              const retrieved = cache.getQuota(email);
              assert.strictEqual(retrieved, null);
              done();
            }, 50);
          }
        )
      );
    });

    it('should handle very large TTL values', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();
            const veryLargeTtlMs = 1000 * 60 * 60; // 1 hour

            cache.setQuota(email, quotaData, veryLargeTtlMs);

            // Should still be cached after short delay
            const retrieved = cache.getQuota(email);
            assert.deepStrictEqual(retrieved, quotaData);
          }
        )
      );
    });

    it('should handle zero TTL gracefully', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.object({ maxDepth: 2 }),
          (email, quotaData) => {
            const cache = new QuotaCache();

            // Zero TTL should expire immediately
            cache.setQuota(email, quotaData, 0);

            // Should be expired immediately
            const retrieved = cache.getQuota(email);
            assert.strictEqual(retrieved, null);
          }
        )
      );
    });
  });
});
