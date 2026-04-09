import { describe, it, expect } from 'vitest';
import { validateAddress } from '../src/address-validator.js';
import { InvalidAddressError } from '../src/errors.js';

describe('AddressValidator', () => {
  describe('PASS cases', () => {
    it('체크섬 주소를 그대로 반환한다 (vitalik.eth)', () => {
      expect(validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'))
        .toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });

    it('전부 소문자 → EIP-55 체크섬 적용 후 반환', () => {
      expect(validateAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045'))
        .toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });

    it('전부 대문자 → EIP-55 체크섬 적용 후 반환', () => {
      expect(validateAddress('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045'))
        .toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });

    it('zero address를 허용한다', () => {
      expect(validateAddress('0x0000000000000000000000000000000000000000'))
        .toBe('0x0000000000000000000000000000000000000000');
    });
  });

  describe('FAIL cases', () => {
    it('빈 문자열', () => {
      expect(() => validateAddress('')).toThrow(InvalidAddressError);
    });
    it('null', () => {
      expect(() => validateAddress(null)).toThrow(InvalidAddressError);
    });
    it('undefined', () => {
      expect(() => validateAddress(undefined)).toThrow(InvalidAddressError);
    });
    it('길이 부족 (0x123)', () => {
      expect(() => validateAddress('0x123')).toThrow(InvalidAddressError);
    });
    it('비hex 문자 포함', () => {
      expect(() => validateAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow(InvalidAddressError);
    });
    it('0x 접두사 없음', () => {
      expect(() => validateAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toThrow(InvalidAddressError);
    });
    it('체크섬 불일치 (mixed case)', () => {
      expect(() => validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96046')).toThrow(InvalidAddressError);
    });
    it('후행 공백', () => {
      expect(() => validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 ')).toThrow(InvalidAddressError);
    });
    it('XSS 시도', () => {
      expect(() => validateAddress('0x<script>alert(1)</script>')).toThrow(InvalidAddressError);
    });
    it('유효 hex지만 체크섬 불일치 (mixed case)', () => {
      expect(() => validateAddress('0xaBCDEF1234567890abcdef1234567890AbCdEf12')).toThrow(InvalidAddressError);
    });
  });
});
