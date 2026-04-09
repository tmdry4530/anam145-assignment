import { InvalidAddressError } from './errors.js';

/**
 * 순수 Keccak-256 해시 함수 (EIP-55에 필요)
 * NIST SHA-3과 달리 패딩이 다르다.
 */
function keccak256Hex(input: string): string {
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];

  const ROTC = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
  ];

  const PI = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
  ];

  const state = new BigUint64Array(25);

  function keccakF(): void {
    for (let round = 0; round < 24; round++) {
      const C = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      }
      const D = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ ((C[(x + 1) % 5] << 1n) | (C[(x + 1) % 5] >> 63n));
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] ^= D[x];
        }
      }

      let current = state[1];
      for (let i = 0; i < 24; i++) {
        const j = PI[i];
        const temp = state[j];
        const r = BigInt(ROTC[i]);
        state[j] = (current << r) | (current >> (64n - r));
        current = temp;
      }

      for (let y = 0; y < 5; y++) {
        const T = new BigUint64Array(5);
        for (let x = 0; x < 5; x++) {
          T[x] = state[x + 5 * y];
        }
        for (let x = 0; x < 5; x++) {
          state[x + 5 * y] = T[x] ^ (~T[(x + 1) % 5] & T[(x + 2) % 5]);
        }
      }

      state[0] ^= RC[round];
    }
  }

  const rate = 136;
  const bytes = new TextEncoder().encode(input);
  const blockCount = Math.floor(bytes.length / rate) + 1;
  const padded = new Uint8Array(blockCount * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let b = 0; b < blockCount; b++) {
    for (let i = 0; i < rate / 8; i++) {
      const offset = b * rate + i * 8;
      let lane = 0n;
      for (let j = 0; j < 8; j++) {
        lane |= BigInt(padded[offset + j]) << BigInt(j * 8);
      }
      state[i] ^= lane;
    }
    keccakF();
  }

  const hash = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) {
      hash[i * 8 + j] = Number((lane >> BigInt(j * 8)) & 0xFFn);
    }
  }

  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toChecksumAddress(address: string): string {
  const lower = address.slice(2).toLowerCase();
  const hash = keccak256Hex(lower);
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    const charCode = parseInt(hash[i], 16);
    result += charCode >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return result;
}

export function validateAddress(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new InvalidAddressError();
  }

  if (input.length !== 42) {
    throw new InvalidAddressError();
  }

  if (!input.startsWith('0x')) {
    throw new InvalidAddressError();
  }

  const hexPart = input.slice(2);

  if (!/^[0-9a-fA-F]{40}$/.test(hexPart)) {
    throw new InvalidAddressError();
  }

  const isAllLower = hexPart === hexPart.toLowerCase();
  const isAllUpper = hexPart === hexPart.toUpperCase();

  if (!isAllLower && !isAllUpper) {
    const checksummed = toChecksumAddress(input);
    if (input !== checksummed) {
      throw new InvalidAddressError();
    }
    return checksummed;
  }

  return toChecksumAddress(input);
}
