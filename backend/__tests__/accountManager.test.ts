import * as assert from 'assert';
import { AccountManager, Account } from '../accountManager';
import { Credentials } from '../credentialStore';

// Mock CredentialStore
class MockCredentialStore {
  private calls: { method: string; args: any[] }[] = [];
  private responses: Map<string, any> = new Map();

  async saveCredentials(email: string, token: string, metadata?: object): Promise<void> {
    this.calls.push({ method: 'saveCredentials', args: [email, token, metadata] });
  }

  async loadCredentials(email: string): Promise<Credentials | null> {
    this.calls.push({ method: 'loadCredentials', args: [email] });
    return this.responses.get(`load-${email}`) || null;
  }

  async getAllCredentials(): Promise<Credentials[]> {
    this.calls.push({ method: 'getAllCredentials', args: [] });
    return this.responses.get('getAll') || [];
  }

  async deleteCredentials(email: string): Promise<void> {
    this.calls.push({ method: 'deleteCredentials', args: [email] });
  }

  setResponse(key: string, value: any): void {
    this.responses.set(key, value);
  }

  getCalls(): { method: string; args: any[] }[] {
    return this.calls;
  }

  reset(): void {
    this.calls = [];
    this.responses.clear();
  }
}

const mockCredentialStore = new MockCredentialStore() as any;

