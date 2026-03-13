import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { QuotaCache } from './quotaCache';

const ANTIGRAVITY_ENDPOINTS = [
  "https://cloudcode-pa.googleapis.com",
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
];

const ANTIGRAVITY_HEADERS = {
  "User-Agent": "antigravity/1.11.5 windows/amd64",
  "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "Client-Metadata": '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

export interface ModelQuotaInfo {
  modelName: string;
  displayName?: string;
  remainingFraction: number;
  remainingPercent: number;
  resetTime: string | null;
  resetTimeMs: number | null;
}

export interface AccountQuota {
  email: string;
  lastFetched: number;
  fetchError?: string;
  models: ModelQuotaInfo[];
  claudeModels: ModelQuotaInfo[];
  geminiModels: ModelQuotaInfo[];
  claudeQuotaPercent: number | null;
  geminiQuotaPercent: number | null;
  claudeResetTime: number | null;
  geminiResetTime: number | null;
}

interface FetchModelsResponse {
  models?: Record<string, {
    displayName?: string;
    quotaInfo?: {
      remainingFraction?: number;
      resetTime?: string;
    };
  }>;
}

export class QuotaService extends EventEmitter {
  private quotaCache: QuotaCache;
  private retryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
  };

  constructor(quotaCache?: QuotaCache) {
    super();
    this.quotaCache = quotaCache || new QuotaCache();
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchAvailableModels(accessToken: string): Promise<FetchModelsResponse | null> {
    for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
      let lastError = '';
      
      for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
        try {
          const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              ...ANTIGRAVITY_HEADERS,
            },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            lastError = `${response.status}: ${await response.text()}`;
            if (response.status >= 500 || response.status === 429) {
              await this.sleep(this.retryConfig.baseDelayMs * Math.pow(2, attempt));
              continue;
            }
            break;
          }

          const data = await response.json() as FetchModelsResponse;
          return data;
        } catch (error: any) {
          lastError = error.message;
          if (attempt < this.retryConfig.maxRetries) {
            await this.sleep(this.retryConfig.baseDelayMs * Math.pow(2, attempt));
            continue;
          }
          break;
        }
      }
      console.warn(`[QuotaService] Endpoint ${endpoint} failed:`, lastError);
    }
    return null;
  }

  private parseQuotaResponse(data: FetchModelsResponse): ModelQuotaInfo[] {
    const models: ModelQuotaInfo[] = [];
    if (!data?.models) {return models;}

    for (const [modelName, modelData] of Object.entries(data.models)) {
      const quotaInfo = modelData.quotaInfo;
      if (!quotaInfo) {continue;}

      const remainingFraction = quotaInfo.remainingFraction ?? 1.0;
      const resetTime = quotaInfo.resetTime || null;

      models.push({
        modelName,
        displayName: modelData.displayName || modelName,
        remainingFraction,
        remainingPercent: Math.round(remainingFraction * 100),
        resetTime,
        resetTimeMs: resetTime ? new Date(resetTime).getTime() : null,
      });
    }
    return models;
  }

  /**
   * Fetches quota data for a specific account with caching support
   * 
   * @param email - User email address (unique identifier)
   * @param accessToken - Authentication token for API requests
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   * @returns AccountQuota object with quota data or error information
   */
  async fetchQuotaForAccount(
    email: string,
    accessToken: string,
    forceRefresh: boolean = false
  ): Promise<AccountQuota> {
    if (!email) {
      throw new Error('Email is required for quota fetching');
    }

    if (!accessToken) {
      throw new Error('Access token is required for quota fetching');
    }

    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedQuota = this.quotaCache.getQuota(email);
      if (cachedQuota) {
        console.log(`[QuotaService] Returning cached quota for ${email}`);
        return cachedQuota as AccountQuota;
      }
    }

    // Fetch fresh quota data
    const result: AccountQuota = {
      email,
      lastFetched: Date.now(),
      models: [],
      claudeModels: [],
      geminiModels: [],
      claudeQuotaPercent: null,
      geminiQuotaPercent: null,
      claudeResetTime: null,
      geminiResetTime: null,
    };

    try {
      const data = await this.fetchAvailableModels(accessToken);
      if (!data) {
        result.fetchError = 'Failed to fetch quota data from API. Please check your connection and try again.';
        console.error(`[QuotaService] Failed to fetch models for ${email}:`, result.fetchError);
        return result;
      }

      result.models = this.parseQuotaResponse(data);

      result.claudeModels = result.models.filter(m => 
        m.modelName.toLowerCase().includes('claude') || 
        m.modelName.toLowerCase().includes('anthropic')
      );
      result.geminiModels = result.models.filter(m => 
        m.modelName.toLowerCase().includes('gemini')
      );

      if (result.claudeModels.length > 0) {
        const minClaude = result.claudeModels.reduce((min, m) => 
          m.remainingPercent < min.remainingPercent ? m : min
        );
        result.claudeQuotaPercent = minClaude.remainingPercent;
        result.claudeResetTime = minClaude.resetTimeMs;
      }

      if (result.geminiModels.length > 0) {
        const minGemini = result.geminiModels.reduce((min, m) => 
          m.remainingPercent < min.remainingPercent ? m : min
        );
        result.geminiQuotaPercent = minGemini.remainingPercent;
        result.geminiResetTime = minGemini.resetTimeMs;
      }

      // Cache the successful result
      this.quotaCache.setQuota(email, result);
      console.log(`[QuotaService] Quota fetched and cached for ${email}`);
    } catch (error: any) {
      result.fetchError = `Failed to fetch quota data: ${error.message || 'Unknown error'}`;
      console.error(`[QuotaService] Error fetching quota for ${email}:`, error);
    }

    return result;
  }

  /**
   * Fetches fresh quota data in the background while returning cached data
   * Useful for updating quota without blocking the UI
   * 
   * @param email - User email address
   * @param accessToken - Authentication token for API requests
   * @returns Promise that resolves when background fetch completes
   */
  async backgroundRefreshQuota(email: string, accessToken: string): Promise<void> {
    try {
      const result = await this.fetchQuotaForAccount(email, accessToken, true);
      if (result.fetchError) {
        this.emit('quotaRefreshError', { email, error: result.fetchError });
      } else {
        this.emit('quotaRefreshed', { email });
      }
    } catch (error: any) {
      console.error(`[QuotaService] Background quota refresh failed for ${email}:`, error);
      this.emit('quotaRefreshError', { email, error: error.message });
    }
  }

  /**
   * Invalidates cached quota data for an account
   * Useful for manual refresh or when account data changes
   * 
   * @param email - User email address
   */
  invalidateQuota(email: string): void {
    if (!email) {
      throw new Error('Email is required for quota invalidation');
    }
    this.quotaCache.invalidateQuota(email);
    console.log(`[QuotaService] Quota cache invalidated for ${email}`);
  }

  /**
   * Gets cached quota data for an account without fetching
   * 
   * @param email - User email address
   * @returns Cached AccountQuota or null if not found or expired
   */
  getCachedQuota(email: string): AccountQuota | null {
    if (!email) {
      throw new Error('Email is required for retrieving cached quota');
    }
    return this.quotaCache.getQuota(email) as AccountQuota | null;
  }

  /**
   * Clears all cached quota data
   * Useful for session cleanup or logout
   */
  clearAllQuotas(): void {
    this.quotaCache.clearAllQuotas();
    console.log('[QuotaService] All quota caches cleared');
  }
}

// Singleton instance
let quotaServiceInstance: QuotaService | null = null;
export function getQuotaService(): QuotaService {
  if (!quotaServiceInstance) {
    quotaServiceInstance = new QuotaService();
  }
  return quotaServiceInstance;
}
