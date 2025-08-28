# 채권도시 챗봇 - 상세 개발문서

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기술 스택](#기술-스택)
4. [설치 및 실행](#설치-및-실행)
5. [핵심 기능 상세](#핵심-기능-상세)
6. [API 문서](#api-문서)
7. [데이터베이스 구조](#데이터베이스-구조)
8. [보안 구현](#보안-구현)
9. [배포 가이드](#배포-가이드)
10. [트러블슈팅](#트러블슈팅)

---

## 🎯 프로젝트 개요

### 프로젝트명
**채권도시 챗봇** (Knowledge Explorer Chatbot)

### 프로젝트 목적
- Google Gemini AI를 활용한 지능형 챗봇 서비스
- Google OAuth를 통한 사용자 인증 및 개인화
- 실시간 스트리밍 채팅 인터페이스
- 사용자별 대화 기록 및 메모리 관리

### 주요 특징
- 🤖 **AI 기반 대화**: Google Gemini API 활용
- 🔐 **보안 인증**: Google OAuth 2.0
- 💬 **실시간 채팅**: Server-Sent Events (SSE) 스트리밍
- 🧠 **메모리 시스템**: 사용자별 장기 기억 관리
- 🛡️ **보안 강화**: CSP, 프롬프트 주입 방지
- 📱 **반응형 UI**: Tailwind CSS 기반 모던 인터페이스

---

## 🏗️ 시스템 아키텍처

### 전체 구조
```
채권도시 챗봇
├── Frontend (React + TypeScript)
│   ├── 포트: 8000
│   ├── Vite 빌드 시스템
│   └── Tailwind CSS 스타일링
├── Backend (Node.js + Express)
│   ├── 포트: 3001
│   ├── PostgreSQL 데이터베이스
│   └── Google Gemini API 연동
└── External Services
    ├── Google OAuth 2.0
    ├── Google Gemini AI
    └── PostgreSQL Database
```

### 디렉토리 구조
```
지식-탐험가/
├── src/                          # 백엔드 소스코드
│   ├── index.js                  # 메인 서버 파일
│   ├── routes/                   # API 라우트
│   │   ├── authRoutes.js         # 인증 관련 API
│   │   ├── chatRoutes.js         # 채팅 관련 API
│   │   ├── userRoutes.js         # 사용자 관리 API
│   │   ├── memoryRoutes.js       # 메모리 관리 API
│   │   └── securityRoutes.js     # 보안 관련 API
│   ├── services/                 # 비즈니스 로직
│   │   ├── authService.js        # 인증 서비스
│   │   ├── chatHistoryService.js # 채팅 히스토리 서비스
│   │   ├── geminiService.js      # Gemini AI 서비스
│   │   ├── memoryService.js      # 메모리 서비스
│   │   └── securityService.js    # 보안 서비스
│   ├── middleware/               # 미들웨어
│   │   ├── auth.js               # 인증 미들웨어
│   │   ├── security.js           # 보안 미들웨어
│   │   └── validation.js         # 유효성 검증
│   └── prompts/                  # AI 프롬프트
│       └── chatPrompt.js         # 채팅 프롬프트 정의
├── components/                   # 프론트엔드 컴포넌트
│   ├── App.tsx                   # 메인 앱 컴포넌트
│   ├── ChatInterface.tsx         # 채팅 인터페이스
│   ├── ChatHistory.tsx           # 채팅 히스토리
│   ├── LoginButton.tsx           # 로그인 버튼
│   ├── UserProfile.tsx           # 사용자 프로필
│   ├── MemoryManager.tsx         # 메모리 관리
│   └── icons/                    # 아이콘 컴포넌트
├── services/                     # 프론트엔드 서비스
│   ├── chatHistoryService.ts     # 채팅 히스토리 API
│   └── geminiService.ts          # Gemini API 연동
├── types.ts                      # TypeScript 타입 정의
├── vite.config.ts                # Vite 설정
├── tailwind.config.js            # Tailwind CSS 설정
├── package.json                  # 프로젝트 의존성
└── .env                          # 환경 변수
```

---

## 🛠️ 기술 스택

### Frontend
- **React 18**: 사용자 인터페이스 프레임워크
- **TypeScript**: 타입 안전성 및 개발 생산성
- **Vite**: 빠른 개발 서버 및 빌드 도구
- **Tailwind CSS**: 유틸리티 기반 CSS 프레임워크
- **React Hooks**: 상태 관리 및 사이드 이펙트

### Backend
- **Node.js**: 서버 런타임 환경
- **Express.js**: 웹 애플리케이션 프레임워크
- **PostgreSQL**: 관계형 데이터베이스
- **Passport.js**: 인증 미들웨어
- **JWT**: 토큰 기반 인증

### External APIs
- **Google Gemini AI**: 대화형 AI 모델
- **Google OAuth 2.0**: 사용자 인증
- **Google Cloud Console**: OAuth 클라이언트 관리

### Development Tools
- **Nodemon**: 개발 서버 자동 재시작
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅

---

## 🚀 설치 및 실행

### 1. 환경 요구사항
- Node.js 18.0.0 이상
- PostgreSQL 12.0 이상
- npm 또는 yarn

### 2. 프로젝트 클론
```bash
git clone [repository-url]
cd 지식-탐험가
```

### 3. 의존성 설치
```bash
npm install
```

### 4. 환경 변수 설정
`.env` 파일 생성:
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Server
PORT=3001
FRONTEND_URL=http://localhost:8000
```

### 5. Google OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" → "사용자 인증 정보"
4. "OAuth 클라이언트 ID" 생성
5. 승인된 리디렉션 URI: `http://localhost:3001/api/auth/google/callback`

### 6. Google Gemini API 설정
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. API 키 생성
3. 환경 변수에 설정

### 7. 서버 실행
```bash
# 백엔드 서버 (포트 3001)
npm run dev

# 프론트엔드 서버 (포트 8000)
npm run dev:frontend
```

### 8. 접속
- **애플리케이션**: http://localhost:8000
- **API 문서**: http://localhost:3001/health

---

## 🔧 핵심 기능 상세

### 1. 사용자 인증 시스템

#### Google OAuth 2.0 구현
**관련 파일**: `src/routes/authRoutes.js`, `src/services/authService.js`

```javascript
// Google OAuth Strategy 설정
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await authService.createOrUpdateGoogleUser(profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));
```

**주요 기능**:
- Google 계정으로 로그인
- 사용자 프로필 자동 생성/업데이트
- JWT 토큰 기반 세션 관리
- 자동 로그인 상태 유지

#### 인증 미들웨어
**관련 파일**: `src/middleware/auth.js`

```javascript
// 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
```

### 2. AI 채팅 시스템

#### Gemini API 연동
**관련 파일**: `src/services/geminiService.js`

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const createChatSession = (history = []) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const chat = model.startChat({
    history: history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: msg.text
    }))
  });
  
  return {
    sendMessage: async (message) => {
      const result = await chat.sendMessage(message);
      return result;
    }
  };
};
```

#### 프롬프트 엔지니어링
**관련 파일**: `src/prompts/chatPrompt.js`

```javascript
// 보안 검사 함수
checkSecurityThreat: function(userQuestion) {
  const question = userQuestion.toLowerCase();
  
  const dangerousPatterns = [
    /(?:프롬프트|prompt|지시사항|instructions|시스템|system|규칙|rules|코드|code)/i,
    /(?:너는|당신은|you are|you're|AI야|AI인가|인공지능|artificial intelligence)/i,
    /(?:기술|technology|알고리즘|algorithm|모델|model|학습|training|개발|development)/i,
    /(?:기밀|confidential|비밀|secret|내부|internal)/i
  ];
  
  for (let pattern of dangerousPatterns) {
    if (pattern.test(question)) {
      return { threat: 'SECURITY_THREAT', level: 'HIGH' };
    }
  }
  
  return { threat: 'NONE', level: 'LOW' };
}
```

**주요 기능**:
- 프롬프트 주입 공격 방지
- AI 정체성 탐색 차단
- 시스템 정보 요청 차단
- 안전한 응답 구조 강제

#### 스트리밍 응답
**관련 파일**: `src/routes/chatRoutes.js`

```javascript
// 스트리밍 응답 설정
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// 단어 단위 스트리밍 효과
const words = paragraph.content.trim().split(/\s+/);
let currentText = '';

for (let j = 0; j < words.length; j++) {
  currentText += (j > 0 ? ' ' : '') + words[j];
  
  res.write(`DATA: ${JSON.stringify({
    type: 'streaming',
    message: { ...savedMessage, text: currentText, isStreaming: true },
    paragraphIndex: i + 1,
    totalParagraphs: parsedResponse.paragraphs.length,
    wordIndex: j + 1,
    totalWords: words.length
  })}\n\n`);
  
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 30));
}
```

### 3. 채팅 히스토리 관리

#### 데이터베이스 구조
**관련 파일**: `src/services/chatHistoryService.js`

```javascript
// 채팅 세션 생성
const createNewChat = async (userId) => {
  const query = `
    INSERT INTO chat_sessions (user_id, title, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    RETURNING *
  `;
  
  const result = await pool.query(query, [userId, '새로운 대화']);
  return result.rows[0];
};

// 메시지 저장
const saveMessage = async (chatId, sender, text, context = null) => {
  const query = `
    INSERT INTO messages (chat_id, text, sender, sources, follow_up_questions, context, status, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id, text, sender, context, timestamp
  `;
  
  const result = await pool.query(query, [
    chatId, text, sender, JSON.stringify([]), JSON.stringify([]), context, 'sent'
  ]);
  
  return result.rows[0];
};
```

**주요 기능**:
- 사용자별 채팅 세션 관리
- 메시지 히스토리 저장
- 맥락 정보 유지
- 실시간 동기화

### 4. 메모리 시스템

#### 장기 기억 관리
**관련 파일**: `src/services/memoryService.js`

```javascript
// 메모리 추출 및 저장
const extractAndSaveMemory = async (userId, chatId, conversationContexts) => {
  try {
    // 대화에서 중요한 정보 추출
    const importantInfo = await extractImportantInfo(conversationContexts);
    
    if (importantInfo.length > 0) {
      for (const info of importantInfo) {
        await saveUserMemory(userId, info.title, info.content, info.category);
      }
    }
  } catch (error) {
    console.error('메모리 저장 실패:', error);
  }
};

// 사용자 메모리 조회
const getUserMemories = async (userId) => {
  const query = `
    SELECT * FROM user_memories 
    WHERE user_id = $1 AND deleted_at IS NULL 
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
};
```

**주요 기능**:
- 대화에서 중요한 정보 자동 추출
- 사용자별 개인화된 기억 저장
- 맥락에 맞는 메모리 활용
- 장기 기억 기반 개인화 응답

### 5. 보안 시스템

#### Content Security Policy (CSP)
**관련 파일**: `vite.config.ts`

```typescript
headers: {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: http: https: localhost:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';"
}
```

#### 보안 미들웨어
**관련 파일**: `src/middleware/security.js`

```javascript
// XSS 방지
const xssProtection = (req, res, next) => {
  // 입력 데이터 정제
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
  }
  next();
};

// SQL 인젝션 방지
const sqlInjectionProtection = (req, res, next) => {
  const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i;
  
  if (req.body && JSON.stringify(req.body).match(sqlPattern)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  next();
};
```

---

## 📚 API 문서

### 인증 API

#### POST /api/auth/google
Google OAuth 로그인 시작
- **응답**: Google OAuth 페이지로 리다이렉트

#### GET /api/auth/google/callback
Google OAuth 콜백 처리
- **파라미터**: `code` (Google OAuth 코드)
- **응답**: JWT 토큰과 함께 프론트엔드로 리다이렉트

#### GET /api/auth/me
현재 사용자 정보 조회
- **헤더**: `Authorization: Bearer <token>`
- **응답**: 사용자 프로필 정보

### 채팅 API

#### GET /api/chats
사용자의 채팅 목록 조회
- **헤더**: `Authorization: Bearer <token>`
- **응답**: 채팅 세션 목록

#### POST /api/chats
새 채팅 세션 생성
- **헤더**: `Authorization: Bearer <token>`
- **응답**: 새로 생성된 채팅 세션

#### GET /api/chats/:chatId
특정 채팅 세션 조회
- **파라미터**: `chatId` (채팅 ID)
- **헤더**: `Authorization: Bearer <token>`
- **응답**: 채팅 세션 및 메시지 목록

#### POST /api/chats/:chatId/messages
메시지 전송 및 AI 응답
- **파라미터**: `chatId` (채팅 ID)
- **헤더**: `Authorization: Bearer <token>`
- **바디**: `{ "message": "사용자 메시지" }`
- **응답**: Server-Sent Events 스트리밍

### 메모리 API

#### GET /api/memories
사용자 메모리 목록 조회
- **헤더**: `Authorization: Bearer <token>`
- **응답**: 사용자 메모리 목록

#### POST /api/memories
새 메모리 생성
- **헤더**: `Authorization: Bearer <token>`
- **바디**: `{ "title": "제목", "content": "내용", "category": "카테고리" }`
- **응답**: 새로 생성된 메모리

---

## 🗄️ 데이터베이스 구조

### 테이블 구조

#### users 테이블
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  company VARCHAR(255),
  role VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  profile_picture TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### chat_sessions 테이블
```sql
CREATE TABLE chat_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255),
  context TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### messages 테이블
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) REFERENCES chat_sessions(id),
  text TEXT NOT NULL,
  sender VARCHAR(50) NOT NULL,
  sources JSONB DEFAULT '[]',
  follow_up_questions JSONB DEFAULT '[]',
  context TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### user_memories 테이블
```sql
CREATE TABLE user_memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  importance INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### security_threats 테이블
```sql
CREATE TABLE security_threats (
  id SERIAL PRIMARY KEY,
  threat_type VARCHAR(100) NOT NULL,
  threat_level VARCHAR(50) NOT NULL,
  user_question TEXT,
  detected_patterns TEXT[],
  user_ip VARCHAR(45),
  user_agent TEXT,
  chat_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛡️ 보안 구현

### 1. 인증 보안
- **JWT 토큰**: 서명된 토큰으로 사용자 인증
- **토큰 만료**: 자동 만료 및 갱신 메커니즘
- **HTTPS 강제**: 프로덕션 환경에서 HTTPS 사용

### 2. 입력 검증
- **XSS 방지**: HTML 태그 및 스크립트 필터링
- **SQL 인젝션 방지**: 파라미터화된 쿼리 사용
- **입력 길이 제한**: 메시지 길이 및 파일 크기 제한

### 3. 프롬프트 보안
- **프롬프트 주입 방지**: 위험한 패턴 감지 및 차단
- **AI 정체성 보호**: AI 관련 질문 차단
- **시스템 정보 보호**: 내부 구조 정보 요청 차단

### 4. 네트워크 보안
- **CORS 설정**: 허용된 도메인만 접근 가능
- **Rate Limiting**: API 요청 제한
- **헤더 보안**: 보안 관련 HTTP 헤더 설정

---

## 🚀 배포 가이드

### 1. 프로덕션 환경 설정

#### 환경 변수 설정
```env
# 프로덕션 환경 변수
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# 데이터베이스
DATABASE_URL=postgresql://username:password@host:5432/database_name

# Google OAuth (프로덕션)
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback

# JWT Secret (강력한 시크릿 사용)
JWT_SECRET=your_very_strong_jwt_secret_here

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

#### Google OAuth 프로덕션 설정
1. Google Cloud Console에서 프로덕션 OAuth 클라이언트 생성
2. 승인된 리디렉션 URI: `https://your-domain.com/api/auth/google/callback`
3. 승인된 JavaScript 원본: `https://your-domain.com`

### 2. 빌드 및 배포

#### 프론트엔드 빌드
```bash
npm run build
```

#### 백엔드 배포
```bash
# PM2를 사용한 프로세스 관리
npm install -g pm2
pm2 start src/index.js --name "chatbot-backend"
pm2 save
pm2 startup
```

### 3. Nginx 설정
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # 프론트엔드
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 백엔드 API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 트러블슈팅

### 1. 포트 충돌 문제
**증상**: `Error: listen EADDRINUSE: address already in use :::3001`

**해결 방법**:
```bash
# Windows
taskkill /f /im node.exe

# Linux/Mac
pkill -f node

# 또는 다른 포트 사용
PORT=3002 npm run dev
```

### 2. Google OAuth 오류
**증상**: "OAuth client was not found"

**해결 방법**:
1. Google Cloud Console에서 OAuth 클라이언트 ID 확인
2. 승인된 리디렉션 URI 확인
3. 환경 변수 재설정

### 3. Gemini API 오류
**증상**: "API key not valid"

**해결 방법**:
1. Google AI Studio에서 API 키 재생성
2. 환경 변수 업데이트
3. API 키 권한 확인

### 4. 데이터베이스 연결 오류
**증상**: "Connection refused"

**해결 방법**:
1. PostgreSQL 서비스 상태 확인
2. 데이터베이스 URL 확인
3. 방화벽 설정 확인

### 5. CSP 오류
**증상**: "Content Security Policy blocks eval()"

**해결 방법**:
1. `vite.config.ts`에서 CSP 설정 확인
2. 개발 환경에서 `unsafe-eval` 허용
3. 프로덕션에서는 더 엄격한 정책 적용

### 6. 메모리 누수
**증상**: 서버 메모리 사용량 증가

**해결 방법**:
1. 연결 풀 설정 확인
2. 정기적인 가비지 컬렉션
3. 메모리 모니터링 도구 사용

---

## 📊 성능 최적화

### 1. 데이터베이스 최적화
- **인덱스 생성**: 자주 조회되는 컬럼에 인덱스 추가
- **쿼리 최적화**: N+1 문제 방지
- **연결 풀**: 적절한 연결 풀 크기 설정

### 2. 캐싱 전략
- **Redis 캐싱**: 자주 조회되는 데이터 캐싱
- **메모리 캐싱**: 사용자 세션 정보 캐싱
- **CDN**: 정적 파일 CDN 사용

### 3. 코드 최적화
- **번들 크기 최적화**: Tree shaking 및 코드 분할
- **이미지 최적화**: WebP 형식 사용
- **지연 로딩**: 필요시에만 컴포넌트 로드

---

## 🔄 유지보수

### 1. 로그 관리
- **구조화된 로깅**: JSON 형식 로그
- **로그 레벨**: DEBUG, INFO, WARN, ERROR
- **로그 로테이션**: 정기적인 로그 파일 관리

### 2. 모니터링
- **헬스 체크**: `/health` 엔드포인트
- **성능 모니터링**: 응답 시간 및 처리량
- **에러 추적**: 에러 발생 시 알림

### 3. 백업 전략
- **데이터베이스 백업**: 정기적인 백업
- **코드 백업**: Git 저장소 관리
- **환경 설정 백업**: 환경 변수 및 설정 파일

---

## 📝 개발 가이드라인

### 1. 코드 스타일
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅
- **TypeScript**: 타입 안전성

### 2. 커밋 메시지
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 프로세스 수정
```

### 3. 브랜치 전략
- **main**: 프로덕션 브랜치
- **develop**: 개발 브랜치
- **feature/**: 기능 개발 브랜치
- **hotfix/**: 긴급 수정 브랜치

---

## 📞 지원 및 문의

### 개발팀 연락처
- **프로젝트 매니저**: [이메일]
- **백엔드 개발자**: [이메일]
- **프론트엔드 개발자**: [이메일]

### 문서 버전
- **버전**: 1.0.0
- **최종 업데이트**: 2025년 8월 27일
- **작성자**: 개발팀

---

**© 2025 채권도시 챗봇 개발팀. All rights reserved.**