describe('AccountManager', () => {
  let accountManager: AccountManager;

  beforeEach(() => {
    mockCredentialStore.reset();
    accountManager = new AccountManager(mockCredentialStore);
  });

  describe('initialize', () => {
    it('should load all stored credentials on initialization', async () => {
      const credentials: Credentials[] = [
        {
          email: 'user1@example.com',
          token: 'token1',
          metadata: { planType: 'pro', lastLoginTime: 1000 },
        },
        {
          email: 'user2@example.com',
          token: 'token2',
          metadata: { planType: 'free', lastLoginTime: 2000 },
        },
      ];

      mockCredentialStore.setResponse('getAll', credentials);

      await accountManager.initialize();

      assert.strictEqual(accountManager.getAllAccounts().length, 2);
      assert.deepStrictEqual(accountManager.getAccount('user1@example.com'), {
        email: 'user1@example.com',
        token: 'token1',
        metadata: { planType: 'pro', lastLoginTime: 1000 },
      });
    });

    it('should handle empty credentials on initialization', async () => {
      mockCredentialStore.setResponse('getAll', []);

      await accountManager.initialize();

      assert.strictEqual(accountManager.getAllAccounts().length, 0);
    });
  });

  describe('addAccount', () => {
    it('should add a new account successfully', async () => {
      await accountManager.addAccount('user@example.com', 'token123', {
        planType: 'pro',
      });

      const account = accountManager.getAccount('user@example.com');
      assert.strictEqual(account?.email, 'user@example.com');
      assert.strictEqual(account?.token, 'token123');
      assert.strictEqual(account?.metadata?.planType, 'pro');
    });

    it('should throw error when adding duplicate account', async () => {
      await accountManager.addAccount('user@example.com', 'token123');

      try {
        await accountManager.addAccount('user@example.com', 'token456');
        assert.fail('Should have thrown error for duplicate account');
      } catch (error: any) {
        assert.strictEqual(
          error.message,
          'Account with email user@example.com already exists'
        );
      }
    });

    it('should throw error when email is missing', async () => {
      try {
        await accountManager.addAccount('', 'token123');
        assert.fail('Should have thrown error for missing email');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Email and token are required');
      }
    });

    it('should throw error when token is missing', async () => {
      try {
        await accountManager.addAccount('user@example.com', '');
        assert.fail('Should have thrown error for missing token');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Email and token are required');
      }
    });

    it('should add account without metadata', async () => {
      await accountManager.addAccount('user@example.com', 'token123');

      const account = accountManager.getAccount('user@example.com');
      assert.strictEqual(account?.email, 'user@example.com');
      assert.strictEqual(account?.token, 'token123');
      assert.strictEqual(account?.metadata, undefined);
    });
  });

  describe('removeAccount', () => {
    beforeEach(async () => {
      await accountManager.addAccount('user1@example.com', 'token1');
      await accountManager.addAccount('user2@example.com', 'token2');
    });

    it('should remove an account successfully', async () => {
      await accountManager.removeAccount('user1@example.com');

      assert.strictEqual(accountManager.getAccount('user1@example.com'), null);
      assert.strictEqual(accountManager.getAllAccounts().length, 1);
    });

    it('should throw error when removing non-existent account', async () => {
      try {
        await accountManager.removeAccount('nonexistent@example.com');
        assert.fail('Should have thrown error for non-existent account');
      } catch (error: any) {
        assert.strictEqual(
          error.message,
          'Account with email nonexistent@example.com not found'
        );
      }
    });

    it('should throw error when email is missing', async () => {
      try {
        await accountManager.removeAccount('');
        assert.fail('Should have thrown error for missing email');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Email is required');
      }
    });

    it('should switch to another account when removing active account', async () => {
      await accountManager.setActiveAccount('user1@example.com');
      assert.strictEqual(accountManager.getActiveAccount()?.email, 'user1@example.com');

      await accountManager.removeAccount('user1@example.com');

      assert.strictEqual(accountManager.getActiveAccount()?.email, 'user2@example.com');
    });

    it('should clear active account when removing last account', async () => {
      await accountManager.removeAccount('user1@example.com');
      await accountManager.removeAccount('user2@example.com');

      assert.strictEqual(accountManager.getActiveAccount(), null);
      assert.strictEqual(accountManager.getAllAccounts().length, 0);
    });
  });

  describe('getAccount', () => {
    beforeEach(async () => {
      await accountManager.addAccount('user@example.com', 'token123', {
        planType: 'pro',
      });
    });

    it('should retrieve an existing account', () => {
      const account = accountManager.getAccount('user@example.com');

      assert.deepStrictEqual(account, {
        email: 'user@example.com',
        token: 'token123',
        metadata: { planType: 'pro' },
      });
    });

    it('should return null for non-existent account', () => {
      const account = accountManager.getAccount('nonexistent@example.com');

      assert.strictEqual(account, null);
    });

    it('should throw error when email is missing', () => {
      try {
        accountManager.getAccount('');
        assert.fail('Should have thrown error for missing email');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Email is required');
      }
    });
  });

  describe('getAllAccounts', () => {
    it('should return empty array when no accounts exist', () => {
      const accounts = accountManager.getAllAccounts();

      assert.deepStrictEqual(accounts, []);
    });

    it('should return all stored accounts', async () => {
      await accountManager.addAccount('user1@example.com', 'token1');
      await accountManager.addAccount('user2@example.com', 'token2');

      const accounts = accountManager.getAllAccounts();

      assert.strictEqual(accounts.length, 2);
      const emails = accounts.map((a) => a.email);
      assert.ok(emails.includes('user1@example.com'));
      assert.ok(emails.includes('user2@example.com'));
    });
  });

  describe('setActiveAccount', () => {
    beforeEach(async () => {
      await accountManager.addAccount('user@example.com', 'token123');
    });

    it('should set active account successfully', async () => {
      await accountManager.setActiveAccount('user@example.com');

      const activeAccount = accountManager.getActiveAccount();
      assert.strictEqual(activeAccount?.email, 'user@example.com');
    });

    it('should update last login time on account switch', async () => {
      const beforeTime = Date.now();
      await accountManager.setActiveAccount('user@example.com');
      const afterTime = Date.now();

      const activeAccount = accountManager.getActiveAccount();
      assert.ok(activeAccount?.metadata?.lastLoginTime !== undefined);
      assert.ok(activeAccount?.metadata?.lastLoginTime! >= beforeTime);
      assert.ok(activeAccount?.metadata?.lastLoginTime! <= afterTime);
    });

    it('should throw error when setting non-existent account as active', async () => {
      try {
        await accountManager.setActiveAccount('nonexistent@example.com');
        assert.fail('Should have thrown error for non-existent account');
      } catch (error: any) {
        assert.strictEqual(
          error.message,
          'Account with email nonexistent@example.com not found'
        );
      }
    });

    it('should throw error when email is missing', async () => {
      try {
        await accountManager.setActiveAccount('');
        assert.fail('Should have thrown error for missing email');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Email is required');
      }
    });

    it('should preserve existing metadata when updating last login time', async () => {
      await accountManager.addAccount('user2@example.com', 'token456', {
        planType: 'pro',
      });

      await accountManager.setActiveAccount('user2@example.com');

      const activeAccount = accountManager.getActiveAccount();
      assert.strictEqual(activeAccount?.metadata?.planType, 'pro');
      assert.ok(activeAccount?.metadata?.lastLoginTime !== undefined);
    });
  });

  describe('getActiveAccount', () => {
    it('should return null when no account is active', () => {
      const activeAccount = accountManager.getActiveAccount();

      assert.strictEqual(activeAccount, null);
    });

    it('should return the active account', async () => {
      await accountManager.addAccount('user@example.com', 'token123');
      await accountManager.setActiveAccount('user@example.com');

      const activeAccount = accountManager.getActiveAccount();

      assert.strictEqual(activeAccount?.email, 'user@example.com');
    });

    it('should return the same account object on multiple calls', async () => {
      await accountManager.addAccount('user@example.com', 'token123');
      await accountManager.setActiveAccount('user@example.com');

      const activeAccount1 = accountManager.getActiveAccount();
      const activeAccount2 = accountManager.getActiveAccount();

      assert.strictEqual(activeAccount1?.email, activeAccount2?.email);
    });
  });

  describe('account isolation', () => {
    it('should maintain separate metadata for different accounts', async () => {
      await accountManager.addAccount('user1@example.com', 'token1', {
        planType: 'pro',
      });
      await accountManager.addAccount('user2@example.com', 'token2', {
        planType: 'free',
      });

      const account1 = accountManager.getAccount('user1@example.com');
      const account2 = accountManager.getAccount('user2@example.com');

      assert.strictEqual(account1?.metadata?.planType, 'pro');
      assert.strictEqual(account2?.metadata?.planType, 'free');
    });

    it('should not leak data between accounts on active account switch', async () => {
      await accountManager.addAccount('user1@example.com', 'token1', {
        planType: 'pro',
      });
      await accountManager.addAccount('user2@example.com', 'token2', {
        planType: 'free',
      });

      await accountManager.setActiveAccount('user1@example.com');
      const active1 = accountManager.getActiveAccount();

      await accountManager.setActiveAccount('user2@example.com');
      const active2 = accountManager.getActiveAccount();

      assert.strictEqual(active1?.email, 'user1@example.com');
      assert.strictEqual(active2?.email, 'user2@example.com');
      assert.notStrictEqual(active1?.metadata?.planType, active2?.metadata?.planType);
    });
  });
});
