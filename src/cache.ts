interface CacheEntry {
  balance: bigint;
  cachedAt: number;
}

export function createBalanceCache(options: { ttlMs: number }) {
  const { ttlMs } = options;
  const store = new Map<string, CacheEntry>();

  return {
    async get(address: string): Promise<{ balance: bigint; cachedAt: number } | null> {
      const entry = store.get(address.toLowerCase());
      if (!entry) return null;
      if (Date.now() - entry.cachedAt >= ttlMs) {
        store.delete(address.toLowerCase());
        return null;
      }
      return { balance: entry.balance, cachedAt: entry.cachedAt };
    },

    async set(address: string, balance: bigint): Promise<void> {
      store.set(address.toLowerCase(), { balance, cachedAt: Date.now() });
    },

    async invalidate(address: string): Promise<void> {
      store.delete(address.toLowerCase());
    },
  };
}
