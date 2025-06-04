/**
 * Advanced caching system for the Marshal Context Engine
 * Provides multi-layer caching with intelligent eviction policies
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  evictions: number;
}

export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private maxEntries: number;
  private defaultTTL: number;
  private stats: CacheStats;

  constructor(
    maxSize: number = 100 * 1024 * 1024, // 100MB
    maxEntries: number = 10000,
    defaultTTL: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {
    this.maxSize = maxSize;
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTL;
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      evictions: 0
    };

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value);
    const now = Date.now();

    // Check if we need to evict entries
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size,
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, entry);
    this.updateStats();
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats();
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Get number of entries
   */
  getEntryCount(): number {
    return this.cache.size;
  }

  /**
   * Ensure cache capacity by evicting entries if necessary
   */
  private ensureCapacity(newEntrySize: number): void {
    // Check size limit
    while (this.getSize() + newEntrySize > this.maxSize && this.cache.size > 0) {
      this.evictLeastUsed();
    }

    // Check entry count limit
    while (this.cache.size >= this.maxEntries) {
      this.evictLeastUsed();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastUsed(): void {
    let oldestEntry: CacheEntry<T> | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.updateStats();
    }
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size if serialization fails
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.getSize();
    this.updateHitRate();
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      evictions: 0
    };
  }

  /**
   * Get most accessed entries
   */
  getMostAccessed(limit: number = 10): Array<{ key: string; accessCount: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get cache efficiency report
   */
  getEfficiencyReport(): {
    hitRate: number;
    averageAccessCount: number;
    memoryEfficiency: number;
    evictionRate: number;
  } {
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    const averageAccessCount = this.cache.size > 0 ? totalAccesses / this.cache.size : 0;
    const memoryEfficiency = this.maxSize > 0 ? this.getSize() / this.maxSize : 0;
    const totalOperations = this.stats.hits + this.stats.misses + this.stats.evictions;
    const evictionRate = totalOperations > 0 ? this.stats.evictions / totalOperations : 0;

    return {
      hitRate: this.stats.hitRate,
      averageAccessCount,
      memoryEfficiency,
      evictionRate
    };
  }

  /**
   * Optimize cache by removing least useful entries
   */
  optimize(): void {
    const entries = Array.from(this.cache.entries());
    
    // Calculate usefulness score for each entry
    const scoredEntries = entries.map(([key, entry]) => {
      const age = Date.now() - entry.timestamp;
      const recency = Date.now() - entry.lastAccessed;
      const frequency = entry.accessCount;
      
      // Higher score = more useful
      const score = (frequency * 1000) / (age + recency + 1);
      
      return { key, entry, score };
    });

    // Sort by usefulness (lowest first for removal)
    scoredEntries.sort((a, b) => a.score - b.score);

    // Remove bottom 10% if cache is near capacity
    const utilizationRate = this.getSize() / this.maxSize;
    if (utilizationRate > 0.8) {
      const removeCount = Math.floor(this.cache.size * 0.1);
      for (let i = 0; i < removeCount && i < scoredEntries.length; i++) {
        const entry = scoredEntries[i];
        if (entry) {
          this.cache.delete(entry.key);
          this.stats.evictions++;
        }
      }
    }

    this.updateStats();
  }

  /**
   * Export cache data for persistence
   */
  export(): string {
    const data = {
      entries: Array.from(this.cache.entries()),
      stats: this.stats,
      timestamp: Date.now()
    };
    return JSON.stringify(data);
  }

  /**
   * Import cache data from persistence
   */
  import(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      this.cache.clear();
      for (const [key, entry] of parsed.entries) {
        // Only import non-expired entries
        if (!entry.ttl || Date.now() - entry.timestamp < entry.ttl) {
          this.cache.set(key, entry);
        }
      }
      
      this.updateStats();
    } catch (error) {
      console.error('Failed to import cache data:', error);
    }
  }
}
