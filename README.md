<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# **"지식 탐험가" AI 챗봇: 백엔드 개발 핸드오버 문서 (최종본)**

## **1. 프로젝트 개요**

- **"지식 탐험가"**는 사용자가 다양한 주제에 대해 질문하면, Google 검색을 통해 최신 정보를 기반으로 답변하고 관련된 후속 질문을 제안하는 다중 대화 세션 관리 AI 챗봇 애플리케이션입니다.
- **핵심 기술 스택:** React, TypeScript, Tailwind CSS, Gemini API (gemini-2.5-flash 모델)
- **주요 기능:**
  - Google Search Tool을 연동한 실시간 정보 기반 질의응답
  - 대화의 맥락을 완벽하게 기억하는 다중 턴(Multi-turn) 채팅
  - 여러 개의 대화 세션을 생성, 전환, 삭제하는 사이드바 기능
  - AI 답변의 순차적 표시(스트리밍 효과) 및 마크다운/코드 하이라이팅 지원
- **현재 상태:** 모든 기능이 프론트엔드에서 완벽하게 구현된 상태입니다. 데이터 영속성은 현재 브라우저의 **localStorage**를 사용하고 있으며, Gemini API는 클라이언트에서 직접 호출하고 있습니다.

## **2. 백엔드 전환 목표**

현재 프론트엔드 중심의 아키텍처를 **안정적이고 확장 가능한 백엔드 서버 기반으로 전환**하는 것이 핵심 목표입니다.

1. **데이터베이스 연동:** localStorage에 저장되는 모든 대화 기록(ChatSession)을 PostgreSQL, MySQL 또는 MongoDB 같은 데이터베이스에 저장하도록 전환합니다.
2. **보안 강화:** 현재 프론트엔드 코드에 노출될 수 있는 API_KEY 문제를 해결하기 위해, 모든 Gemini API 호출 로직을 백엔드 서버로 이전합니다. API 키는 반드시 백엔드 서버의 환경 변수로 안전하게 관리되어야 합니다.
3. **API 서버 구축:** 프론트엔드가 모든 CRUD(생성, 읽기, 수정, 삭제) 작업을 수행할 수 있도록 아래 명세에 맞는 RESTful API를 제공합니다.

## **3. API 엔드포인트 명세**

프론트엔드의 `services/chatHistoryService.ts`와 `services/geminiService.ts` 파일의 기능을 대체할 수 있도록 아래 API를 구축해야 합니다.

### **A. 대화 세션 관리 (Chat Session Management)**

| **기능** | **HTTP Method** | **URL** | **설명** |
| --- | --- | --- | --- |
| **모든 대화 목록 조회** | GET | `/api/chats` | 사용자의 모든 대화 세션 목록을 반환합니다. (성능을 위해 `messages` 필드는 제외하고 `id`, `title`만 반환하는 것을 권장) |
| **새 대화 생성** | POST | `/api/chats` | 새로운 빈 대화 세션을 생성하고, 생성된 세션 객체(`{ id, title, messages: [] }`)를 반환합니다. |
| **특정 대화 조회** | GET | `/api/chats/{chatId}` | 특정 `chatId`에 해당하는 대화 세션의 모든 메시지 기록을 반환합니다. |
| **대화 삭제** | DELETE | `/api/chats/{chatId}` | 특정 대화 세션과 관련된 모든 데이터를 삭제합니다. |

### **B. 메시지 전송 및 AI 응답 (Messaging)**

| **기능** | **HTTP Method** | **URL** | **설명** |
| --- | --- | --- | --- |
| **메시지 전송** | POST | `/api/chats/{chatId}/messages` | 사용자의 메시지를 받아 Gemini API와 통신한 후, AI의 최종 응답을 반환합니다. |

- **Request Body (POST /api/chats/{chatId}/messages):**
```json
{
  "message": "사용자가 입력한 질문 텍스트입니다."
}
```

- **Success Response Body:** (프론트엔드의 `GroundedResponse` 타입 참고)
```json
{
  "answer": "AI가 생성한 답변입니다.\n\n여러 문단으로 나뉠 수 있습니다.",
  "sources": [
    { "uri": "https://example.com/source1", "title": "출처1 제목" }
  ],
  "followUpQuestions": [
    "관련된 첫 번째 추천 질문",
    "관련된 두 번째 추천 질문"
  ]
}
```

## **4. 백엔드 주요 로직 가이드**

### **4.1. Gemini API 연동 로직**

