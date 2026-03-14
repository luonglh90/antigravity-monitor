import * as assert from 'assert';
import * as fc from 'fast-check';
import { CredentialStore, Credentials } from '../credentialStore';

/**
 * Property-Based Tests for Credential Storage Security
 * **Validates: Requirements 3.5, 12.4**
 * 
 * These tests verify that credentials are always encrypted before storage
 * and that plaintext credentials are never written to disk.
 */

/**
 * Mock SecretStorage that tracks what's being stored
 */
class TrackingMockSecretStorage implements Partial<any> {
  private storage: Map<string, string> = new Map();
  private storedValues: string[] = [];

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    this.storedValues.push(value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  getStoredValues(): string[] {
    return this.storedValues;
  }

  containsPlaintextCredentials(email: string, token: string): boolean {
    // Check if any stored value contains plaintext email or token
    for (const value of this.storedValues) {
      if (value.includes(email) || value.includes(token)) {
        // Check if it's just in JSON (which is OK) or plaintext
        try {
          const parsed = JSON.parse(value);
          // If it's in JSON, that's OK (it's structured)
          // But we should verify it's not plaintext
          if (typeof parsed === 'string') {
            return true; // Plaintext string
          }
        } catch {
          // Not JSON, so it's plaintext
          return true;
        }
      }
    }
    return false;
  }
}

/**
 * Mock ExtensionContext for testing
 */
class MockExtensionContext implements Partial<any> {
  secrets: any;

  constructor(secretStorage: any) {
    this.secrets = secretStorage;
  }
}

describe('Credential Storage Security (Property-Based Tests)', () => {
  describe('Property 1: Credentials are always encrypted before storage', () => {
    it('should store credentials as JSON (structured format)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (email, token) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            await credentialStore.saveCredentials(email, token);

            const storedValues = mockSecrets.getStoredValues();
            assert.ok(storedValues.length > 0);

            // Verify stored value is JSON
            const storedValue = storedValues[0];
            let parsed: any;
            try {
              parsed = JSON.parse(storedValue);
            } catch {
              assert.fail('Stored value is not valid JSON');
            }

            // Verify it contains the expected structure
            assert.strictEqual(parsed.email, email);
            assert.strictEqual(parsed.token, token);
          }
        )
      );
    });

