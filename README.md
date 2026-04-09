# Ethereum RPC Gateway & Wallet Balance (Sepolia)

Ethereum Sepolia 테스트넷의 지갑 잔액을 안전하게 조회하는 Gateway 서버.
브라우저는 RPC Provider에 직접 접근하지 않으며, 백엔드가 Gateway 역할을 수행한다.

## 아키텍처

```
[Browser]
   │
   │  GET /api/balance?address=0x...
   │
[Backend API Server]
   ├─ 입력 검증 (EIP-55 체크섬)
   ├─ Rate Limiting (IP 기반, X-Forwarded-For 스푸핑 방어)
   ├─ 캐싱 (TTL 기반, 동일 주소 반복 조회 방지)
   ├─ RPC 응답 검증 (hex 형식, 범위 검증)
   ├─ 에러 새니타이징 (내부 정보 유출 차단)
   │
   │  eth_getBalance (JSON-RPC)
   │
[RPC Provider] (Alchemy/Infura — Sepolia)
```

각 레이어 역할:
- **입력 검증**: 0x + 40자 hex 형식 확인, EIP-55 체크섬 검증, XSS/인젝션 차단
- **Rate Limiting**: IP 기반 분당 요청 수 제한, X-Forwarded-For 스푸핑 방어
- **캐싱**: 동일 주소 반복 조회 시 RPC 호출 생략 (TTL 만료 후 갱신)
- **RPC 응답 검증**: hex 형식 확인, 음수/총 공급량 초과 등 비현실적 값 거부
- **에러 새니타이징**: RPC URL, API Key, 스택 트레이스 등 내부 정보를 클라이언트 응답에서 제거

## 위협 모델 및 방어 매핑

| 위협 | 공격 시나리오 | 방어 수단 | 구현 여부 |
|---|---|---|---|
| RPC 자원 고갈 | 스크립트로 수만 건 반복 조회 | Rate Limiting (IP 기반, 분당 10회) | ✅ 구현 |
| RPC URL 노출 | 프론트엔드 소스에서 URL 추출 후 직접 호출 | Gateway 패턴 (백엔드에서만 RPC 호출) | ✅ 구현 |
| 반복 조회 부하 | 동일 주소를 수백 회 조회 | 캐싱 (TTL 30초) | ✅ 구현 |
| X-Forwarded-For 스푸핑 | 가짜 IP로 rate limit 우회 | 신뢰 프록시 수 기반 IP 추출 | ✅ 구현 |
| API Key 유출 | 에러 응답/로그에 Key 포함 | 에러 새니타이징 | ✅ 구현 |
| 캐시 타이밍 사이드채널 | 응답 시간 차이로 타인의 조회 패턴 추론 | 최소 응답 지연 정규화 | ⚠️ 미구현 (아래 한계점 참조) |
| RPC 응답 조작 (MITM) | 위변조된 잔액 반환 | 다중 RPC 교차 검증 / light client 검증 | ⚠️ 미구현 (아래 한계점 참조) |
| 입력 인젝션 | 주소 파라미터에 XSS/SQL 삽입 | 정규식 기반 입력 검증 + 체크섬 검증 | ✅ 구현 |

## 한계점

1. **In-memory rate limiter의 한계:** 서버 재시작 시 카운터 초기화, 다중 인스턴스 환경에서 공유 불가 → 프로덕션에서는 Redis 등 외부 저장소 필요
2. **캐시 정합성:** TTL(30초) 동안 실제 잔액과 캐시 값이 불일치할 수 있음 → 실시간성이 중요한 서비스에는 WebSocket/SSE 기반 구독 모델 검토 필요
3. **IP 스푸핑 완전 차단 불가:** 프록시/VPN/Tor를 통한 IP 변경은 원천 차단 불가 → API Key 기반 인증 레이어 추가 검토
4. **캐시 타이밍 사이드채널:** 현재 구현은 캐시 히트/미스 간 응답 시간 차이가 존재하여, 제3자가 특정 주소의 최근 조회 여부를 추론할 수 있음 → 최소 응답 지연 삽입(모든 응답에 일정 delay 부여)으로 완화 가능하나, 과제 범위 외로 판단하여 미구현
5. **RPC 응답 신뢰 문제:** 현재 단일 RPC Provider 응답을 무조건 신뢰 → 프로덕션에서는 복수 Provider 교차 검증 또는 Ethereum light client를 통한 상태 증명(Merkle proof) 검증 필요
6. **DDoS:** 애플리케이션 레벨 rate limiting만으로는 네트워크 레벨 DDoS 방어 불가 → Cloudflare 등 인프라 레벨 방어 필요

## Zero Address 설계 결정

`0x0000000000000000000000000000000000000000` (zero address)는 유효한 Ethereum 주소로 간주하여 조회를 허용한다. Zero address는 실제로 ETH를 보유할 수 있으며, 컨트랙트 생성 트랜잭션의 수신자로 사용되는 유효한 주소이다.

## 실행 방법

```bash
# 환경변수 설정
cp .env.example .env
# .env 파일에 RPC_URL=https://eth-sepolia.g.alchemy.com/v2/{YOUR_KEY} 설정

# 의존성 설치
npm install

# 서버 실행
npm run dev

# 테스트
npm test
```

## 프로젝트 구조

```
src/
  address-validator.ts  — EIP-55 체크섬 기반 주소 검증
  rate-limiter.ts       — IP 기반 in-memory rate limiter
  client-identifier.ts  — X-Forwarded-For 스푸핑 방어 IP 추출
  rpc-client.ts         — JSON-RPC eth_getBalance 호출 (timeout/abort 포함)
  rpc-response-validator.ts — RPC 응답 hex/범위 검증
  cache.ts              — TTL 기반 in-memory 잔액 캐시
  error-sanitizer.ts    — 내부 정보 유출 차단 에러 변환
  errors.ts             — 커스텀 에러 클래스
  server.ts             — HTTP 서버 (API + static serving)

tests/
  address-validator.test.ts
  rate-limiter.test.ts
  client-identifier.test.ts
  rpc-client.test.ts
  rpc-response-validator.test.ts
  cache.test.ts
  error-sanitizer.test.ts
  integration.test.ts
  frontend.test.ts

public/
  index.html            — 잔액 조회 프론트엔드
```
