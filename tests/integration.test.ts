import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp } from '../src/server.js';
import { createRateLimiter } from '../src/rate-limiter.js';
import { createBalanceCache } from '../src/cache.js';

function createTestRPCClient(mode: 'normal' | 'error' = 'normal') {
  return {
    getBalance: async (_address: string) => {
      if (mode === 'error') {
        throw new Error('connect ECONNREFUSED https://eth-sepolia.g.alchemy.com/v2/secret_key');
      }
      return 1000000000000000000n;
    },
  };
}

function startServer(
  rpcClient: ReturnType<typeof createTestRPCClient>,
  opts?: { rateLimiter?: ReturnType<typeof createRateLimiter>; cache?: ReturnType<typeof createBalanceCache> },
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const app = createApp({ rpcClient, rateLimiter: opts?.rateLimiter, cache: opts?.cache, trustedProxyCount: 0 });
    const server = createServer(app.handler);
    server.listen(0, () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('Integration — API 엔드포인트', () => {
  it('시나리오 1: 유효 주소 → 200 + 잔액', async () => {
    const { server, port } = await startServer(createTestRPCClient());
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.balance).toBe('1000000000000000000');
      expect(body.balanceInEth).toBe('1.0');
    } finally { await stopServer(server); }
  });

  it('시나리오 2: 잘못된 주소 → 400', async () => {
    const { server, port } = await startServer(createTestRPCClient());
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=invalid`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('INVALID_ADDRESS');
    } finally { await stopServer(server); }
  });

  it('시나리오 3: address 파라미터 없음 → 400', async () => {
    const { server, port } = await startServer(createTestRPCClient());
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('INVALID_ADDRESS');
    } finally { await stopServer(server); }
  });

  it('시나리오 4: 동일 주소 2회 → 두 번째는 cached: true', async () => {
    const { server, port } = await startServer(createTestRPCClient());
    try {
      await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      expect((await res.json()).cached).toBe(true);
    } finally { await stopServer(server); }
  });

  it('시나리오 5: 11번 연속 → 처음 10회 200, 11번째 429', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const { server, port } = await startServer(createTestRPCClient(), { rateLimiter: limiter });
    try {
      for (let i = 0; i < 10; i++) {
        expect((await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`)).status).toBe(200);
      }
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      expect(res.status).toBe(429);
      expect((await res.json()).error).toBe('RATE_LIMITED');
    } finally { await stopServer(server); }
  });

  it('시나리오 6: RPC 에러 → 502', async () => {
    const { server, port } = await startServer(createTestRPCClient('error'));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe('RPC_ERROR');
    } finally { await stopServer(server); }
  });

  it('시나리오 7: X-RateLimit-Remaining 헤더 감소', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const { server, port } = await startServer(createTestRPCClient(), { rateLimiter: limiter });
    try {
      const res1 = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      const rem1 = Number(res1.headers.get('x-ratelimit-remaining'));
      const res2 = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      const rem2 = Number(res2.headers.get('x-ratelimit-remaining'));
      expect(rem1).toBeGreaterThan(rem2);
    } finally { await stopServer(server); }
  });

  it('시나리오 8: 502 응답에 RPC URL/API Key 미포함', async () => {
    const { server, port } = await startServer(createTestRPCClient('error'));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`);
      const body = await res.text();
      expect(body.toLowerCase()).not.toContain('alchemy');
      expect(body.toLowerCase()).not.toContain('secret_key');
      expect(body.toLowerCase()).not.toContain('econnrefused');
    } finally { await stopServer(server); }
  });

  it('시나리오 9: XSS 시도 → 400, 응답에 <script> 미포함', async () => {
    const { server, port } = await startServer(createTestRPCClient());
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=0x<script>alert(1)</script>`);
      expect(res.status).toBe(400);
      expect(await res.text()).not.toContain('<script>');
    } finally { await stopServer(server); }
  });

  it('시나리오 10: X-Forwarded-For 스푸핑 → rate limit는 소켓 IP 기준', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const { server, port } = await startServer(createTestRPCClient(), { rateLimiter: limiter });
    try {
      for (let i = 0; i < 10; i++) {
        await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`, {
          headers: { 'X-Forwarded-For': `fake-ip-${i}` },
        });
      }
      const res = await fetch(`http://127.0.0.1:${port}/api/balance?address=${VITALIK}`, {
        headers: { 'X-Forwarded-For': 'different-fake-ip' },
      });
      expect(res.status).toBe(429);
    } finally { await stopServer(server); }
  });
});
