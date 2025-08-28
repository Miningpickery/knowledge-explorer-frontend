# 🔒 보안 가이드 (Security Guide)

## 📋 개요

이 문서는 지식 탐험가(Knowledge Explorer) 시스템의 보안 정책과 구현 사항을 설명합니다.

## 🛡️ 보안 아키텍처

### 1. 인증 및 권한 관리

#### Google OAuth 2.0
- **소셜 로그인**: Google 계정을 통한 안전한 인증
- **비밀번호 없음**: 사용자 비밀번호 저장 및 관리 불필요
- **토큰 기반**: JWT 토큰으로 세션 관리

#### JWT 토큰 보안
```javascript
// 토큰 구조
{
  userId: number,
  email: string,
  name: string,
  googleId: string,
  iat: number,        // 발급 시간
  jti: string,        // 고유 토큰 ID
  exp: number         // 만료 시간
}
```

**보안 기능:**
- 토큰 만료 시간 설정 (7일)
- 고유 토큰 ID (JTI) 생성
- 블랙리스트 관리
- 알고리즘 강제 (HS256)

### 2. API 보안

#### Rate Limiting
- **일반 API**: 15분당 100개 요청
- **로그인**: 15분당 5번 시도
- **채팅**: 1분당 10개 메시지

#### 입력 검증
- SQL Injection 방지
- XSS 방지
- 입력 데이터 정제

#### CORS 정책
```javascript
const allowedOrigins = [
  'http://localhost:8000',
  'http://localhost:8001',
  'http://localhost:3000',
  process.env.FRONTEND_URL
];
```

### 3. 데이터 보안

#### 개인정보 보호
- **IP 주소 마스킹**: `192.168.1.100` → `192.168.1.*`
- **사용자 에이전트 정제**: 민감한 정보 제거
- **로그 마스킹**: 토큰, 비밀번호 등 민감 정보 자동 마스킹

#### 데이터베이스 보안
- **Prepared Statements**: SQL Injection 방지
- **인덱스 최적화**: 성능 및 보안 향상
- **소프트 삭제**: 데이터 무결성 유지

### 4. AI 보안 방어 시스템

#### 프롬프트 인젝션 방지
```javascript
const FORBIDDEN_PATTERNS = [
  /(?:system|user|assistant)\s*:\s*ignore/i,
  /(?:forget|ignore|disregard)\s+previous/i,
  /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)/i
];
```

#### AI 정체 탐지 방지
- "당신은 AI인가요?" → 보안 응답
- 시스템 정보 요청 → 차단
- 프롬프트 구조 탐지 → 방어

### 5. 모니터링 및 로깅

#### 보안 이벤트 로깅
- 모든 보안 위협 자동 로깅
- IP 기반 위협 분석
- 실시간 알림 시스템

#### 로그 보안
- 민감한 정보 자동 마스킹
- 로그 접근 권한 제한
- 로그 보관 기간 설정

## 🔧 보안 설정

### 환경 변수
```bash
# JWT 설정
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=30d

# 보안 설정
NODE_ENV=production
SESSION_SECRET=your_session_secret_here
COOKIE_SECRET=your_cookie_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:8000
```

### 보안 헤더
```javascript
// Helmet.js 설정
contentSecurityPolicy: {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "http://localhost:3001", "ws:", "wss:"]
}
```

## 🚨 보안 사고 대응

### 1. 보안 위협 감지 시
1. **즉시 로깅**: 모든 위협 자동 기록
2. **IP 분석**: 위협 패턴 분석
3. **자동 차단**: 높은 수준 위협 시 자동 차단
4. **관리자 알림**: 실시간 알림 전송

### 2. 토큰 유출 시
1. **토큰 무효화**: 블랙리스트에 추가
2. **사용자 알림**: 강제 로그아웃
3. **세션 정리**: 모든 활성 세션 종료
4. **보안 감사**: 접근 로그 분석

### 3. 데이터 유출 시
1. **접근 차단**: 즉시 시스템 접근 차단
2. **데이터 백업**: 안전한 백업 확인
3. **법적 대응**: 관련 기관 신고
4. **사용자 통지**: 개인정보 유출 통지

## 📊 보안 모니터링

### 대시보드 지표
- **총 위협 수**: 24시간 내 발생한 위협
- **위협 레벨 분포**: LOW, MEDIUM, HIGH, CRITICAL
- **시간별 통계**: 시간대별 위협 발생 패턴
- **최근 위협**: 최근 5개 위협 상세 정보

### 알림 시스템
- **이메일 알림**: 관리자 이메일로 즉시 알림
- **웹훅**: Slack, Discord 등으로 실시간 알림
- **대시보드**: 실시간 보안 상태 모니터링

## 🔄 보안 업데이트

### 정기 점검 사항
- [ ] JWT 토큰 만료 시간 검토
- [ ] Rate Limiting 설정 검토
- [ ] 보안 패턴 업데이트
- [ ] 의존성 패키지 보안 업데이트
- [ ] 로그 분석 및 패턴 학습

### 보안 테스트
- [ ] SQL Injection 테스트
- [ ] XSS 공격 테스트
- [ ] CSRF 공격 테스트
- [ ] Rate Limiting 테스트
- [ ] 토큰 보안 테스트

## 📞 보안 문의

보안 관련 문의사항이나 취약점 신고는 다음으로 연락주세요:

- **이메일**: security@knowledge-explorer.com
- **보안 팀**: 보안 담당자에게 직접 연락
- **긴급**: 24시간 보안 핫라인

---

**마지막 업데이트**: 2025년 1월
**버전**: 1.0.0
**보안 레벨**: 높음
