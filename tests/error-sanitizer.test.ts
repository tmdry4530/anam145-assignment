import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../src/error-sanitizer.js';
import { RPCError } from '../src/errors.js';

describe('Error Sanitizer', () => {
  const cases = [
    {
      name: '시나리오 1: Alchemy URL + API Key 유출 차단',
      error: new Error('connect ECONNREFUSED https://eth-sepolia.g.alchemy.com/v2/abc123key'),
      forbidden: ['alchemy', 'abc123key', 'ECONNREFUSED'],
    },
    {
      name: '시나리오 2: 스택 트레이스 유출 차단',
      error: new Error('Request failed with status 403\n    at RPCClient.call (/app/src/rpc.ts:42:11)'),
      forbidden: ['/app/src/', '.ts:', 'RPCClient.call'],
    },
    {
      name: '시나리오 3: 내부 RPC 에러 코드 유출 차단',
      error: new RPCError('rate limit', -32005),
      forbidden: ['-32005'],
    },
    {
      name: '시나리오 4: Infura API Key 유출 차단',
      error: new Error('INFURA_API_KEY=xyz789 is invalid'),
      forbidden: ['INFURA', 'xyz789'],
    },
  ];

  for (const { name, error, forbidden } of cases) {
    it(name, () => {
      const sanitized = sanitizeError(error);
      const responseBody = JSON.stringify(sanitized.body);
      for (const word of forbidden) {
        expect(responseBody.toLowerCase()).not.toContain(word.toLowerCase());
      }
      expect(sanitized.body.error).toBe('RPC_ERROR');
      expect(sanitized.body.message).toBe('Upstream service unavailable');
      expect(sanitized.status).toBe(502);
    });
  }
});
