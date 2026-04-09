import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRPCClient } from '../src/rpc-client.js';
import { RPCTimeoutError, RPCParseError, RPCError } from '../src/errors.js';

function mockFetch(handler: (body: any) => unknown) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const result = handler(body);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  });
}

describe('RPC Client', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; vi.useRealTimers(); });

  it('유효 주소 → bigint 반환', async () => {
    globalThis.fetch = mockFetch((b: any) => ({ jsonrpc: '2.0', id: b.id, result: '0xDE0B6B3A7640000' })) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc' });
    expect(await client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(1000000000000000000n);
  });

  it('wei → ETH 변환 정확성', async () => {
    globalThis.fetch = mockFetch((b: any) => ({ jsonrpc: '2.0', id: b.id, result: '0xDE0B6B3A7640000' })) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc' });
    const wei = await client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(Number(wei) / 1e18).toBe(1.0);
  });

  it('RPC 타임아웃 → RPCTimeoutError', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init.signal!.addEventListener('abort', () => {
          const err = new Error('The operation was aborted'); err.name = 'AbortError'; reject(err);
        });
      });
    }) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc', timeoutMs: 10_000 });
    const promise = client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    vi.advanceTimersByTime(10_000);
    await expect(promise).rejects.toThrow(RPCTimeoutError);
  });

  it('유효하지 않은 JSON → RPCParseError', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not json', { headers: { 'Content-Type': 'text/plain' } })) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc' });
    await expect(client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).rejects.toThrow(RPCParseError);
  });

  it('RPC 에러 코드 → RPCError', async () => {
    globalThis.fetch = mockFetch((b: any) => ({ jsonrpc: '2.0', id: b.id, error: { code: -32005, message: 'rate limit exceeded' } })) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc' });
    await expect(client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).rejects.toThrow(RPCError);
  });

  it('result가 hex가 아닌 경우 → RPCParseError', async () => {
    globalThis.fetch = mockFetch((b: any) => ({ jsonrpc: '2.0', id: b.id, result: 'not_a_hex_value' })) as any;
    const client = createRPCClient({ rpcUrl: 'http://fake-rpc' });
    await expect(client.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).rejects.toThrow(RPCParseError);
  });
});
