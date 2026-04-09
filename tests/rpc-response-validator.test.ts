import { describe, it, expect } from 'vitest';
import { validateBalanceResponse } from '../src/rpc-response-validator.js';
import { RPCParseError, RPCResponseRangeError } from '../src/errors.js';

describe('RPC Response Validator', () => {
  describe('PASS cases', () => {
    it('"0x0" → 0n', () => { expect(validateBalanceResponse('0x0')).toBe(0n); });
    it('"0xDE0B6B3A7640000" → 1 ETH in wei', () => { expect(validateBalanceResponse('0xDE0B6B3A7640000')).toBe(1000000000000000000n); });
    it('"0x1" → 1n', () => { expect(validateBalanceResponse('0x1')).toBe(1n); });
  });

  describe('FAIL cases', () => {
    it('null → RPCParseError', () => { expect(() => validateBalanceResponse(null)).toThrow(RPCParseError); });
    it('undefined → RPCParseError', () => { expect(() => validateBalanceResponse(undefined)).toThrow(RPCParseError); });
    it('빈 문자열 → RPCParseError', () => { expect(() => validateBalanceResponse('')).toThrow(RPCParseError); });
    it('"not_hex" → RPCParseError', () => { expect(() => validateBalanceResponse('not_hex')).toThrow(RPCParseError); });
    it('"0xZZZZ" → RPCParseError', () => { expect(() => validateBalanceResponse('0xZZZZ')).toThrow(RPCParseError); });
    it('숫자 123 → RPCParseError', () => { expect(() => validateBalanceResponse(123)).toThrow(RPCParseError); });
    it('"-0x1" → RPCResponseRangeError', () => { expect(() => validateBalanceResponse('-0x1')).toThrow(RPCResponseRangeError); });
    it('ETH 총 공급량 초과 → RPCResponseRangeError', () => { expect(() => validateBalanceResponse('0x' + 'F'.repeat(80))).toThrow(RPCResponseRangeError); });
  });
});
