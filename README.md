# **지식 탐험가 AI 챗봇 - 상세 개발 문서**

## **📋 프로젝트 개요**

**지식 탐험가**는 Google Gemini API를 활용한 한국어 AI 챗봇으로, 실시간 정보 검색과 대화 맥락 유지 기능을 제공합니다. React 프론트엔드와 Node.js 백엔드로 구성되어 있으며, PostgreSQL 데이터베이스를 사용합니다.

### **🌟 주요 기능**
- ✅ **실시간 스트리밍 응답**: 단어별 타이핑 애니메이션
- ✅ **대화 맥락 유지**: 다중 턴 대화에서 일관성 유지
- ✅ **사용자 관리 시스템**: 회사/역할 기반 고객 관리
- ✅ **맥락 감지 AI**: 종결성 대화와 정보 요청 구분
- ✅ **마크다운 지원**: 서식 있는 텍스트 렌더링
- ✅ **반응형 UI**: 모던하고 직관적인 인터페이스

---

## **🏗️ 시스템 아키텍처**

### **전체 구조**
```
지식-탐험가/
├── 프론트엔드 (React + TypeScript)
│   ├── App.tsx                    # 메인 앱 컴포넌트
│   ├── components/                # React 컴포넌트들
│   │   ├── ChatInterface.tsx      # 채팅 인터페이스
│   │   ├── ChatHistory.tsx        # 채팅 히스토리 사이드바
│   │   ├── MessageItem.tsx        # 개별 메시지 컴포넌트
│   │   └── icons/                 # 아이콘 컴포넌트들
│   ├── services/                  # API 서비스
│   │   ├── chatHistoryService.ts  # 채팅 히스토리 관리
│   │   └── geminiService.ts       # Gemini API 연동
│   └── types.ts                   # TypeScript 타입 정의
├── 백엔드 (Node.js + Express)
│   ├── src/
│   │   ├── index.js               # 메인 서버 파일
│   │   ├── routes/                # API 라우트
│   │   │   ├── chatRoutes.js      # 대화 관리 API
│   │   │   ├── messageRoutes.js   # 메시지 전송 API
│   │   │   └── userRoutes.js      # 사용자 관리 API
│   │   ├── services/              # 비즈니스 로직
│   │   │   ├── chatHistoryService.js # 데이터베이스 서비스
│   │   │   └── geminiService.js   # AI 서비스
│   │   ├── prompts/               # AI 프롬프트
│   │   │   └── chatPrompt.js      # 통합 프롬프트 엔진
│   │   └── migrate.js             # DB 마이그레이션
│   └── package.json
└── 데이터베이스 (PostgreSQL)
    ├── users                      # 사용자 테이블
    ├── chat_sessions             # 대화 세션 테이블
    └── messages                  # 메시지 테이블
```

---

## **🚀 빠른 시작**

### **1. 필수 요구사항**
- Node.js 18+
- PostgreSQL 12+
- Google Gemini API 키

### **2. 설치**
```bash
# 저장소 클론
git clone [repository-url]
cd 지식-탐험가

# 의존성 설치
npm install
```

### **3. 환경 변수 설정**
프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 입력하세요:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Gemini API Configuration  
GEMINI_API_KEY=your_gemini_api_key_here

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/knowledge_explorer

# CORS Configuration
CORS_ORIGIN=http://localhost:8000

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random_at_least_32_characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_also_make_it_long_and_random
JWT_REFRESH_EXPIRES_IN=30d

# Security Configuration
SESSION_SECRET=your_session_secret_here_make_it_long_and_random
COOKIE_SECRET=your_cookie_secret_here_make_it_long_and_random

# Google OAuth Configuration (선택사항)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:8000
```

> ⚠️ **보안 주의사항**: 
> - 모든 `your_*_here` 값들을 실제 값으로 교체하세요
> - JWT_SECRET과 다른 시크릿 키들은 최소 32자 이상의 랜덤 문자열을 사용하세요
> - `.env` 파일은 절대 Git에 커밋하지 마세요 (이미 .gitignore에 포함됨)

### **4. 데이터베이스 설정**
```sql
-- PostgreSQL에서 데이터베이스 생성
CREATE DATABASE knowledge_explorer;
```

### **5. 데이터베이스 마이그레이션**
```bash
node src/migrate.js
```

### **6. 서버 실행**
```bash
# 개발 모드 (백엔드)
npm run dev

# 프론트엔드 개발 서버
npm run dev:frontend

# 프로덕션 모드
npm start
```

### **7. 브라우저에서 확인**
- 프론트엔드: `http://localhost:8000`
- 백엔드 API: `http://localhost:3001`
- API 상태 확인: `http://localhost:3001/health`

