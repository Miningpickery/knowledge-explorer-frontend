# 환경 변수 설정 가이드

## 📋 필수 환경 변수

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# ============================================================================
# KNOWLEDGE EXPLORER - 개발 환경 설정
# ============================================================================

# 서버 설정
NODE_ENV=development
PORT=3001

# 데이터베이스 설정
DATABASE_URL=postgresql://postgres:password@localhost:5432/knowledge_explorer

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key-for-development-only

# Google OAuth 설정
GOOGLE_CLIENT_ID=297915279539-m769oge
GOOGLE_CLIENT_SECRET=GOCSPX-zYX
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# 프론트엔드 URL
FRONTEND_URL=http://localhost:8000

# Gemini AI API 설정
GEMINI_API_KEY=your-gemini-api-key-here

# 보안 설정
CORS_ORIGIN=http://localhost:8000
SESSION_SECRET=your-session-secret-for-development

# 로깅 설정
LOG_LEVEL=debug
ENABLE_DEBUG_LOGGING=true

# 개발용 설정
ENABLE_HOT_RELOAD=true
ENABLE_API_DOCUMENTATION=true
ENABLE_MONITORING=true

# 테스트 설정
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/knowledge_explorer_test
```

## 🔧 설정 방법

### 1. .env 파일 생성
```bash
# 프로젝트 루트에서
touch .env
```

### 2. 환경 변수 설정
위의 내용을 `.env` 파일에 복사하고 실제 값으로 수정하세요.

### 3. Google OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. APIs & Services > Credentials에서 OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI에 `http://localhost:3001/api/auth/google/callback` 추가
4. 클라이언트 ID와 시크릿을 환경 변수에 설정

### 4. Gemini API 설정
1. [Google AI Studio](https://makersuite.google.com/app/apikey)에서 API 키 생성
2. 생성된 키를 `GEMINI_API_KEY`에 설정

## 🚀 개발 서버 시작

### 백엔드 서버
```bash
npm run dev
```

### 프론트엔드 서버
```bash
npm run dev:frontend
```

## ✅ 확인 사항

서버가 정상적으로 시작되면 다음을 확인하세요:

1. **Health Check**: http://localhost:3001/health
2. **프론트엔드**: http://localhost:8000
3. **Google 로그인**: 정상 작동
4. **채팅 기능**: 새 대화 시작 가능

## 🔍 문제 해결

### 환경 변수가 로드되지 않는 경우
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 파일명이 정확히 `.env`인지 확인
3. 서버 재시작

### Google OAuth 오류
1. 클라이언트 ID와 시크릿이 정확한지 확인
2. 리디렉션 URI가 올바른지 확인
3. Google Cloud Console에서 OAuth 동의 화면 설정

### 데이터베이스 연결 오류
1. PostgreSQL이 실행 중인지 확인
2. 데이터베이스가 생성되어 있는지 확인
3. 연결 문자열이 올바른지 확인
