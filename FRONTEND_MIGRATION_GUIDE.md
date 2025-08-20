# **프론트엔드 마이그레이션 가이드 (Frontend Migration Guide)**

## **개요**

이 문서는 백엔드 API가 완성된 후, 프론트엔드 코드를 백엔드 API를 사용하도록 수정하는 방법을 안내합니다. 현재 localStorage 기반의 데이터 저장 방식을 백엔드 API 호출 방식으로 전환하는 과정을 설명합니다.

## **1. 수정 대상 파일**

### **1.1. services/chatHistoryService.ts**
현재 localStorage를 직접 조작하는 모든 함수를 백엔드 API 호출로 변경해야 합니다.

### **1.2. services/geminiService.ts**
현재 클라이언트에서 직접 Gemini API를 호출하는 방식을 백엔드 API 호출로 변경해야 합니다.

## **2. 수정 방법**

### **2.1. services/chatHistoryService.ts 수정**

**현재 코드 (localStorage 기반):**
```typescript
export const getAllChats = (): ChatSession[] => {
  try {
    const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!historyJson) return [];
    const chats = JSON.parse(historyJson) as ChatSession[];
    return chats.sort((a, b) => {
        const timeA = parseInt(a.id.split('-')[1]);
        const timeB = parseInt(b.id.split('-')[1]);
        return timeB - timeA;
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};
```

**수정 후 코드 (API 호출 기반):**
```typescript
const API_BASE_URL = 'http://localhost:3000/api';

export const getAllChats = async (): Promise<ChatSession[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const chats = await response.json();
    return chats;
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};
```

**전체 수정된 chatHistoryService.ts:**
```typescript
import { ChatSession, ChatMessage, MessageSender } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

// Helper to get the initial title from the first user message
const getTitleFromMessages = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(m => m.sender === MessageSender.USER);
  if (firstUserMessage) {
    return firstUserMessage.text.substring(0, 30);
  }
  return "새 대화";
};

export const getAllChats = async (): Promise<ChatSession[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const chats = await response.json();
    return chats;
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

export const createNewChat = async (initialMessages: ChatMessage[] = []): Promise<ChatSession> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const newChat = await response.json();
    return newChat;
  } catch (error) {
    console.error("Failed to create new chat:", error);
    throw error;
  }
};

export const getChatById = async (id: string): Promise<ChatSession> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const chat = await response.json();
    return chat;
  } catch (error) {
    console.error("Failed to get chat:", error);
    throw error;
  }
};

export const deleteChat = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete chat:", error);
    throw error;
  }
};

// 이 함수는 더 이상 필요하지 않습니다. 백엔드에서 자동으로 처리됩니다.
export const updateChat = async (id: string, updates: Partial<ChatSession>): Promise<void> => {
  // 백엔드에서 메시지 추가 시 자동으로 업데이트되므로 별도 구현 불필요
  console.warn("updateChat is deprecated. Backend handles updates automatically.");
};
```

### **2.2. services/geminiService.ts 수정**

**현재 코드 (클라이언트 Gemini API 호출):**
```typescript
export const sendMessage = async (chat: Chat, prompt: string): Promise<GroundedResponse> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });
    // ... 복잡한 처리 로직
  } catch (error) {
    // ... 에러 처리
  }
};
```

**수정 후 코드 (백엔드 API 호출):**
```typescript
const API_BASE_URL = 'http://localhost:3000/api';

export interface GroundedResponse {
  answer: string;
  followUpQuestions: string[];
  sources: GroundingSource[];
}

export const sendMessage = async (chatId: string, message: string): Promise<GroundedResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending message:", error);
    return {
      answer: "죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      followUpQuestions: [],
      sources: [],
    };
  }
};

// createChatSession 함수는 더 이상 필요하지 않습니다.
export const createChatSession = (history: ChatMessage[] = []): Chat => {
  throw new Error("createChatSession is deprecated. Use chatHistoryService.createNewChat instead.");
};
```

### **2.3. 컴포넌트 수정**

**App.tsx에서 수정이 필요한 부분:**

1. **비동기 함수 호출로 변경:**
```typescript
// 기존
const chats = getAllChats();

// 수정 후
const [chats, setChats] = useState<ChatSession[]>([]);

useEffect(() => {
  const loadChats = async () => {
    const loadedChats = await getAllChats();
    setChats(loadedChats);
  };
  loadChats();
}, []);
```

2. **메시지 전송 로직 수정:**
```typescript
// 기존
const response = await sendMessage(chat, userMessage);

// 수정 후
const response = await sendMessage(currentChat.id, userMessage);
```

## **3. 의존성 제거**

### **3.1. package.json에서 제거할 의존성**
```json
{
  "dependencies": {
    "@google/genai": "^1.0.1"  // 이 라인 제거
  }
}
```

### **3.2. 환경 변수 제거**
- `GEMINI_API_KEY` 환경 변수는 프론트엔드에서 더 이상 필요하지 않습니다.
- `.env.local` 파일에서 제거하거나 주석 처리하세요.

## **4. 에러 처리 개선**

### **4.1. 네트워크 에러 처리**
```typescript
const handleApiError = (error: any) => {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      answer: "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.",
      followUpQuestions: [],
      sources: [],
    };
  }
  
  return {
    answer: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    followUpQuestions: [],
    sources: [],
  };
};
```

### **4.2. 로딩 상태 관리**
```typescript
const [isLoading, setIsLoading] = useState(false);

const sendMessage = async (chatId: string, message: string) => {
  setIsLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    return await response.json();
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

## **5. 테스트 방법**

### **5.1. 백엔드 서버 실행 확인**
```bash
# 백엔드 서버가 실행 중인지 확인
curl http://localhost:3000/api/chats
```

### **5.2. 프론트엔드 테스트**
1. 새 대화 생성 테스트
2. 메시지 전송 테스트
3. 대화 목록 조회 테스트
4. 대화 삭제 테스트

### **5.3. CORS 설정 확인**
백엔드에서 CORS가 올바르게 설정되어 있는지 확인:
```javascript
// 백엔드 CORS 설정 예시
app.use(cors({
  origin: 'http://localhost:8000',
  credentials: true
}));
```

## **6. 배포 시 고려사항**

### **6.1. 환경별 API URL 설정**
```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.com/api'
  : 'http://localhost:3000/api';
```

### **6.2. 환경 변수 설정**
```bash
# .env.production
REACT_APP_API_BASE_URL=https://your-backend-domain.com/api

# .env.development
REACT_APP_API_BASE_URL=http://localhost:3000/api
```

## **7. 롤백 계획**

만약 백엔드 API에 문제가 발생할 경우를 대비하여, 기존 localStorage 기반 코드를 백업해두고 필요시 빠르게 롤백할 수 있도록 준비하세요.

---

**문서 버전:** 1.0  
**최종 업데이트:** 2024년 12월 21일