---

## **🔧 핵심 기능 상세**

### **1. 실시간 스트리밍 응답**
- **기술**: Server-Sent Events (SSE)
- **구현**: 백엔드에서 단어별 스트리밍, 프론트엔드에서 실시간 렌더링
- **효과**: 타이핑 애니메이션으로 자연스러운 대화 경험
- **딜레이**: 단어별 50-80ms, 문단별 500ms

### **2. 대화 맥락 유지**
- **기술**: PostgreSQL + JSONB
- **구현**: 이전 대화 히스토리를 Gemini API에 전달
- **특징**: 다중 턴 대화에서 일관성 유지
- **저장**: 사용자별 데이터 격리

### **3. 사용자 관리 시스템**
- **기술**: PostgreSQL 사용자 테이블
- **구현**: 회사/역할 기반 고객 관리
- **특징**: 데이터 격리 및 권한 제어
- **확장성**: 멀티 테넌트 지원

### **4. 맥락 감지 AI**
- **기능**: 종결성 대화와 정보 요청 구분
- **종결성 표현**: "고맙습니다", "알겠습니다", "네", "좋아요" 등
- **동적 추천**: 상황에 따라 0-3개 추천 질문
- **자연스러운 흐름**: 불필요한 추천 질문 제거

---

## **📊 데이터베이스 스키마**

### **테이블 구조**
```sql
-- 사용자 테이블
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  company VARCHAR(100),
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- 대화 세션 테이블
CREATE TABLE chat_sessions (
  id VARCHAR(50) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  context TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- 메시지 테이블
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(50) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'model')),
  sources JSONB,
  follow_up_questions JSONB,
  context TEXT,
  status VARCHAR(20) DEFAULT 'sent',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX idx_users_email ON users(email);
```

### **관계 구조**
```
users (1) ←→ (N) chat_sessions (1) ←→ (N) messages
```

---

## **🔌 API 엔드포인트**

### **사용자 관리**
| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `POST` | `/api/users` | 새 사용자 생성 |
| `GET` | `/api/users/:userId` | 특정 사용자 조회 |
| `GET` | `/api/users/email/:email` | 이메일로 사용자 조회 |
| `PUT` | `/api/users/:userId` | 사용자 정보 업데이트 |
| `DELETE` | `/api/users/:userId` | 사용자 삭제 |

### **대화 관리**
| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `GET` | `/api/chats` | 사용자별 대화 목록 조회 |
| `POST` | `/api/chats` | 새 대화 생성 |
| `GET` | `/api/chats/:chatId` | 특정 대화 조회 |
| `DELETE` | `/api/chats/:chatId` | 대화 삭제 |

### **메시지 전송**
| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `POST` | `/api/chats/:chatId/messages` | 메시지 전송 및 AI 응답 (SSE 스트리밍) |

### **상태 확인**
| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `GET` | `/health` | 서버 상태 확인 |

### **보안 모니터링**
| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `GET` | `/api/security/dashboard` | 보안 대시보드 데이터 |
| `GET` | `/api/security/threats` | 최근 보안 위협 목록 |
| `GET` | `/api/security/stats` | 보안 통계 데이터 |
| `GET` | `/api/security/analyze/:ip` | IP 기반 위협 분석 |
| `PUT` | `/api/security/threats/:id/handle` | 위협 처리 완료 표시 |
| `GET` | `/api/security/threats/:id` | 위협 상세 정보 |

---

## **💻 핵심 코드 분석**

### **프론트엔드 핵심 로직**

#### **스트리밍 메시지 처리 (App.tsx)**
```typescript
const handleStreamingData = (data: any) => {
  if (data.type === 'streaming') {
    const streamingId = `streaming-${data.paragraphIndex}-${activeChat?.id}`;
    setMessages(prev => {
      const existingIndex = prev.findIndex(msg => msg.id === streamingId);
      if (existingIndex >= 0) {
        // 기존 스트리밍 메시지 업데이트
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], text: data.message.text, isStreaming: true };
        return updated;
      } else {
        // 새 스트리밍 메시지 추가
        return [...prev, { ...data.message, id: streamingId, isStreaming: true }];
      }
    });
  } else if (data.type === 'paragraph' || data.type === 'followUp') {
    // 스트리밍 완료, 최종 메시지로 변환
    const streamingId = `streaming-${data.paragraphIndex}-${activeChat?.id}`;
    const paragraphId = `paragraph-${data.paragraphIndex}-${activeChat?.id}-${Date.now()}`;
    
    setMessages(prev => {
      const filtered = prev.filter(msg => msg.id !== streamingId);
      return [...filtered, { ...data.message, id: paragraphId, isStreaming: false }];
    });
  }
};
```