- **대화 맥락 유지:** POST `/api/chats/{chatId}/messages` 요청을 처리할 때, 반드시 데이터베이스에서 해당 `chatId`의 **전체 대화 기록**을 조회해야 합니다. 이 기록을 새 메시지와 함께 Gemini API에 전달해야만 대화의 맥락이 유지됩니다.
- **시스템 명령어:** 프론트엔드 `services/geminiService.ts` 파일에 정의된 `systemInstruction` 변수의 내용을 백엔드에서 Gemini API를 호출할 때 동일하게 사용해야 합니다. AI의 역할과 답변 규칙을 정의하는 핵심적인 부분입니다.
- **기록 포맷팅:** 프론트엔드의 `mapMessagesToContent` 함수는 대화 기록을 Gemini API가 요구하는 형식으로 변환하는 로직을 담고 있습니다. 백엔드 구현 시 이 함수를 참고하세요.
- **추천 질문 생성:** `sendMessage` 함수 내에는 모델이 추천 질문을 2개 미만으로 생성했을 경우, JSON 모드를 사용해 안정적으로 추가 질문을 생성하는 **자동 복구(Fallback) 로직**이 포함되어 있습니다. 이 로직을 백엔드에 동일하게 구현하여 사용자 경험의 일관성을 유지해야 합니다.

### **4.2. 데이터베이스 모델**

데이터베이스 스키마는 프론트엔드의 `types.ts` 파일에 정의된 아래 인터페이스를 기준으로 설계되어야 합니다.

```typescript
// from: src/types.ts

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string; // DB에서는 auto-increment ID 또는 UUID로 대체
  text: string;
  sender: MessageSender;
  // sources와 followUpQuestions는 JSON/TEXT 타입으로 저장 가능
  sources?: GroundingSource[];
  followUpQuestions?: string[];
}

export interface ChatSession {
  id: string; // DB에서는 UUID 또는 auto-increment ID
  title: string;
  messages: ChatMessage[]; // 관계형 DB의 경우 별도 테이블로 분리 (One-to-Many)
}
```

### **4.3. 대화 제목 자동 생성**

`services/chatHistoryService.ts`의 `getTitleFromMessages` 함수와 `updateChat` 함수를 참고하여, 새 대화가 시작되고 사용자의 첫 메시지가 입력되면 해당 메시지의 일부를 대화의 제목으로 자동 설정하는 로직을 구현해야 합니다.

## **5. 프론트엔드 수정 포인트 (백엔드 완료 후)**

백엔드 API가 완성되면, 프론트엔드의 아래 두 파일의 내용이 백엔드 API를 호출하는 코드로 변경되어야 합니다.

1. **services/chatHistoryService.ts**: localStorage를 직접 조작하는 모든 함수(`getAllChats`, `createNewChat` 등)를 위에서 정의한 `/api/chats` 엔드포인트를 호출하는 `fetch` 또는 `axios` 코드로 교체합니다.
2. **services/geminiService.ts**: `sendMessage` 함수와 `createChatSession` 함수를 제거하고, 대신 `/api/chats/{chatId}/messages` 엔드포인트로 요청을 보내는 단일 함수로 대체합니다. `@google/genai` SDK는 프론트엔드에서 완전히 제거됩니다.

## **6. 로컬 개발 환경 실행 방법**

1. 프로젝트 폴더에 `node_modules`가 없다면 `npm install` 또는 `yarn`을 실행하여 의존성을 설치해야 합니다. (이 프로젝트는 CDN을 사용하므로 이 단계는 생략 가능합니다.)
2. 프로젝트 폴더에서 간단한 웹 서버를 실행합니다. Python이 설치된 경우 아래 명령어를 사용하면 편리합니다.
```bash
# Python 3
python -m http.server 8000
```
3. 브라우저에서 `http://localhost:8000` 주소로 접속하여 애플리케이션을 확인합니다.

## **7. 프로젝트 전달 방법**

백엔드 개발팀에 코드를 전달하는 가장 좋은 방법은 **Git**을 통해 GitHub 같은 플랫폼에 업로드하여 링크를 공유하는 것입니다. 이것이 표준적인 협업 방식입니다. 만약 Git 사용이 어렵다면, 프로젝트 폴더 전체를 **ZIP 파일**로 압축하여 전달하는 것도 좋은 방법입니다.

### **추천 방식: Git 및 GitHub**

1. **Git 저장소 초기화 및 커밋:** 프로젝트 폴더에서 터미널을 열고 다음 명령어를 실행합니다.
```bash
git init
git add .
git commit -m "Final frontend version for backend handover"
```

2. **GitHub에 새 저장소 생성:** GitHub에서 New repository를 만들어 비어있는 저장소를 준비합니다.
3. **로컬 코드 푸시:** GitHub에서 안내하는 대로 로컬 저장소를 원격 저장소에 연결하고 코드를 푸시(push)합니다.
4. **링크 공유:** 생성된 GitHub 저장소 주소를 백엔드 개발팀에 전달합니다.

## **8. 추가 참고 자료**

- **프로젝트 구조:** `components/`, `services/`, `types.ts` 파일들을 참고하여 프론트엔드 구조를 이해하세요.
- **API 키 설정:** 현재는 `process.env.API_KEY`로 설정되어 있지만, 백엔드에서는 환경 변수로 안전하게 관리해야 합니다.
- **에러 처리:** 프론트엔드의 에러 처리 로직을 참고하여 백엔드에서도 적절한 에러 응답을 제공하세요.

---

**문서 작성일:** 2024년 12월  
**프로젝트 버전:** 1.0.0  
**담당자:** 프론트엔드 개발팀
