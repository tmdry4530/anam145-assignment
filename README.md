# Ethereum RPC Gateway & Wallet Balance (Sepolia)

브라우저는 RPC Provider에 직접 접근하지 않는다. 백엔드가 Gateway 역할을 한다.

## 아키텍처

```
[Browser]
   │  GET /api/balance?address=0x...
[Backend]
   ├─ 입력 검증 (EIP-55 체크섬)
   ├─ Rate Limiting (IP 기반, 분당 10회)
   ├─ 캐싱 (TTL 30초)
   ├─ RPC 응답 검증 (hex 형식, 범위)
   └─ 에러 새니타이징 (내부 정보 제거)
   │  eth_getBalance
[RPC Provider] (Alchemy/Infura — Sepolia)
```

---

## 문제 → 해결

### RPC 자원 고갈
스크립트로 수만 건 요청 시 API Key 한도 소진.  
→ IP 기반 고정 윈도우 Rate Limiter (분당 10회). 초과 시 429.

### X-Forwarded-For 스푸핑
헤더에 가짜 IP를 삽입해 Rate Limit 우회 시도.  
→ `trustedProxyCount` 기반 우측 오프셋 추출. 좌측 스푸핑 값 무시.

### 반복 조회 부하
동일 주소 반복 요청 시 매번 RPC 호출.  
→ TTL 기반 in-memory 캐시. 캐시 키는 소문자 정규화 (체크섬 케이스 차이 무관).

### 입력 인젝션 (XSS / 주소 위조)
`?address=0x<script>` 같은 입력으로 반사형 XSS 시도.  
→ `/^[0-9a-fA-F]{40}$/` 화이트리스트 + EIP-55 체크섬 검증.  
→ EIP-55는 Node.js 내장 SHA-3와 패딩이 달라 Keccak-256을 직접 구현.

### RPC 응답 오류
`null`, 음수, 비hex 문자열 등 잘못된 응답이 올 수 있음.  
→ 형식 검증(hex 파싱) + 범위 검증(0 ~ 120M ETH). 타임아웃 10초(AbortController).

### API Key / 내부 정보 유출
Node.js 에러 메시지에 RPC URL, API Key, 파일 경로가 포함됨.  
→ 에러 타입별 분류 후 고정 메시지로 대체. 내부 정보 일절 미포함.

### RPC URL 노출
프론트엔드 소스에서 URL 추출 후 직접 호출 가능.  
→ 프론트엔드는 `/api/balance`만 호출. RPC URL은 서버 환경변수에만 존재.

---

## 위협 모델

| 위협 | 방어 수단 | 구현 |
|---|---|---|
| RPC 자원 고갈 | Rate Limiting | ✅ |
| XFF 스푸핑 | trustedProxyCount 기반 IP 추출 | ✅ |
| 반복 조회 부하 | TTL 캐시 | ✅ |
| 입력 인젝션 | 정규식 + EIP-55 체크섬 | ✅ |
| RPC 응답 조작 | 형식 + 범위 검증 | ✅ |
| API Key 유출 | 에러 새니타이징 | ✅ |
| RPC URL 노출 | Gateway 패턴 | ✅ |
| 캐시 타이밍 사이드채널 | 미구현 — 응답 시간 정규화로 완화 가능 | ⚠️ |
| RPC MITM | 미구현 — 복수 Provider 교차 검증 필요 | ⚠️ |

---

## 한계점

1. **In-memory Rate Limiter** — 서버 재시작 시 초기화, 다중 인스턴스 공유 불가. 프로덕션에서는 Redis 필요.
2. **캐시 정합성** — TTL 30초 동안 실제 잔액과 불일치 가능.
3. **캐시 타이밍 사이드채널** — 캐시 히트/미스 간 응답 시간 차이로 조회 패턴 추론 가능. 최소 응답 지연 삽입으로 완화 가능하나 과제 범위 외로 미구현.
4. **단일 RPC Provider 신뢰** — MITM 시 위변조 잔액 탐지 불가. 복수 Provider 교차 검증 필요.
5. **DDoS** — 애플리케이션 레벨 방어만으로는 부족. Cloudflare 등 인프라 레벨 필요.

---

## Zero Address

`0x0000000000000000000000000000000000000000`은 유효한 주소로 허용한다. 실제 ETH를 보유할 수 있으며 EIP-55 체크섬도 유효하다.

---

## 실행 방법

```bash
cp .env.example .env
# .env: RPC_URL=https://eth-sepolia.g.alchemy.com/v2/{YOUR_KEY}

npm install
npm run dev   # http://localhost:3000
npm test
```
