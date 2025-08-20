# **백엔드 API 명세서 (Backend API Specification)**

## **개요**

이 문서는 "지식 탐험가" AI 챗봇의 백엔드 API 구현을 위한 상세한 명세서입니다. 프론트엔드의 `services/chatHistoryService.ts`와 `services/geminiService.ts` 파일의 기능을 대체하는 RESTful API를 정의합니다.

## **1. 기본 정보**

- **Base URL:** `http://localhost:3000` (개발 환경)
- **Content-Type:** `application/json`
- **인증:** 현재는 인증 없이 구현 (필요시 JWT 토큰 기반 인증 추가)

## **2. API 엔드포인트 상세 명세**

### **2.1. 대화 세션 관리 API**

#### **GET /api/chats**
모든 대화 세션 목록을 조회합니다.

**응답 예시:**
```json
[
  {
    "id": "chat-1703123456789",
    "title": "인공지능의 미래",
    "createdAt": "2024-12-21T10:30:56.789Z",
    "updatedAt": "2024-12-21T10:35:12.345Z"
  },
  {
    "id": "chat-1703123400000",
    "title": "블록체인 기술",
    "createdAt": "2024-12-21T10:20:00.000Z",
    "updatedAt": "2024-12-21T10:25:30.123Z"
  }
]
```

**응답 필드:**
- `id`: 대화 세션 고유 식별자 (UUID 또는 타임스탬프 기반)
- `title`: 대화 제목 (첫 번째 사용자 메시지에서 자동 생성)
- `createdAt`: 생성 시간
- `updatedAt`: 마지막 업데이트 시간

#### **POST /api/chats**
새로운 대화 세션을 생성합니다.

**요청 본문:** 없음 (빈 객체 `{}`)

**응답 예시:**
```json
{
  "id": "chat-1703123456789",
  "title": "새 대화",
  "messages": [],
  "createdAt": "2024-12-21T10:30:56.789Z",
  "updatedAt": "2024-12-21T10:30:56.789Z"
}
```

#### **GET /api/chats/{chatId}**
특정 대화 세션의 모든 메시지를 조회합니다.

**경로 매개변수:**
- `chatId`: 대화 세션 ID

**응답 예시:**
```json
{
  "id": "chat-1703123456789",
  "title": "인공지능의 미래",
  "messages": [
    {
      "id": "msg-1",
      "text": "인공지능의 미래에 대해 알려주세요.",
      "sender": "user",
      "timestamp": "2024-12-21T10:30:56.789Z"
    },
    {
      "id": "msg-2",
      "text": "인공지능(AI)의 미래는 매우 밝고 흥미로운 전망을 보여주고 있습니다...",
      "sender": "model",
      "timestamp": "2024-12-21T10:31:02.123Z",
      "sources": [
        {
          "uri": "https://example.com/ai-future",
          "title": "AI 미래 전망 보고서"
        }
      ],
      "followUpQuestions": [
        "AI가 인간의 일자리를 대체할까요?",
        "AI 윤리 문제는 어떻게 해결할 수 있을까요?"
      ]
    }
  ],
  "createdAt": "2024-12-21T10:30:56.789Z",
  "updatedAt": "2024-12-21T10:31:02.123Z"
}
```

#### **DELETE /api/chats/{chatId}**
특정 대화 세션을 삭제합니다.

**경로 매개변수:**
- `chatId`: 삭제할 대화 세션 ID

**응답:** `204 No Content`

### **2.2. 메시지 전송 API**

#### **POST /api/chats/{chatId}/messages**
사용자 메시지를 전송하고 AI 응답을 받습니다.

**경로 매개변수:**
- `chatId`: 대화 세션 ID

**요청 본문:**
```json
{
  "message": "사용자가 입력한 질문 텍스트입니다."
}
```

