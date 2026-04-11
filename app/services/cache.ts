/**
 * In-memory cache service with TTL support
 * Can be extended to use Redis in the future
 * Singleton instance
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL_SECONDS = 900 // 15 minutes

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttlSeconds: number = this.DEFAULT_TTL_SECONDS): void {
    const expiresAt = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiresAt })
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Check if key exists and hasn't expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return false
    }
    return true
  }
}

// Singleton instance
const cacheServiceInstance = new CacheService()

export default cacheServiceInstance

