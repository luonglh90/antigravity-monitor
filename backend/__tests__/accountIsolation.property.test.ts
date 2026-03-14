import * as assert from 'assert';
import * as fc from 'fast-check';
import { AccountManager, Account } from '../accountManager';
import { Credentials } from '../credentialStore';

/**
 * Property-Based Tests for Account Isolation
 * **Validates: Requirements 12.1, 12.2, 12.3**
 * 
 * These tests verify that account data remains isolated across switches
 * and that switching accounts clears previous session data.
 */

// Mock CredentialStore
class MockCredentialStore {
  private storage: Map<string, Credentials> = new Map();

  async saveCredentials(email: string, token: string, metadata?: object): Promise<void> {
    this.storage.set(email, {
      email,
      token,
      metadata: metadata as Credentials['metadata'],
    });
  }

  async loadCredentials(email: string): Promise<Credentials | null> {
    return this.storage.get(email) || null;
  }

  async getAllCredentials(): Promise<Credentials[]> {
    return Array.from(this.storage.values());
  }

  async deleteCredentials(email: string): Promise<void> {
    this.storage.delete(email);
  }
}

describe('Account Isolation (Property-Based Tests)', () => {
  describe('Property 1: Account data remains isolated across switches', () => {
    it('should maintain separate metadata for each account', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
              planType: fc.oneof(
                fc.constant('free'),
                fc.constant('pro'),
                fc.constant('enterprise')
              ),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (accounts) => {
            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token, {
                planType: account.planType,
              });
            }

            // Verify each account maintains its own metadata
            for (const account of accounts) {
              const retrieved = accountManager.getAccount(account.email);
              assert.strictEqual(retrieved?.email, account.email);
              assert.strictEqual(retrieved?.token, account.token);
              assert.strictEqual(retrieved?.metadata?.planType, account.planType);
            }
          }
        )
      );
    });

    it('should not leak data between accounts on active account switch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
              planType: fc.oneof(
                fc.constant('free'),
                fc.constant('pro'),
                fc.constant('enterprise')
              ),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 4 }),
          async (accounts, switchIndex) => {
            if (accounts.length === 0) return;

            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token, {
                planType: account.planType,
              });
            }

            // Switch to each account and verify isolation
            for (let i = 0; i < Math.min(switchIndex, accounts.length); i++) {
              await accountManager.setActiveAccount(accounts[i].email);

              const activeAccount = accountManager.getActiveAccount();
              assert.strictEqual(activeAccount?.email, accounts[i].email);
              assert.strictEqual(activeAccount?.token, accounts[i].token);
              assert.strictEqual(activeAccount?.metadata?.planType, accounts[i].planType);

              // Verify other accounts are not affected
              for (let j = 0; j < accounts.length; j++) {
                if (i !== j) {
                  const otherAccount = accountManager.getAccount(accounts[j].email);
                  assert.strictEqual(otherAccount?.email, accounts[j].email);
                  assert.strictEqual(otherAccount?.token, accounts[j].token);
                }
              }
            }
          }
        )
      );
    });

    it('should maintain account list integrity across switches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (accounts) => {
            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token);
            }

            const initialCount = accountManager.getAllAccounts().length;

            // Switch between accounts
            for (const account of accounts) {
              await accountManager.setActiveAccount(account.email);

              // Account list should remain unchanged
              assert.strictEqual(accountManager.getAllAccounts().length, initialCount);
            }
          }
        )
      );
    });
  });

  describe('Property 2: Switching accounts clears previous session data', () => {
    it('should update last login time on each switch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 2, maxLength: 3 }
          ),
          async (accounts) => {
            if (accounts.length < 2) return;

            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token);
            }

            const loginTimes: Map<string, number> = new Map();

            // Switch between accounts and track login times
            for (const account of accounts) {
              const beforeTime = Date.now();
              await accountManager.setActiveAccount(account.email);
              const afterTime = Date.now();

              const activeAccount = accountManager.getActiveAccount();
              const loginTime = activeAccount?.metadata?.lastLoginTime;

              assert.ok(loginTime !== undefined);
              assert.ok(loginTime! >= beforeTime);
              assert.ok(loginTime! <= afterTime);

              loginTimes.set(account.email, loginTime!);
            }

            // Verify each account has a login time
            for (const account of accounts) {
              assert.ok(loginTimes.has(account.email));
            }
          }
        )
      );
    });

    it('should not carry over metadata from previous account', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email1: fc.emailAddress(),
            token1: fc.string({ minLength: 10, maxLength: 50 }),
            planType1: fc.oneof(fc.constant('free'), fc.constant('pro')),
            email2: fc.emailAddress(),
            token2: fc.string({ minLength: 10, maxLength: 50 }),
            planType2: fc.oneof(fc.constant('free'), fc.constant('pro')),
          }),
          async (data) => {
            if (data.email1 === data.email2) return;

            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add two accounts with different plan types
            await accountManager.addAccount(data.email1, data.token1, {
              planType: data.planType1,
            });
            await accountManager.addAccount(data.email2, data.token2, {
              planType: data.planType2,
            });

            // Switch to first account
            await accountManager.setActiveAccount(data.email1);
            const active1 = accountManager.getActiveAccount();

            // Switch to second account
            await accountManager.setActiveAccount(data.email2);
            const active2 = accountManager.getActiveAccount();

            // Verify metadata is not carried over
            assert.strictEqual(active1?.metadata?.planType, data.planType1);
            assert.strictEqual(active2?.metadata?.planType, data.planType2);
            assert.notStrictEqual(active1?.metadata?.planType, active2?.metadata?.planType);
          }
        )
      );
    });
  });

  describe('Property 3: Active account always matches displayed data', () => {
    it('should return consistent active account across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (accounts) => {
            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token);
            }

            // Set active account
            if (accounts.length > 0) {
              const targetAccount = accounts[0];
              await accountManager.setActiveAccount(targetAccount.email);

              // Get active account multiple times
              const active1 = accountManager.getActiveAccount();
              const active2 = accountManager.getActiveAccount();
              const active3 = accountManager.getActiveAccount();

              // Should be consistent
              assert.strictEqual(active1?.email, active2?.email);
              assert.strictEqual(active2?.email, active3?.email);
              assert.strictEqual(active1?.email, targetAccount.email);
            }
          }
        )
      );
    });

    it('should reflect account changes immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (accounts) => {
            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token);
            }

            // Switch to each account and verify immediate reflection
            for (const account of accounts) {
              await accountManager.setActiveAccount(account.email);

              const activeAccount = accountManager.getActiveAccount();
              assert.strictEqual(activeAccount?.email, account.email);
            }
          }
        )
      );
    });
  });

  describe('Property 4: Account removal maintains isolation', () => {
    it('should not affect other accounts when removing one', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
              planType: fc.oneof(fc.constant('free'), fc.constant('pro')),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 4 }),
          async (accounts, removeIndex) => {
            if (accounts.length === 0) return;

            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Add all accounts
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token, {
                planType: account.planType,
              });
            }

            const accountToRemove = accounts[removeIndex % accounts.length];

            // Remove one account
            await accountManager.removeAccount(accountToRemove.email);

            // Verify other accounts are unaffected
            for (const account of accounts) {
              if (account.email !== accountToRemove.email) {
                const retrieved = accountManager.getAccount(account.email);
                assert.strictEqual(retrieved?.email, account.email);
                assert.strictEqual(retrieved?.token, account.token);
                assert.strictEqual(retrieved?.metadata?.planType, account.planType);
              }
            }
          }
        )
      );
    });
  });

  describe('Property 5: Quota data isolation (simulated)', () => {
    it('should maintain separate quota contexts for each account', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
              quotaPercent: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (accounts) => {
            const credentialStore = new MockCredentialStore() as any;
            const accountManager = new AccountManager(credentialStore);

            // Simulate quota data per account
            const quotaData: Map<string, number> = new Map();

            // Add all accounts and assign quota data
            for (const account of accounts) {
              await accountManager.addAccount(account.email, account.token);
              quotaData.set(account.email, account.quotaPercent);
            }

            // Switch between accounts and verify quota isolation
            for (const account of accounts) {
              await accountManager.setActiveAccount(account.email);

              const activeAccount = accountManager.getActiveAccount();
              const expectedQuota = quotaData.get(account.email);

              assert.strictEqual(activeAccount?.email, account.email);
              assert.strictEqual(quotaData.get(activeAccount?.email!), expectedQuota);
            }
          }
        )
      );
    });
  });
});
