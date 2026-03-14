import { CredentialStore, Credentials } from './credentialStore';

/**
 * Represents an account with email, token, and metadata
 */
export interface Account {
  email: string;
  token: string;
  metadata?: {
    planType?: string;
    lastLoginTime?: number;
  };
}

/**
 * AccountManager service for managing account lifecycle
 * Handles CRUD operations, active account tracking, and account isolation
 */
export class AccountManager {
  private credentialStore: CredentialStore;
  private accounts: Map<string, Account> = new Map();
  private activeAccount: Account | null = null;

  constructor(credentialStore: CredentialStore) {
    this.credentialStore = credentialStore;
  }

  /**
   * Initializes the AccountManager by loading all stored accounts
   * Should be called during extension activation
   */
  async initialize(): Promise<void> {
    try {
      const credentials = await this.credentialStore.getAllCredentials();
      for (const cred of credentials) {
        this.accounts.set(cred.email, {
          email: cred.email,
          token: cred.token,
          metadata: cred.metadata,
        });
      }
      console.log(`[AccountManager] Initialized with ${this.accounts.size} accounts`);
    } catch (error) {
      console.error('[AccountManager] Failed to initialize accounts', error);
      throw error;
    }
  }

  /**
   * Adds a new account with duplicate detection
   * Prevents adding the same email twice
   *
   * @param email - User email address
   * @param token - Authentication token
   * @param metadata - Optional metadata (planType, lastLoginTime, etc.)
   * @throws Error if account already exists
   */
  async addAccount(
    email: string,
    token: string,
    metadata?: object
  ): Promise<void> {
    if (!email || !token) {
      throw new Error('Email and token are required');
    }

    // Check for duplicate
    if (this.accounts.has(email)) {
      throw new Error(`Account with email ${email} already exists`);
    }

    const account: Account = {
      email,
      token,
      metadata: metadata as Account['metadata'],
    };

    // Save to credential store
    await this.credentialStore.saveCredentials(email, token, metadata);

    // Add to in-memory accounts
    this.accounts.set(email, account);

    console.log(`[AccountManager] Account added for ${email}`);
  }

  /**
   * Removes an account and its associated data
   * If the removed account was active, switches to another account
   *
   * @param email - User email address
   * @throws Error if account doesn't exist
   */
  async removeAccount(email: string): Promise<void> {
    if (!email) {
      throw new Error('Email is required');
    }

    if (!this.accounts.has(email)) {
      throw new Error(`Account with email ${email} not found`);
    }

    // Delete from credential store
    await this.credentialStore.deleteCredentials(email);

    // Remove from in-memory accounts
    this.accounts.delete(email);

    // If this was the active account, switch to another
    if (this.activeAccount?.email === email) {
      const remainingAccounts = Array.from(this.accounts.values());
      if (remainingAccounts.length > 0) {
        this.activeAccount = remainingAccounts[0];
        console.log(
          `[AccountManager] Active account was removed, switched to ${this.activeAccount.email}`
        );
      } else {
        this.activeAccount = null;
        console.log('[AccountManager] Active account was removed, no accounts remaining');
      }
    }

    console.log(`[AccountManager] Account removed for ${email}`);
  }

  /**
   * Retrieves a specific account by email
   *
   * @param email - User email address
   * @returns Account object or null if not found
   */
  getAccount(email: string): Account | null {
    if (!email) {
      throw new Error('Email is required');
    }

    const account = this.accounts.get(email);
    if (account) {
      console.log(`[AccountManager] Retrieved account for ${email}`);
      return account;
    }

    console.log(`[AccountManager] Account not found for ${email}`);
    return null;
  }

  /**
   * Retrieves all stored accounts
   *
   * @returns Array of all accounts
   */
  getAllAccounts(): Account[] {
    const allAccounts = Array.from(this.accounts.values());
    console.log(`[AccountManager] Retrieved ${allAccounts.length} accounts`);
    return allAccounts;
  }

  /**
   * Sets the active account and updates last login time
   * Requirement 9.4: Update last login time on account switch
   *
   * @param email - User email address
   * @throws Error if account doesn't exist
   */
  async setActiveAccount(email: string): Promise<void> {
    if (!email) {
      throw new Error('Email is required');
    }

    const account = this.accounts.get(email);
    if (!account) {
      throw new Error(`Account with email ${email} not found`);
    }

    // Update last login time
    const now = Date.now();
    const updatedMetadata = {
      ...account.metadata,
      lastLoginTime: now,
    };

    // Update in-memory account
    account.metadata = updatedMetadata;
    this.accounts.set(email, account);

    // Update in credential store
    await this.credentialStore.saveCredentials(email, account.token, updatedMetadata);

    // Set as active
    this.activeAccount = account;

    console.log(
      `[AccountManager] Active account set to ${email}, last login time updated to ${new Date(now).toISOString()}`
    );
  }

  /**
   * Retrieves the currently active account
   *
   * @returns Active account or null if no account is active
   */
  getActiveAccount(): Account | null {
    if (this.activeAccount) {
      console.log(`[AccountManager] Retrieved active account: ${this.activeAccount.email}`);
      return this.activeAccount;
    }

    console.log('[AccountManager] No active account set');
    return null;
  }
}