**응답 예시:**
```json
{
  "answer": "인공지능(AI)의 미래는 매우 밝고 흥미로운 전망을 보여주고 있습니다.\n\n현재 AI 기술은 빠른 속도로 발전하고 있으며, 머신러닝과 딥러닝 기술의 혁신으로 다양한 분야에서 활용되고 있습니다.\n\n특히 자연어 처리, 컴퓨터 비전, 자율주행차 등의 분야에서 큰 진전을 보이고 있습니다.",
  "sources": [
    {
      "uri": "https://example.com/ai-future-report",
      "title": "2024 AI 미래 전망 보고서"
    },
    {
      "uri": "https://example.com/ai-trends",
      "title": "AI 기술 트렌드 분석"
    }
  ],
  "followUpQuestions": [
    "AI가 인간의 일자리를 대체할까요?",
    "AI 윤리 문제는 어떻게 해결할 수 있을까요?",
    "AI와 인간의 협업은 어떤 모습일까요?"
  ]
}
```

**응답 필드:**
- `answer`: AI가 생성한 답변 (마크다운 형식 지원)
- `sources`: 답변의 출처 정보 배열
- `followUpQuestions`: 추천 후속 질문 배열 (최소 2개 이상)

## **3. 에러 응답 형식**

모든 API는 에러 발생 시 일관된 형식으로 응답합니다.

**에러 응답 예시:**
```json
{
  "error": {
    "code": "CHAT_NOT_FOUND",
    "message": "요청한 대화 세션을 찾을 수 없습니다.",
    "details": "chatId: chat-1703123456789"
  },
  "timestamp": "2024-12-21T10:30:56.789Z"
}
```

**일반적인 에러 코드:**
- `CHAT_NOT_FOUND`: 대화 세션을 찾을 수 없음
- `INVALID_REQUEST`: 잘못된 요청 형식
- `GEMINI_API_ERROR`: Gemini API 호출 실패
- `DATABASE_ERROR`: 데이터베이스 오류
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류

## **4. 데이터베이스 스키마 제안**

### **4.1. PostgreSQL 예시**

```sql
-- 대화 세션 테이블
CREATE TABLE chat_sessions (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 테이블
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(50) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'model')),
    sources JSONB,
    follow_up_questions JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
```

### **4.2. MongoDB 예시**

```javascript
// 대화 세션 컬렉션
{
  "_id": ObjectId("..."),
  "chatId": "chat-1703123456789",
  "title": "인공지능의 미래",
  "createdAt": ISODate("2024-12-21T10:30:56.789Z"),
  "updatedAt": ISODate("2024-12-21T10:31:02.123Z")
}

// 메시지 컬렉션
{
  "_id": ObjectId("..."),
  "chatId": "chat-1703123456789",
  "text": "인공지능의 미래에 대해 알려주세요.",
  "sender": "user",
  "sources": [
    {
      "uri": "https://example.com/source",
      "title": "출처 제목"
    }
  ],
  "followUpQuestions": ["질문1", "질문2"],
  "timestamp": ISODate("2024-12-21T10:30:56.789Z")
}
```

## **5. 환경 변수 설정**

백엔드 서버에서 필요한 환경 변수들:

```bash
# Gemini API 설정
GEMINI_API_KEY=your_gemini_api_key_here

# 데이터베이스 설정 (PostgreSQL 예시)
DATABASE_URL=postgresql://username:password@localhost:5432/knowledge_explorer

# 서버 설정
PORT=3000
NODE_ENV=development

# CORS 설정
CORS_ORIGIN=http://localhost:8000
```

## **6. 구현 시 주의사항**

1. **대화 맥락 유지**: POST `/api/chats/{chatId}/messages` 처리 시 반드시 해당 채팅의 전체 메시지 히스토리를 Gemini API에 전달해야 합니다.

2. **시스템 명령어**: 프론트엔드의 `systemInstruction`을 그대로 사용하여 AI의 역할과 답변 규칙을 일관되게 유지해야 합니다.

3. **추천 질문 Fallback**: Gemini API가 2개 미만의 추천 질문을 생성할 경우, JSON 모드를 사용한 자동 복구 로직을 구현해야 합니다.

4. **에러 처리**: Gemini API 호출 실패 시 적절한 에러 메시지를 반환하고, 사용자에게 친화적인 안내를 제공해야 합니다.

5. **성능 최적화**: 대화 목록 조회 시 메시지 내용은 제외하고, 필요할 때만 개별 조회하도록 구현해야 합니다.

---

**문서 버전:** 1.0  
**최종 업데이트:** 2024년 12월 21일
