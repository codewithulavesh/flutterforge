export interface KeyStatus {
  key: string;
  maskedKey: string;
  isHealthy: boolean;
  cooldownUntil: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastError?: string;
}

export const DEFAULT_OPENROUTER_KEYS: string[] = [];

/**
 * Intelligent OpenRouter Multi-Key Load Balancer & Auto-Failover Pool
 */
export class OpenRouterKeyPool {
  private static instance: OpenRouterKeyPool;
  private keys: Map<string, KeyStatus> = new Map();
  private currentIndex = 0;

  private constructor() {
    this.initKeys();
  }

  public static getInstance(): OpenRouterKeyPool {
    if (!this.instance) {
      this.instance = new OpenRouterKeyPool();
    }
    return this.instance;
  }

  private initKeys() {
    const envKeysString =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEYS) ||
      (typeof process !== 'undefined' && (process.env?.VITE_OPENROUTER_API_KEYS || process.env?.OPENROUTER_API_KEYS));

    let keyList: string[] = [];
    if (typeof envKeysString === 'string' && envKeysString.trim().length > 0) {
      keyList = envKeysString
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.startsWith('sk-'));
    }

    // Fall back to the singular key env vars (the names the app actually
    // uses everywhere else). Without this the pool is always empty and
    // multi-key failover never engages.
    if (keyList.length === 0) {
      const singular =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
        (typeof process !== 'undefined' && (process.env?.VITE_OPENROUTER_API_KEY || process.env?.OPENROUTER_API_KEY));
      if (typeof singular === 'string' && singular.trim().startsWith('sk-')) {
        keyList = [singular.trim()];
      }
    }

    if (keyList.length === 0) {
      keyList = [...DEFAULT_OPENROUTER_KEYS];
    }

    for (const key of keyList) {
      if (!this.keys.has(key)) {
        this.keys.set(key, {
          key,
          maskedKey: this.maskKey(key),
          isHealthy: true,
          cooldownUntil: 0,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
        });
      }
    }
  }

  public addKey(key: string) {
    const trimmed = key.trim();
    if (trimmed && !this.keys.has(trimmed)) {
      this.keys.set(trimmed, {
        key: trimmed,
        maskedKey: this.maskKey(trimmed),
        isHealthy: true,
        cooldownUntil: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
      });
    }
  }

  /**
   * Retrieves the next available healthy key from the pool (Round-Robin)
   */
  public getNextKey(): string {
    const keyArray = Array.from(this.keys.values());
    if (keyArray.length === 0) {
      throw new Error('No API keys configured in the OpenRouter Key Pool.');
    }

    const now = Date.now();
    // Try to find a healthy key not in cooldown
    for (let i = 0; i < keyArray.length; i++) {
      const idx = (this.currentIndex + i) % keyArray.length;
      const status = keyArray[idx];

      if (status.cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % keyArray.length;
        return status.key;
      }
    }

    // If all are in cooldown, reset the oldest cooldown key
    const sorted = [...keyArray].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
    const oldest = sorted[0];
    oldest.cooldownUntil = 0;
    return oldest.key;
  }

  /**
   * Marks a key as successful
   */
  public markSuccess(key: string) {
    const status = this.keys.get(key);
    if (status) {
      status.totalRequests++;
      status.successfulRequests++;
      status.isHealthy = true;
      status.cooldownUntil = 0;
    }
  }

  /**
   * Marks a key as failed (with temporary cooldown for rate limit/credit errors)
   */
  public markFailure(key: string, error: string, isRateLimitOrCredit = true) {
    const status = this.keys.get(key);
    if (status) {
      status.totalRequests++;
      status.failedRequests++;
      status.lastError = error;

      // Cooldown for 60 seconds on rate limit/credit error
      if (isRateLimitOrCredit) {
        status.cooldownUntil = Date.now() + 60000;
        status.isHealthy = false;
      }
    }
  }

  /**
   * Returns pool status and health metrics for all keys
   */
  public getPoolStatus(): KeyStatus[] {
    const now = Date.now();
    return Array.from(this.keys.values()).map((s) => ({
      ...s,
      isHealthy: s.cooldownUntil <= now,
    }));
  }

  public getPoolSize(): number {
    return this.keys.size;
  }

  private maskKey(key: string): string {
    if (key.length <= 16) return '****';
    return `${key.substring(0, 10)}...${key.substring(key.length - 6)}`;
  }
}

export const keyPool = OpenRouterKeyPool.getInstance();
