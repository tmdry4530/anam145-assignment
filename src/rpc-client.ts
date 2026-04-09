import { RPCError, RPCTimeoutError, RPCParseError } from './errors.js';
import { validateBalanceResponse } from './rpc-response-validator.js';

export function createRPCClient(options: { rpcUrl: string; timeoutMs?: number }) {
  const { rpcUrl, timeoutMs = 10_000 } = options;

  return {
    async getBalance(address: string, block = 'latest'): Promise<bigint> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, block],
            id: 1,
          }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new RPCTimeoutError();
        }
        throw new RPCError((err as Error).message, -1);
      } finally {
        clearTimeout(timer);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new RPCParseError('Invalid JSON response from RPC');
      }

      const body = json as { result?: unknown; error?: { code: number; message: string } };
      if (body.error) {
        throw new RPCError(body.error.message, body.error.code);
      }
      return validateBalanceResponse(body.result);
    },
  };
}
