import { describe, it, expect } from 'vitest';
import { extractIP } from '../src/client-identifier.js';
import type { IncomingMessage } from 'node:http';

function mockReq(xff: string | undefined, socketIP = '10.0.0.99'): IncomingMessage {
  return {
    headers: xff !== undefined ? { 'x-forwarded-for': xff } : {},
    socket: { remoteAddress: socketIP },
  } as unknown as IncomingMessage;
}

describe('ClientIdentifier — X-Forwarded-For 스푸핑 방어', () => {
  it('시나리오 1: 헤더 없으면 소켓 IP', () => {
    expect(extractIP(mockReq(undefined), 1)).toBe('10.0.0.99');
  });
  it('시나리오 2: 프록시 1개, 클라이언트 IP 정상 추출', () => {
    expect(extractIP(mockReq('1.2.3.4'), 1)).toBe('1.2.3.4');
  });
  it('시나리오 3: 좌측 spoofed 값 무시', () => {
    expect(extractIP(mockReq('spoofed, 1.2.3.4'), 1)).toBe('1.2.3.4');
  });
  it('시나리오 4: 다중 스푸핑 시도', () => {
    expect(extractIP(mockReq('spoofed1, spoofed2, 1.2.3.4'), 1)).toBe('1.2.3.4');
  });
  it('시나리오 5: 프록시 2개 환경', () => {
    expect(extractIP(mockReq('1.2.3.4, 10.0.0.1'), 2)).toBe('1.2.3.4');
  });
  it('시나리오 6: 빈 문자열 헤더는 소켓 IP', () => {
    expect(extractIP(mockReq(''), 1)).toBe('10.0.0.99');
  });
});
