import * as vscode from 'vscode';

/**
 * Represents stored credentials for a user account
 */
export interface Credentials {
  email: string;
  token: string;
  metadata?: {
    planType?: string;
    lastLoginTime?: number;
  };
}

/**
 * CredentialStore service for securely storing and retrieving user credentials
 * Uses VS Code's SecureStorage API for encryption with fallback to in-memory storage
 */
export class CredentialStore {
  private context: vscode.ExtensionContext;
  private inMemoryStorage: Map<string, Credentials> = new Map();
  private useSecureStorage: boolean = true;
  private storedKeys: Set<string> = new Set(); // Track stored keys for getAllCredentials

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    // Load stored keys from context global state (async, but we'll handle it in initialize)
    this.loadStoredKeys().catch(error => {
      console.warn('[CredentialStore] Failed to load stored keys in constructor', error);
    });
  }

  /**
   * Load stored keys from VS Code global state
   */
  private async loadStoredKeys(): Promise<void> {
    try {
      const keys = this.context.globalState.get<string[]>('credentialStore.keys', []);
      this.storedKeys = new Set(keys);
      console.log(`[CredentialStore] Loaded ${keys.length} stored keys`);
    } catch (error) {
      console.warn('[CredentialStore] Failed to load stored keys', error);
    }
  }

  /**
   * Save stored keys to VS Code global state
   */
  private async saveStoredKeys(): Promise<void> {
    try {
      const keys = Array.from(this.storedKeys);
      await this.context.globalState.update('credentialStore.keys', keys);
    } catch (error) {
      console.warn('[CredentialStore] Failed to save stored keys', error);
    }
  }

  /**
   * Saves credentials securely using VS Code's SecureStorage
   * Falls back to in-memory storage if SecureStorage fails
   * 
   * @param email - User email address (unique identifier)
   * @param token - Authentication token
   * @param metadata - Optional metadata (planType, lastLoginTime, etc.)
   */
  async saveCredentials(
    email: string,
    token: string,
    metadata?: object
  ): Promise<void> {
    if (!email || !token) {
      throw new Error('Email and token are required');
    }

    const credentials: Credentials = {
      email,
      token,
      metadata: metadata as Credentials['metadata'],
    };

    // Try to save to SecureStorage first
    if (this.useSecureStorage) {
      try {
        const key = this.getStorageKey(email);
        await this.context.secrets.store(key, JSON.stringify(credentials));
        this.storedKeys.add(email);
        await this.saveStoredKeys();
        console.log(`[CredentialStore] Credentials saved securely for ${email}`);
        return;
      } catch (error) {
        console.warn(
          `[CredentialStore] Failed to save credentials to SecureStorage for ${email}, falling back to in-memory storage`,
          error
        );
        this.useSecureStorage = false;
      }
    }

    // Fallback to in-memory storage
    this.inMemoryStorage.set(email, credentials);
    console.log(`[CredentialStore] Credentials saved to in-memory storage for ${email}`);
  }

  /**
   * Loads credentials for a specific email address
   * 
   * @param email - User email address
   * @returns Credentials object or null if not found
   */
  async loadCredentials(email: string): Promise<Credentials | null> {
    if (!email) {
      throw new Error('Email is required');
    }

    // Try to load from SecureStorage first
    if (this.useSecureStorage) {
      try {
        const key = this.getStorageKey(email);
        const stored = await this.context.secrets.get(key);
        if (stored) {
          const credentials = JSON.parse(stored) as Credentials;
          console.log(`[CredentialStore] Credentials loaded from SecureStorage for ${email}`);
          return credentials;
        }
      } catch (error) {
        console.warn(
          `[CredentialStore] Failed to load credentials from SecureStorage for ${email}`,
          error
        );
        this.useSecureStorage = false;
      }
    }

    // Try in-memory storage
    const inMemory = this.inMemoryStorage.get(email);
    if (inMemory) {
      console.log(`[CredentialStore] Credentials loaded from in-memory storage for ${email}`);
      return inMemory;
    }

    console.log(`[CredentialStore] No credentials found for ${email}`);
    return null;
  }

  /**
   * Retrieves all stored credentials
   * 
   * @returns Array of all stored credentials
   */
  async getAllCredentials(): Promise<Credentials[]> {
    const allCredentials: Credentials[] = [];

    // Load credentials from SecureStorage using tracked keys
    if (this.useSecureStorage) {
      try {
        for (const email of this.storedKeys) {
          try {
            const key = this.getStorageKey(email);
            const stored = await this.context.secrets.get(key);
            if (stored) {
              const credentials = JSON.parse(stored) as Credentials;
              allCredentials.push(credentials);
            }
          } catch (error) {
            console.warn(`[CredentialStore] Failed to load credentials for ${email}`, error);
          }
        }
        console.log(`[CredentialStore] Retrieved ${allCredentials.length} credentials from SecureStorage`);
        return allCredentials;
      } catch (error) {
        console.warn('[CredentialStore] Failed to retrieve credentials from SecureStorage', error);
        this.useSecureStorage = false;
      }
    }

    // Return from in-memory storage
    const inMemoryCredentials = Array.from(this.inMemoryStorage.values());
    console.log(`[CredentialStore] Retrieved ${inMemoryCredentials.length} credentials from in-memory storage`);
    return inMemoryCredentials;
  }

  /**
   * Deletes credentials for a specific email address
   * 
   * @param email - User email address
   */
  async deleteCredentials(email: string): Promise<void> {
    if (!email) {
      throw new Error('Email is required');
    }

    // Try to delete from SecureStorage first
    if (this.useSecureStorage) {
      try {
        const key = this.getStorageKey(email);
        await this.context.secrets.delete(key);
        this.storedKeys.delete(email);
        await this.saveStoredKeys();
        console.log(`[CredentialStore] Credentials deleted from SecureStorage for ${email}`);
        return;
      } catch (error) {
        console.warn(
          `[CredentialStore] Failed to delete credentials from SecureStorage for ${email}`,
          error
        );
        this.useSecureStorage = false;
      }
    }

    // Delete from in-memory storage
    if (this.inMemoryStorage.has(email)) {
      this.inMemoryStorage.delete(email);
      console.log(`[CredentialStore] Credentials deleted from in-memory storage for ${email}`);
    } else {
      console.log(`[CredentialStore] No credentials found to delete for ${email}`);
    }
  }

  /**
   * Generates a storage key for the given email
   * 
   * @param email - User email address
   * @returns Storage key
   */
  private getStorageKey(email: string): string {
    return `antigravity-credentials-${email}`;
  }
}