#### **메시지 렌더링 (MessageItem.tsx)**
```typescript
const MessageItem: React.FC<MessageItemProps> = ({ message, onRetry }) => {
  // 스트리밍 커서 애니메이션
  const StreamingCursor = () => (
    <span className="w-1 h-4 bg-[#D55C2D] ml-1 animate-pulse rounded-sm"></span>
  );
  
  // 로딩 애니메이션
  const LoadingAnimation = () => (
    <div className="flex items-center space-x-1">
      <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
      <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
    </div>
  );
  
  return (
    <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'} rounded-lg px-4 py-2`}>
        {message.isLoading ? (
          <div className="flex items-center space-x-2">
            <LoadingAnimation />
            <span className="text-sm text-gray-600 font-medium">{message.text}</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{message.text}</ReactMarkdown>
            {message.isStreaming && <StreamingCursor />}
          </div>
        )}
      </div>
    </div>
  );
};
```

### **백엔드 핵심 로직**

#### **스트리밍 메시지 처리 (chatRoutes.js)**
```javascript
// 단어별 스트리밍 처리
for (let i = 0; i < geminiResponse.paragraphs.length; i++) {
  const paragraph = geminiResponse.paragraphs[i];
  const savedMessage = await saveMessage(chatId, 'model', paragraph.content);
  
  // 단어별 스트리밍
  const words = paragraph.content.trim().split(' ');
  let currentText = '';
  
  for (const word of words) {
    currentText += (currentText ? ' ' : '') + word;
    
    res.write(`data: ${JSON.stringify({
      type: 'streaming',
      paragraphIndex: i,
      message: { ...savedMessage, text: currentText, isStreaming: true }
    })}\n\n`);
    
    // 랜덤 딜레이 (50-80ms)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 30));
  }
  
  // 문단 완료 신호
  res.write(`data: ${JSON.stringify({
    type: 'paragraph',
    paragraphIndex: i,
    message: { ...savedMessage, isStreaming: false }
  })}\n\n`);
  
  // 문단 간 딜레이 (500ms)
  if (i < geminiResponse.paragraphs.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

#### **맥락 감지 AI (chatPrompt.js)**
```javascript
// 맥락 감지 가이드라인
const MANDATORY_RULES = [
  // ... 기존 규칙들 ...
  "followUpQuestions는 맥락에 따라 결정하세요:",
  "  - 종결성 대화(감사, 확인, 감정 표현 등)인 경우: 빈 배열 []",
  "  - 정보 요청이나 탐색적 대화인 경우: 1-3개의 맥락에 맞는 질문",
  "  - 종결성 표현 예시: '고맙습니다', '알겠습니다', '네', '좋아요', '와!', '정말 유용해요'",
];

// 종결성 대화 예시
const EXAMPLE_CLOSING_RESPONSE = {
  paragraphs: [
    {
      id: 1,
      content: "네, 말씀해주신 내용을 잘 이해했습니다. 탕수육의 역사와 문화적 의미에 대해 설명드릴 수 있어서 기쁩니다."
    },
    {
      id: 2,
      content: "혹시 다른 궁금한 점이 있으시면 언제든지 물어보세요. 한국 음식 문화에 대해 더 많은 이야기를 나눌 수 있기를 기대합니다!"
    }
  ],
  followUpQuestions: [],
  context: "탕수육 대화 종결 및 감사 표현"
};
```

---

## **🛠️ 기술 스택**

### **프론트엔드**
- **React 19.1.0**: 사용자 인터페이스
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **ReactMarkdown**: 마크다운 렌더링
- **Server-Sent Events**: 실시간 스트리밍
- **Lucide React**: 아이콘

### **백엔드**
- **Node.js**: 런타임 환경
- **Express.js**: 웹 프레임워크
- **PostgreSQL**: 관계형 데이터베이스
- **Google Gemini API**: AI 챗봇 엔진
- **CORS**: 크로스 오리진 리소스 공유
- **Nodemon**: 개발 서버

### **데이터베이스**
- **PostgreSQL**: 메인 데이터베이스
- **JSONB**: 구조화된 데이터 저장
- **SERIAL**: 자동 증가 ID
- **외래키 제약조건**: 데이터 무결성

### **개발 도구**
- **Vite**: 프론트엔드 빌드 도구
- **ESLint**: 코드 품질 관리
- **Git**: 버전 관리

---

## **🔍 문제 해결 및 최적화**

### **해결된 주요 이슈**

1. **React Key 중복 오류**
   - **문제**: 스트리밍 중 메시지 ID 충돌
   - **해결**: 고유 ID 패턴과 상태 업데이트 로직 개선
   - **패턴**: `streaming-${paragraphIndex}-${chatId}` / `paragraph-${paragraphIndex}-${chatId}-${timestamp}`

2. **데이터베이스 ID 충돌**
   - **문제**: SERIAL ID와 수동 ID 설정 충돌
   - **해결**: 데이터베이스 자동 증가 ID 사용
   - **장점**: 안정적인 고유 ID 생성

3. **사용자 관리 시스템**
   - **문제**: 익명 사용자로 인한 데이터 격리 부재
   - **해결**: 사용자별 데이터 격리 및 권한 제어
   - **특징**: 회사/역할 기반 고객 관리

### **성능 최적화**

1. **스트리밍 최적화**
   - 단어별 딜레이 조정 (50-80ms)
   - 문단 간 딜레이 최적화 (500ms)
   - 메모리 효율적인 상태 관리

2. **데이터베이스 최적화**
   - 인덱스 생성으로 쿼리 성능 향상
   - JSONB 타입으로 구조화된 데이터 저장
   - 소프트 삭제로 데이터 보존

3. **프론트엔드 최적화**
   - 불필요한 리렌더링 방지
   - 컴포넌트 언마운트 시 정리 작업
   - 메모리 누수 방지

---

## **🔒 보안 고려사항**

### **🛡️ AI 보안 방어 시스템**

#### **프롬프트 주입 공격 방지**
- **정규식 기반 패턴 감지**: 시스템 정보 탐색 시도 차단
- **위협 레벨 분류**: HIGH/MEDIUM/LOW 위험도 평가
- **안전한 대안 응답**: 위협 감지 시 유용한 주제로 안내
- **실시간 로깅**: 모든 보안 이벤트 데이터베이스 저장

#### **AI 정체성 보호**
- **시스템 정보 노출 방지**: 내부 구조, 프롬프트 내용 보호
- **역할 혼동 공격 차단**: "너는 AI야?" 등 정체성 탐색 차단
- **기술적 세부사항 보호**: 알고리즘, 모델 정보 노출 방지

#### **보안 모니터링**
- **실시간 위협 감지**: 사용자 질문 실시간 분석
- **IP 기반 위협 추적**: 사용자별 위협 패턴 분석
- **보안 대시보드**: 관리자용 위협 모니터링 인터페이스
- **위협 통계**: 시간별, 유형별 위협 분석

### **API 키 보안**
- 환경 변수로 API 키 관리
- 서버 사이드에서만 API 키 사용
- 클라이언트에 민감한 정보 노출 방지

### **데이터 보호**
- 사용자별 데이터 격리
- 소프트 삭제로 데이터 보존
- SQL 인젝션 방지

### **입력 검증**
- 사용자 입력 sanitization
- XSS 공격 방지
- CSRF 토큰 사용

---

## **🚀 확장 가능성**

### **향후 개발 방향**

1. **멀티 사용자 지원**
   - JWT 토큰 기반 인증
   - 사용자별 권한 관리
   - 세션 관리

2. **고급 분석 기능**
   - 대화 패턴 분석
   - 사용자 행동 추적
   - 성능 메트릭 수집

3. **실시간 협업**
   - WebSocket 기반 실시간 채팅
   - 팀별 대화방 관리
   - 파일 공유 기능

4. **AI 모델 확장**
   - 다양한 AI 모델 지원
   - 모델별 특화 프롬프트
   - A/B 테스트 기능

5. **모바일 지원**
   - PWA (Progressive Web App)
   - 모바일 최적화 UI
   - 푸시 알림

---

## **📝 개발 가이드**

### **코드 스타일**
- TypeScript strict 모드 사용
- ESLint 규칙 준수
- 일관된 네이밍 컨벤션
- 주석 작성 필수

### **테스트**
- 단위 테스트 작성
- 통합 테스트 구현
- E2E 테스트 고려

### **배포**
- Docker 컨테이너화
- CI/CD 파이프라인 구축
- 환경별 설정 관리

---

## **🤝 기여 가이드**

1. **Fork** 저장소
2. **Feature branch** 생성 (`git checkout -b feature/AmazingFeature`)
3. **Commit** 변경사항 (`git commit -m 'Add some AmazingFeature'`)
4. **Push** 브랜치 (`git push origin feature/AmazingFeature`)
5. **Pull Request** 생성

---

## **📄 라이선스**

이 프로젝트는 ISC 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

## **📞 지원**

문제가 발생하거나 질문이 있으시면:
- **이슈 등록**: GitHub Issues
- **문서 확인**: 이 README 파일
- **코드 검토**: 소스 코드 주석

---

**지식 탐험가 AI 챗봇** - 더 나은 대화 경험을 위한 AI 솔루션 🚀
