import { RPCParseError, RPCResponseRangeError } from './errors.js';

const MAX_ETH_SUPPLY_WEI = 120_000_000n * 10n ** 18n;

export function validateBalanceResponse(result: unknown): bigint {
  if (result === null || result === undefined) {
    throw new RPCParseError('result field is missing');
  }
  if (typeof result !== 'string') {
    throw new RPCParseError('result must be a string');
  }
  if (result === '') {
    throw new RPCParseError('result is empty string');
  }
  if (result.startsWith('-')) {
    throw new RPCResponseRangeError('Negative balance is impossible');
  }
  if (!result.startsWith('0x') && !result.startsWith('0X')) {
    throw new RPCParseError('result is not a hex string');
  }

  const hexPart = result.slice(2);
  if (hexPart.length === 0 || !/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new RPCParseError('result contains invalid hex characters');
  }

  const value = BigInt(result);
  if (value > MAX_ETH_SUPPLY_WEI) {
    throw new RPCResponseRangeError('Balance exceeds total ETH supply');
  }
  return value;
}
