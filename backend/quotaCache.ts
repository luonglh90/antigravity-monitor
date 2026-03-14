/**
 * Represents cached quota data with TTL information
 */
interface CachedQuota {
  data: object;
  expiresAt: number;
}

/**
 * QuotaCache service for caching quota data per account with TTL management
 * Implements cache-first strategy with automatic expiration
 */
export class QuotaCache {
  private cache: Map<string, CachedQuota> = new Map();
  private readonly defaultTtlMs: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Sets quota data for an account with TTL
   * 
   * @param email - User email address (unique identifier)
   * @param quotaData - Quota data object to cache
   * @param ttlMs - Time to live in milliseconds (optional, defaults to 5 minutes)
   */
  setQuota(email: string, quotaData: object, ttlMs?: number): void {
    if (!email) {
      throw new Error('Email is required');
    }

    if (!quotaData) {
      throw new Error('Quota data is required');
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    this.cache.set(email, {
      data: quotaData,
      expiresAt,
    });

    console.log(
      `[QuotaCache] Quota cached for ${email}, expires at ${new Date(expiresAt).toISOString()}`
    );
  }

  /**
   * Gets quota data for an account if it exists and hasn't expired
   * 
   * @param email - User email address
   * @returns Quota data object or null if not found or expired
   */
  getQuota(email: string): object | null {
    if (!email) {
      throw new Error('Email is required');
    }

    const cached = this.cache.get(email);

    if (!cached) {
      console.log(`[QuotaCache] No cached quota found for ${email}`);
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiresAt) {
      console.log(`[QuotaCache] Cached quota expired for ${email}`);
      this.cache.delete(email);
      return null;
    }

    console.log(`[QuotaCache] Returning cached quota for ${email}`);
    return cached.data;
  }

  /**
   * Invalidates (removes) cached quota data for an account
   * 
   * @param email - User email address
   */
  invalidateQuota(email: string): void {
    if (!email) {
      throw new Error('Email is required');
    }

    if (this.cache.has(email)) {
      this.cache.delete(email);
      console.log(`[QuotaCache] Quota cache invalidated for ${email}`);
    } else {
      console.log(`[QuotaCache] No cached quota to invalidate for ${email}`);
    }
  }

  /**
   * Clears all cached quota data
   * Used during session cleanup or logout
   */
  clearAllQuotas(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`[QuotaCache] Cleared ${count} quota cache entries`);
  }
}
