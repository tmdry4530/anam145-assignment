import { InvalidAddressError, RPCTimeoutError } from './errors.js';

export function sanitizeError(error: Error): { status: number; body: { error: string; message: string } } {
  if (error instanceof InvalidAddressError) {
    return {
      status: 400,
      body: { error: 'INVALID_ADDRESS', message: 'Invalid Ethereum address format' },
    };
  }
  return {
    status: 502,
    body: { error: 'RPC_ERROR', message: 'Upstream service unavailable' },
  };
}
