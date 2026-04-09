interface BucketEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const { windowMs, maxRequests } = options;
  const buckets = new Map<string, BucketEntry>();

  function getBucket(key: string, now: number): BucketEntry {
    const existing = buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
      return entry;
    }
    return existing;
  }

  return {
    async consume(key: string): Promise<boolean> {
      const now = Date.now();
      const bucket = getBucket(key, now);
      if (bucket.count >= maxRequests) return false;
      bucket.count++;
      return true;
    },

    async remaining(key: string): Promise<number> {
      const now = Date.now();
      const bucket = getBucket(key, now);
      return Math.max(0, maxRequests - bucket.count);
    },
  };
}