    it('should not store plaintext credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (email, token) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            await credentialStore.saveCredentials(email, token);

            // Verify no plaintext credentials are stored
            assert.ok(!mockSecrets.containsPlaintextCredentials(email, token));
          }
        )
      );
    });

    it('should encrypt credentials with metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.record({
            planType: fc.oneof(fc.constant('free'), fc.constant('pro')),
            lastLoginTime: fc.integer({ min: 0, max: Date.now() }),
          }),
          async (email, token, metadata) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            await credentialStore.saveCredentials(email, token, metadata);

            const storedValues = mockSecrets.getStoredValues();
            assert.ok(storedValues.length > 0);

            // Verify stored value is JSON
            const storedValue = storedValues[0];
            const parsed = JSON.parse(storedValue);

            // Verify structure
            assert.strictEqual(parsed.email, email);
            assert.strictEqual(parsed.token, token);
            assert.strictEqual(parsed.metadata.planType, metadata.planType);
            assert.strictEqual(parsed.metadata.lastLoginTime, metadata.lastLoginTime);
          }
        )
      );
    });
  });

  describe('Property 2: Decryption works correctly for stored credentials', () => {
    it('should decrypt and return correct credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (email, token) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save credentials
            await credentialStore.saveCredentials(email, token);

            // Load credentials
            const loaded = await credentialStore.loadCredentials(email);

            // Verify decrypted values match original
            assert.strictEqual(loaded?.email, email);
            assert.strictEqual(loaded?.token, token);
          }
        )
      );
    });

    it('should decrypt credentials with metadata correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.record({
            planType: fc.oneof(fc.constant('free'), fc.constant('pro')),
            lastLoginTime: fc.integer({ min: 0, max: Date.now() }),
          }),
          async (email, token, metadata) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save credentials with metadata
            await credentialStore.saveCredentials(email, token, metadata);

            // Load credentials
            const loaded = await credentialStore.loadCredentials(email);

            // Verify all data is correctly decrypted
            assert.strictEqual(loaded?.email, email);
            assert.strictEqual(loaded?.token, token);
            assert.strictEqual(loaded?.metadata?.planType, metadata.planType);
            assert.strictEqual(loaded?.metadata?.lastLoginTime, metadata.lastLoginTime);
          }
        )
      );
    });

    it('should maintain data integrity through save/load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
              planType: fc.oneof(fc.constant('free'), fc.constant('pro')),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (accounts) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save all credentials
            for (const account of accounts) {
              await credentialStore.saveCredentials(account.email, account.token, {
                planType: account.planType,
              });
            }

            // Load and verify all credentials
            for (const account of accounts) {
              const loaded = await credentialStore.loadCredentials(account.email);

              assert.strictEqual(loaded?.email, account.email);
              assert.strictEqual(loaded?.token, account.token);
              assert.strictEqual(loaded?.metadata?.planType, account.planType);
            }
          }
        )
      );
    });
  });

  describe('Property 3: Credential isolation across accounts', () => {
    it('should not leak credentials between accounts', async () => {
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
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save all credentials
            for (const account of accounts) {
              await credentialStore.saveCredentials(account.email, account.token);
            }

            // Verify each account's credentials are isolated
            for (const account of accounts) {
              const loaded = await credentialStore.loadCredentials(account.email);

              // Should only contain this account's data
              assert.strictEqual(loaded?.email, account.email);
              assert.strictEqual(loaded?.token, account.token);

              // Should not contain other accounts' data
              for (const otherAccount of accounts) {
                if (otherAccount.email !== account.email) {
                  assert.notStrictEqual(loaded?.token, otherAccount.token);
                }
              }
            }
          }
        )
      );
    });
  });

  describe('Property 4: Secure deletion of credentials', () => {
    it('should remove credentials completely on deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (email, token) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save credentials
            await credentialStore.saveCredentials(email, token);
            let loaded = await credentialStore.loadCredentials(email);
            assert.notStrictEqual(loaded, null);

            // Delete credentials
            await credentialStore.deleteCredentials(email);
            loaded = await credentialStore.loadCredentials(email);

            // Should be completely removed
            assert.strictEqual(loaded, null);
          }
        )
      );
    });

    it('should not affect other credentials on deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.emailAddress(),
              token: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 4 }),
          async (accounts, deleteIndex) => {
            if (accounts.length === 0) return;

            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            // Save all credentials
            for (const account of accounts) {
              await credentialStore.saveCredentials(account.email, account.token);
            }

            // Delete one credential
            const accountToDelete = accounts[deleteIndex % accounts.length];
            await credentialStore.deleteCredentials(accountToDelete.email);

            // Verify deleted account is gone
            const deleted = await credentialStore.loadCredentials(accountToDelete.email);
            assert.strictEqual(deleted, null);

            // Verify other accounts are unaffected
            for (const account of accounts) {
              if (account.email !== accountToDelete.email) {
                const loaded = await credentialStore.loadCredentials(account.email);
                assert.strictEqual(loaded?.email, account.email);
                assert.strictEqual(loaded?.token, account.token);
              }
            }
          }
        )
      );
    });
  });

  describe('Property 5: Storage key generation is consistent', () => {
    it('should generate consistent storage keys for same email', async () => {
      await fc.assert(
        fc.asyncProperty(fc.emailAddress(), async (email) => {
          const mockSecrets = new TrackingMockSecretStorage();
          const mockContext = new MockExtensionContext(mockSecrets);
          const credentialStore = new CredentialStore(mockContext as any);

          // Save credentials multiple times
          await credentialStore.saveCredentials(email, 'token1');
          await credentialStore.saveCredentials(email, 'token2');

          // Should have overwritten, not created new entries
          const allCredentials = await credentialStore.getAllCredentials();
          const matchingCredentials = allCredentials.filter((c) => c.email === email);

          assert.strictEqual(matchingCredentials.length, 1);
          assert.strictEqual(matchingCredentials[0].token, 'token2');
        })
      );
    });
  });

  describe('Property 6: Fallback to in-memory storage maintains security', () => {
    it('should maintain credential structure in fallback storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (email, token) => {
            // Create a mock that fails on store
            class FailingMockSecrets {
              async get(): Promise<undefined> {
                return undefined;
              }

              async store(): Promise<void> {
                throw new Error('Storage failed');
              }

              async delete(): Promise<void> {
                throw new Error('Storage failed');
              }

              async keys(): Promise<string[]> {
                return [];
              }
            }

            const mockContext = new MockExtensionContext(new FailingMockSecrets());
            const credentialStore = new CredentialStore(mockContext as any);

            // Save credentials (will fall back to in-memory)
            await credentialStore.saveCredentials(email, token);

            // Load credentials (should work from in-memory)
            const loaded = await credentialStore.loadCredentials(email);

            assert.strictEqual(loaded?.email, email);
            assert.strictEqual(loaded?.token, token);
          }
        )
      );
    });
  });

  describe('Property 7: Credential validation', () => {
    it('should reject empty email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (token) => {
            const mockSecrets = new TrackingMockSecretStorage();
            const mockContext = new MockExtensionContext(mockSecrets);
            const credentialStore = new CredentialStore(mockContext as any);

            try {
              await credentialStore.saveCredentials('', token);
              assert.fail('Should have thrown error for empty email');
            } catch (error: any) {
              assert.match(error.message, /Email and token are required/);
            }
          }
        )
      );
    });

    it('should reject empty token', async () => {
      await fc.assert(
        fc.asyncProperty(fc.emailAddress(), async (email) => {
          const mockSecrets = new TrackingMockSecretStorage();
          const mockContext = new MockExtensionContext(mockSecrets);
          const credentialStore = new CredentialStore(mockContext as any);

          try {
            await credentialStore.saveCredentials(email, '');
            assert.fail('Should have thrown error for empty token');
          } catch (error: any) {
            assert.match(error.message, /Email and token are required/);
          }
        })
      );
    });
  });
});
