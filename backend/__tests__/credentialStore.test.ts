import * as assert from 'assert';
import * as vscode from 'vscode';
import { CredentialStore, Credentials } from '../credentialStore';

/**
 * Mock ExtensionContext for testing
 */
class MockExtensionContext implements Partial<vscode.ExtensionContext> {
  secrets: vscode.SecretStorage;

  constructor() {
    this.secrets = new MockSecretStorage();
  }
}

/**
 * Mock SecretStorage for testing
 */
class MockSecretStorage implements vscode.SecretStorage {
  private storage: Map<string, string> = new Map();

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event;
}

suite('CredentialStore', () => {
  let credentialStore: CredentialStore;
  let mockContext: MockExtensionContext;

  setup(() => {
    mockContext = new MockExtensionContext();
    credentialStore = new CredentialStore(mockContext as any);
  });

  test('saveCredentials should store credentials with email and token', async () => {
    const email = 'test@example.com';
    const token = 'test-token-123';

    await credentialStore.saveCredentials(email, token);

    const loaded = await credentialStore.loadCredentials(email);
    assert.strictEqual(loaded?.email, email);
    assert.strictEqual(loaded?.token, token);
  });

  test('saveCredentials should store credentials with metadata', async () => {
    const email = 'test@example.com';
    const token = 'test-token-123';
    const metadata = {
      planType: 'pro',
      lastLoginTime: Date.now(),
    };

    await credentialStore.saveCredentials(email, token, metadata);

    const loaded = await credentialStore.loadCredentials(email);
    assert.strictEqual(loaded?.metadata?.planType, 'pro');
    assert.strictEqual(loaded?.metadata?.lastLoginTime, metadata.lastLoginTime);
  });

  test('saveCredentials should throw error if email is missing', async () => {
    const token = 'test-token-123';

    try {
      await credentialStore.saveCredentials('', token);
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'Email and token are required');
    }
  });

  test('saveCredentials should throw error if token is missing', async () => {
    const email = 'test@example.com';

    try {
      await credentialStore.saveCredentials(email, '');
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'Email and token are required');
    }
  });

  test('loadCredentials should return null for non-existing account', async () => {
    const loaded = await credentialStore.loadCredentials('nonexistent@example.com');
    assert.strictEqual(loaded, null);
  });

  test('loadCredentials should throw error if email is missing', async () => {
    try {
      await credentialStore.loadCredentials('');
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'Email is required');
    }
  });

  test('getAllCredentials should return all stored accounts', async () => {
    const email1 = 'test1@example.com';
    const token1 = 'token-1';
    const email2 = 'test2@example.com';
    const token2 = 'token-2';

    await credentialStore.saveCredentials(email1, token1);
    await credentialStore.saveCredentials(email2, token2);

    const allCredentials = await credentialStore.getAllCredentials();
    assert.strictEqual(allCredentials.length, 2);

    const emails = allCredentials.map(c => c.email);
    assert.ok(emails.includes(email1));
    assert.ok(emails.includes(email2));
  });

  test('getAllCredentials should return empty array when no credentials stored', async () => {
    const allCredentials = await credentialStore.getAllCredentials();
    assert.strictEqual(allCredentials.length, 0);
  });

  test('deleteCredentials should remove stored credentials', async () => {
    const email = 'test@example.com';
    const token = 'test-token-123';

    await credentialStore.saveCredentials(email, token);
    let loaded = await credentialStore.loadCredentials(email);
    assert.notStrictEqual(loaded, null);

    await credentialStore.deleteCredentials(email);
    loaded = await credentialStore.loadCredentials(email);
    assert.strictEqual(loaded, null);
  });

  test('deleteCredentials should handle deletion of non-existing credentials', async () => {
    // Should not throw error
    await credentialStore.deleteCredentials('nonexistent@example.com');
  });

  test('deleteCredentials should throw error if email is missing', async () => {
    try {
      await credentialStore.deleteCredentials('');
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'Email is required');
    }
  });

  test('should handle multiple save and load operations', async () => {
    const email = 'test@example.com';
    const token1 = 'token-1';
    const token2 = 'token-2';

    // Save first token
    await credentialStore.saveCredentials(email, token1);
    let loaded = await credentialStore.loadCredentials(email);
    assert.strictEqual(loaded?.token, token1);

    // Update with new token
    await credentialStore.saveCredentials(email, token2);
    loaded = await credentialStore.loadCredentials(email);
    assert.strictEqual(loaded?.token, token2);
  });

  test('should maintain credential isolation between accounts', async () => {
    const email1 = 'test1@example.com';
    const token1 = 'token-1';
    const email2 = 'test2@example.com';
    const token2 = 'token-2';

    await credentialStore.saveCredentials(email1, token1);
    await credentialStore.saveCredentials(email2, token2);

    const loaded1 = await credentialStore.loadCredentials(email1);
    const loaded2 = await credentialStore.loadCredentials(email2);

    assert.strictEqual(loaded1?.token, token1);
    assert.strictEqual(loaded2?.token, token2);
    assert.notStrictEqual(loaded1?.token, loaded2?.token);
  });
});
