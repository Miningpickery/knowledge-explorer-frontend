# **프로젝트 설정 및 실행 가이드**

## **빠른 시작**

### **1. 프로젝트 실행**

현재 프로젝트는 CDN을 사용하므로 별도의 빌드 과정 없이 바로 실행할 수 있습니다.

```bash
# Python 3가 설치된 경우
python -m http.server 8000

# 또는 Python 2가 설치된 경우
python -m SimpleHTTPServer 8000

# 또는 Node.js가 설치된 경우
npx serve .
```

### **2. 브라우저에서 확인**

브라우저에서 `http://localhost:8000`으로 접속하여 애플리케이션을 확인하세요.

## **프로젝트 구조**

```
지식-탐험가/
├── README.md                    # 백엔드 핸드오버 문서
├── BACKEND_API_SPEC.md          # 상세 API 명세서
├── FRONTEND_MIGRATION_GUIDE.md  # 프론트엔드 마이그레이션 가이드
├── SETUP.md                     # 이 파일 (설정 가이드)
├── index.html                   # 메인 HTML 파일
├── index.tsx                    # React 앱 진입점
├── App.tsx                      # 메인 앱 컴포넌트
├── types.ts                     # TypeScript 타입 정의
├── components/                  # React 컴포넌트들
│   ├── ChatInterface.tsx        # 채팅 인터페이스
│   ├── ChatHistory.tsx          # 채팅 히스토리 사이드바
│   ├── MessageItem.tsx          # 개별 메시지 컴포넌트
│   └── icons/                   # 아이콘 컴포넌트들
├── services/                    # 서비스 로직
│   ├── chatHistoryService.ts    # 채팅 히스토리 관리
│   └── geminiService.ts         # Gemini API 연동
└── package.json                 # 프로젝트 설정
```

## **주요 기능**

### **현재 구현된 기능**
- ✅ Google Search Tool을 연동한 실시간 정보 기반 질의응답
- ✅ 대화 맥락을 완벽하게 기억하는 다중 턴 채팅
- ✅ 여러 개의 대화 세션 생성, 전환, 삭제
- ✅ AI 답변의 순차적 표시 (스트리밍 효과)
- ✅ 마크다운 및 코드 하이라이팅 지원
- ✅ localStorage 기반 데이터 영속성

### **백엔드 전환 후 추가될 기능**
- 🔄 데이터베이스 기반 데이터 영속성
- 🔄 보안 강화 (API 키 서버 관리)
- 🔄 확장 가능한 아키텍처
- 🔄 사용자 인증 및 권한 관리 (선택사항)

## **기술 스택**

### **프론트엔드**
- **React 19.1.0**: 사용자 인터페이스
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Marked**: 마크다운 렌더링
- **Highlight.js**: 코드 하이라이팅
- **Lucide React**: 아이콘

### **AI/ML**
- **Google Gemini API**: AI 챗봇 엔진
- **Google Search Tool**: 실시간 정보 검색

### **데이터 저장**
- **localStorage**: 현재 클라이언트 사이드 저장
- **데이터베이스**: 백엔드 전환 후 (PostgreSQL/MongoDB 권장)

## **개발 환경 설정**

### **필수 요구사항**
- Node.js 18+ (선택사항, CDN 사용 시 불필요)
- Python 3+ (로컬 서버 실행용)
- Gemini API 키 (현재는 프론트엔드에서 사용, 백엔드 전환 후 서버로 이동)

### **환경 변수 설정**
현재는 프론트엔드에서 API 키를 사용하므로, `.env.local` 파일을 생성하여 설정:

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
```

## **테스트**

### **기능 테스트**
1. **새 대화 생성**: 사이드바의 "+" 버튼 클릭
2. **메시지 전송**: 질문 입력 후 전송
3. **대화 전환**: 사이드바에서 다른 대화 클릭
4. **대화 삭제**: 대화 우클릭 후 삭제

### **API 테스트**
현재는 클라이언트에서 직접 Gemini API를 호출하므로, 브라우저 개발자 도구의 Network 탭에서 API 호출을 확인할 수 있습니다.

## **문제 해결**

### **자주 발생하는 문제**

1. **API 키 오류**
   - `.env.local` 파일에 올바른 Gemini API 키가 설정되어 있는지 확인
   - API 키가 유효한지 확인

2. **CORS 오류**
   - 로컬 서버가 올바르게 실행되고 있는지 확인
   - 브라우저 캐시를 클리어

3. **빌드 오류**
   - Node.js 버전이 18+인지 확인
   - `npm install` 실행 후 다시 시도

### **디버깅**
- 브라우저 개발자 도구의 Console 탭에서 에러 메시지 확인
- Network 탭에서 API 호출 상태 확인
- React Developer Tools 확장 프로그램 사용 권장

## **백엔드 개발자를 위한 참고사항**

### **중요한 파일들**
- `services/geminiService.ts`: Gemini API 연동 로직
- `services/chatHistoryService.ts`: 데이터 관리 로직
- `types.ts`: 데이터 구조 정의
- `App.tsx`: 메인 애플리케이션 로직

### **핵심 로직**
1. **시스템 명령어**: `geminiService.ts`의 `systemInstruction` 변수
2. **메시지 포맷팅**: `mapMessagesToContent` 함수
3. **추천 질문 생성**: `sendMessage` 함수의 fallback 로직
4. **데이터 구조**: `types.ts`의 인터페이스 정의

## **연락처**

프로젝트 관련 문의사항이 있으시면 프론트엔드 개발팀에 연락해주세요.

---

**문서 버전:** 1.0  
**최종 업데이트:** 2024년 12월 21일
