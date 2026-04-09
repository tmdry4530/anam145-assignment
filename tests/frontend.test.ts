import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const htmlPath = join(import.meta.dirname, '..', 'public', 'index.html');
const html = readFileSync(htmlPath, 'utf-8');

describe('Frontend — 최소 검증 항목', () => {
  it('#1: 주소 입력 필드 존재', () => {
    expect(html).toContain('<input');
    expect(html).toContain('id="address"');
  });
  it('#2: 조회 버튼 존재', () => {
    expect(html).toContain('<button');
    expect(html).toContain('id="btn"');
  });
  it('#3: 에러 메시지 표시 로직 존재', () => {
    expect(html).toContain('class="error"');
  });
  it('#4: Rate limit 안내 메시지 존재', () => {
    expect(html).toContain('요청이 너무 많습니다');
  });
  it('#5: RPC URL이 프론트엔드 소스에 미노출', () => {
    const lower = html.toLowerCase();
    expect(lower).not.toContain('alchemy');
    expect(lower).not.toContain('infura');
    expect(lower).not.toContain('eth-sepolia');
  });
  it('#6: API Key가 프론트엔드 소스에 미노출', () => {
    expect(html).not.toMatch(/[A-Za-z0-9_-]{32,}/);
    expect(html.toLowerCase()).not.toContain('api_key');
    expect(html.toLowerCase()).not.toContain('apikey');
  });
});
