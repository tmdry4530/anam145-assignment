import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../src/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('시나리오 1: 동일 IP에서 10회 연속 요청 → 전부 허용', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    for (let i = 0; i < 10; i++) {
      expect(await limiter.consume('1.2.3.4')).toBe(true);
    }
  });

  it('시나리오 2: 동일 IP에서 11번째 요청 → 차단', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    for (let i = 0; i < 10; i++) await limiter.consume('1.2.3.4');
    expect(await limiter.consume('1.2.3.4')).toBe(false);
  });

  it('시나리오 3: 차단 후 window 경과 → 재허용', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    for (let i = 0; i < 10; i++) await limiter.consume('1.2.3.4');
    expect(await limiter.consume('1.2.3.4')).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(await limiter.consume('1.2.3.4')).toBe(true);
  });

  it('시나리오 4: 서로 다른 IP는 독립 카운트', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    for (let i = 0; i < 10; i++) {
      expect(await limiter.consume('1.1.1.1')).toBe(true);
      expect(await limiter.consume('2.2.2.2')).toBe(true);
    }
  });

  it('시나리오 5: remaining() 초기 10, 요청마다 1씩 감소', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    expect(await limiter.remaining('1.2.3.4')).toBe(10);
    await limiter.consume('1.2.3.4');
    expect(await limiter.remaining('1.2.3.4')).toBe(9);
    for (let i = 0; i < 9; i++) await limiter.consume('1.2.3.4');
    expect(await limiter.remaining('1.2.3.4')).toBe(0);
    await limiter.consume('1.2.3.4');
    expect(await limiter.remaining('1.2.3.4')).toBe(0);
  });
});
