import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBalanceCache } from '../src/cache.js';

describe('BalanceCache', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('시나리오 1: set → get 정상 반환', async () => {
    const cache = createBalanceCache({ ttlMs: 30_000 });
    await cache.set('0xA', 1000n);
    const result = await cache.get('0xA');
    expect(result).not.toBeNull();
    expect(result!.balance).toBe(1000n);
  });

  it('시나리오 2: 미등록 주소 → null', async () => {
    const cache = createBalanceCache({ ttlMs: 30_000 });
    expect(await cache.get('0xB')).toBeNull();
  });

  it('시나리오 3: set → invalidate → get → null', async () => {
    const cache = createBalanceCache({ ttlMs: 30_000 });
    await cache.set('0xA', 1000n);
    await cache.invalidate('0xA');
    expect(await cache.get('0xA')).toBeNull();
  });

  it('시나리오 4: TTL 경과 후 get → null', async () => {
    const cache = createBalanceCache({ ttlMs: 30_000 });
    await cache.set('0xA', 1000n);
    vi.advanceTimersByTime(30_000);
    expect(await cache.get('0xA')).toBeNull();
  });

  it('시나리오 5: 캐시 히트 시 RPC 호출 없음', async () => {
    const cache = createBalanceCache({ ttlMs: 30_000 });
    let rpcCallCount = 0;
    async function getBalance(address: string): Promise<bigint> {
      const cached = await cache.get(address);
      if (cached) return cached.balance;
      rpcCallCount++;
      const balance = 1000000000000000000n;
      await cache.set(address, balance);
      return balance;
    }
    await getBalance('0xA');
    await getBalance('0xA');
    expect(rpcCallCount).toBe(1);
  });
});
