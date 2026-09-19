class MockVultrCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    this.startCleanup();
  }

  /**
   * Get value from cache
   * Simulates 5ms network latency
   */
  async get(key) {
    await this._simulateLatency(5);

    if (this.cache.has(key)) {
      const entry = this.cache.get(key);

      // Check if expired
      if (entry.expiresAt > Date.now()) {
        this.stats.hits++;
        console.log(`[MOCK VULTR CACHE] ✓ HIT - Key: ${key}`);
        return entry.value;
      } else {
        // Expired, remove it
        this.cache.delete(key);
        console.log(`[MOCK VULTR CACHE] ✗ EXPIRED - Key: ${key}`);
      }
    }

    this.stats.misses++;
    console.log(`[MOCK VULTR CACHE] ✗ MISS - Key: ${key}`);
    return null;
  }

  /**
   * Set value in cache
   * Simulates 3ms network latency
   */
  async set(key, value, ttlSeconds = 3600) {
    await this._simulateLatency(3);

    this.cache.set(key, {
      value: value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      setAt: Date.now()
    });

    this.stats.sets++;
    console.log(`[MOCK VULTR CACHE] ✓ SET - Key: ${key}, TTL: ${ttlSeconds}s, Size: ${this._getSize(value)}`);
    return true;
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    await this._simulateLatency(3);
    const deleted = this.cache.delete(key);

    if (deleted) {
      this.stats.deletes++;
      console.log(`[MOCK VULTR CACHE] ✓ DELETE - Key: ${key}`);
    }

    return deleted;
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        await this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRate: hitRate.toFixed(2) + '%',
      cacheSize: this.cache.size,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    console.log('[MOCK VULTR CACHE] ✓ CLEARED');
  }

  /**
   * Simulate network latency
   */
  async _simulateLatency(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get size of value in bytes (approximate)
   */
  _getSize(value) {
    const str = JSON.stringify(value);
    return new Blob([str]).size + ' bytes';
  }

  /**
   * Estimate total memory usage
   */
  _estimateMemoryUsage() {
    let totalBytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalBytes += new Blob([key]).size;
      totalBytes += new Blob([JSON.stringify(entry.value)]).size;
    }
    return (totalBytes / 1024).toFixed(2) + ' KB';
  }

  /**
   * Background cleanup of expired entries
   */
  startCleanup(intervalMs = 60000) {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt <= now) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[MOCK VULTR CACHE] 🧹 CLEANUP - Removed ${cleaned} expired entries`);
      }
    }, intervalMs);
  }
}

// Export singleton instance
module.exports = new MockVultrCache();
