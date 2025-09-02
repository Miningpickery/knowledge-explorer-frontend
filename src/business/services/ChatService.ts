/**
 * 🛠️ 채팅 서비스 - 상용화 수준 비즈니스 로직
 * @description 채팅 기능의 핵심 비즈니스 로직을 캡슐화
 */

import { 
  ChatSession, 
  ChatMessage, 
  ChatCreateOptions, 
  ChatListOptions,
  MessageSendOptions,
  StorageType,
  ChatServiceConfig,
  ApiResponse,
  MessageStreamChunk,
  EventHandler,
  AssistantMessage,
  UserMessage
} from '../types/chat.types';

export class ChatService {
  private readonly config: ChatServiceConfig;
  
  constructor(storageType: StorageType, config?: Partial<ChatServiceConfig>) {
    this.config = {
      storageType,
      apiBaseUrl: config?.apiBaseUrl || process.env.VITE_API_URL || 'http://localhost:3001',
      enableStreaming: config?.enableStreaming ?? true,
      enableCache: config?.enableCache ?? true,
      retryAttempts: config?.retryAttempts || 3,
      requestTimeout: config?.requestTimeout || 30000,
      ...config
    };
    
    console.log('ChatService 초기화됨', { 
      storageType, 
      config: this.config 
    });
  }
  
  // ============================================================================
  // 📋 채팅 목록 관리
  // ============================================================================
  
  /**
   * 채팅 목록 로드
   */
  async loadChats(userId?: number, options?: ChatListOptions): Promise<ChatSession[]> {
    try {
      console.log('채팅 목록 로드 시작', { userId, options });
      
      let chats: ChatSession[] = [];
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 로드 시도
        try {
          const response = await fetch(`${this.config.apiBaseUrl}/api/chats`, {
            method: 'GET',
            headers: this.getAuthHeaders(),
          });
          
          if (response.ok) {
            chats = await response.json() || [];
          } else {
            console.warn('서버에서 채팅 목록 로드 실패, 로컬에서 로드:', response.status);
            chats = await this.loadChatsFromLocal(userId);
          }
        } catch (error) {
          console.error('서버 연결 실패, 로컬에서 로드:', error);
          chats = await this.loadChatsFromLocal(userId);
        }
        
      } else {
        // 로컬에서 로드
        chats = await this.loadChatsFromLocal(userId);
      }
      
      // 정렬 및 필터링
      chats = this.sortAndFilterChats(chats, options);
      
      console.log('채팅 목록 로드 완료', { 
        count: chats.length, 
        storageType: this.config.storageType 
      });
      
      return chats;
      
    } catch (error) {
      console.error('채팅 목록 로드 실패', error);
      throw new Error('채팅 목록을 불러올 수 없습니다.');
    }
  }
  
  /**
   * 로컬에서 채팅 목록 로드
   */
  private async loadChatsFromLocal(userId?: number): Promise<ChatSession[]> {
    try {
      const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('로컬에서 채팅 목록 로드 실패:', error);
      return [];
    }
  }
  
  /**
   * 새 채팅 생성
   */
  async createChat(options: ChatCreateOptions): Promise<ChatSession> {
    try {
      if (!options.title || options.title.trim().length === 0) {
        throw new Error('채팅 제목은 필수입니다.');
      }
      
      console.log('새 채팅 생성 시작', options);
      
      const chatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const newChat: ChatSession = {
        chat_id: chatId,
        title: options.title || '새로운 대화',
        type: options.type || 'conversation',
        userId: options.userId,
        createdAt: now,
        updatedAt: now,
        metadata: {
          totalMessages: 0,
          lastActivity: now,
          topics: [],
          sentiment: 'neutral'
        },
        isActive: true,
        isArchived: false
      };
      
      if (this.config.storageType === 'server' && options.userId) {
        // 서버에 저장 시도
        try {
          const response = await fetch(`${this.config.apiBaseUrl}/api/chats`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders()
            },
            body: JSON.stringify(newChat)
          });
          
          if (response.ok) {
            const serverChat = await response.json();
            
            // 로컬 캐시 업데이트
            if (this.config.enableCache) {
              const existingChats = await this.loadChatsFromLocal(options.userId);
              const updatedChats = [serverChat, ...existingChats];
              this.saveChatsToLocal(options.userId, updatedChats);
            }
            
            console.log('새 채팅 서버에 생성됨', { chatId: serverChat.chat_id });
            return serverChat;
          } else {
            throw new Error(`서버 오류: ${response.status}`);
          }
          
        } catch (error) {
          console.error('서버에 채팅 생성 실패, 로컬에 저장:', error);
          // 서버 실패 시 로컬에 저장
          return await this.saveChatToLocal(newChat, options.userId);
        }
        
      } else {
        // 로컬에 저장
        return await this.saveChatToLocal(newChat, options.userId);
      }
      
    } catch (error) {
      console.error('채팅 생성 실패', error);
      throw new Error('새 채팅을 생성할 수 없습니다.');
    }
  }
  
  /**
   * 로컬에 채팅 저장
   */
  private async saveChatToLocal(chat: ChatSession, userId?: number): Promise<ChatSession> {
    const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
    const existingChats = await this.loadChatsFromLocal(userId);
    const updatedChats = [chat, ...existingChats];
    
    this.saveChatsToLocal(userId, updatedChats);
    
    // 활성 채팅 ID 저장
    localStorage.setItem('active_chat_id', chat.chat_id);
    
    console.log('새 채팅 로컬에 생성됨', { chatId: chat.chat_id });
    return chat;
  }
  
  /**
   * 로컬에 채팅 목록 저장
   */
  private saveChatsToLocal(userId: number | undefined, chats: ChatSession[]): void {
    const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
    localStorage.setItem(storageKey, JSON.stringify(chats));
  }
  
  /**
   * 채팅 삭제
   */
  async deleteChat(chatId: string, userId?: string): Promise<void> {
    try {
      if (!chatId || chatId.trim().length === 0) {
        throw new Error('채팅 ID는 필수입니다.');
      }
      
      console.log('채팅 삭제 시작', { chatId, userId });
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 삭제 시도
        try {
          const response = await fetch(`${this.config.apiBaseUrl}/api/chats/${chatId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
          });
          
          if (response.ok) {
            // 로컬 캐시에서도 제거
            if (this.config.enableCache) {
              await this.removeChatFromLocal(chatId, userId);
            }
          } else {
            throw new Error(`서버 오류: ${response.status}`);
          }
          
        } catch (error) {
          console.error('서버에서 채팅 삭제 실패, 로컬에서만 삭제:', error);
          await this.removeChatFromLocal(chatId, userId);
        }
        
      } else {
        // 로컬에서 삭제
        await this.removeChatFromLocal(chatId, userId);
      }
      
      console.log('채팅 삭제 완료', { chatId });
      
    } catch (error) {
      console.error('채팅 삭제 실패', error);
      throw new Error('채팅을 삭제할 수 없습니다.');
    }
  }
  
  /**
   * 로컬에서 채팅 제거
   */
  private async removeChatFromLocal(chatId: string, userId?: string): Promise<void> {
    const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
    const existingChats = await this.loadChatsFromLocal(Number(userId));
    const updatedChats = existingChats.filter((chat: ChatSession) => chat.chat_id !== chatId);
    
    this.saveChatsToLocal(Number(userId), updatedChats);
    
    // 메시지도 함께 삭제
    localStorage.removeItem(`messages:${chatId}`);
  }
  
  // ============================================================================
  // 💬 메시지 관리
  // ============================================================================
  
  /**
   * 메시지 목록 로드
   */
  async loadMessages(chatId: string, userId?: string): Promise<ChatMessage[]> {
    try {
      if (!chatId || chatId.trim().length === 0) {
        throw new Error('채팅 ID는 필수입니다.');
      }
      
      console.log('메시지 로드 시작', { chatId, userId });
      
      let messages: ChatMessage[] = [];
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 로드 시도
        try {
          const response = await fetch(`${this.config.apiBaseUrl}/api/chats/${chatId}`, {
            method: 'GET',
            headers: this.getAuthHeaders()
          });
          
          if (response.ok) {
            const data = await response.json();
            messages = data?.messages || [];
            
            // 로컬 캐시에 저장
            if (this.config.enableCache) {
              this.saveMessagesToLocal(chatId, messages);
            }
          } else {
            console.warn('서버에서 메시지 로드 실패, 로컬에서 로드:', response.status);
            messages = await this.loadMessagesFromLocal(chatId);
          }
          
        } catch (error) {
          console.error('서버 연결 실패, 로컬에서 로드:', error);
          messages = await this.loadMessagesFromLocal(chatId);
        }
        
      } else {
        // 로컬에서 로드
        messages = await this.loadMessagesFromLocal(chatId);
      }
      
      console.log('메시지 로드 완료', { 
        chatId, 
        count: messages.length 
      });
      
      return messages;
      
    } catch (error) {
      console.error('메시지 로드 실패', error);
      throw new Error('메시지를 불러올 수 없습니다.');
    }
  }
  
  /**
   * 로컬에서 메시지 로드
   */
  private async loadMessagesFromLocal(chatId: string): Promise<ChatMessage[]> {
    try {
      const stored = localStorage.getItem(`messages:${chatId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('로컬에서 메시지 로드 실패:', error);
      return [];
    }
  }
  
  /**
   * 메시지 전송 (스트리밍 지원)
   */
  async sendMessage(
    chatId: string, 
    text: string, 
    userId?: string,
    onStreamingUpdate?: EventHandler<MessageStreamChunk>
  ): Promise<ChatMessage> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('메시지 내용은 필수입니다.');
      }
      
      if (!chatId || chatId.trim().length === 0) {
        throw new Error('채팅 ID는 필수입니다.');
      }
      
      console.log('메시지 전송 시작', { 
        chatId, 
        textLength: text.length,
        enableStreaming: this.config.enableStreaming 
      });
      
      // 사용자 메시지 생성
      const userMessage: ChatMessage = {
        message_id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text,
        sender: 'user',
        timestamp: new Date().toISOString(),
        status: 'sent'
      } as UserMessage;
      
      // 사용자 메시지 저장
      await this.saveMessage(chatId, userMessage, userId);
      
      if (this.config.storageType === 'server') {
        // 서버 API 호출
        if (this.config.enableStreaming && onStreamingUpdate) {
          return await this.sendStreamingMessage(chatId, text, onStreamingUpdate, userId);
        } else {
          return await this.sendRegularMessage(chatId, text, userId);
        }
        
      } else {
        // 로컬 모드에서는 모의 AI 응답 생성
        return await this.generateMockResponse(chatId, text, userId);
      }
      
    } catch (error) {
      console.error('메시지 전송 실패', error);
      throw new Error('메시지를 전송할 수 없습니다.');
    }
  }
  
  // ============================================================================
  // 🔧 Private 헬퍼 메서드들
  // ============================================================================
  
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
  
  private buildQueryParams(options?: ChatListOptions): Record<string, any> {
    if (!options) return {};
    
    return {
      type: options.type,
      includeArchived: options.includeArchived,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit,
      offset: options.offset
    };
  }
  
  private sortAndFilterChats(chats: ChatSession[], options?: ChatListOptions): ChatSession[] {
    let result = [...chats];
    
    // 필터링
    if (options?.type) {
      result = result.filter(chat => chat.type === options.type);
    }
    
    if (!options?.includeArchived) {
      result = result.filter(chat => !chat.isArchived);
    }
    
    // 정렬
    const sortBy = options?.sortBy || 'updatedAt';
    const sortOrder = options?.sortOrder || 'desc';
    
    result.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return result;
  }
  
  private async saveMessage(chatId: string, message: ChatMessage, userId?: string): Promise<void> {
    const storageKey = `messages:${chatId}`;
    const existingMessages = await this.loadMessagesFromLocal(chatId);
    const updatedMessages = [...existingMessages, message];
    
    this.saveMessagesToLocal(chatId, updatedMessages);
    
    // 채팅 세션의 lastActivity 업데이트
    await this.updateChatActivity(chatId, userId);
  }
  
  /**
   * 로컬에 메시지 저장
   */
  private saveMessagesToLocal(chatId: string, messages: ChatMessage[]): void {
    localStorage.setItem(`messages:${chatId}`, JSON.stringify(messages));
  }
  
  private async updateChatActivity(chatId: string, userId?: string): Promise<void> {
    try {
      const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
      const chats = await this.loadChatsFromLocal(Number(userId));
      
      const updatedChats = chats.map((chat: ChatSession) => {
        if (chat.chat_id === chatId) {
          return {
            ...chat,
            updatedAt: new Date().toISOString(),
            metadata: {
              ...chat.metadata,
              lastActivity: new Date().toISOString(),
              totalMessages: chat.metadata.totalMessages + 1
            }
          };
        }
        return chat;
      });
      
      this.saveChatsToLocal(Number(userId), updatedChats);
      
    } catch (error) {
      console.error('채팅 활동 업데이트 실패', error);
      // 이 오류는 치명적이지 않으므로 무시
    }
  }
  
  private async sendStreamingMessage(
    chatId: string, 
    text: string, 
    onStreamingUpdate: EventHandler<MessageStreamChunk>,
    userId?: string
  ): Promise<ChatMessage> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ message: text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('스트리밍 응답을 읽을 수 없습니다');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantMessage: ChatMessage = {
      message_id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: '',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      status: 'streaming',
      isStreaming: true
    } as AssistantMessage;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('DATA: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'streaming') {
                assistantMessage = {
                  ...assistantMessage,
                  text: data.message.text,
                  isStreaming: true
                } as AssistantMessage;
                
                // 스트리밍 업데이트 콜백 호출
                onStreamingUpdate({
                  messageId: assistantMessage.message_id,
                  content: data.message.text,
                  isComplete: false
                });
                
              } else if (data.type === 'paragraph' || data.type === 'complete') {
                assistantMessage = {
                  ...assistantMessage,
                  text: data.message.text,
                  status: 'sent',
                  isStreaming: false,
                  streamingComplete: true
                } as AssistantMessage;
                
                // 최종 메시지 저장
                await this.saveMessage(chatId, assistantMessage, userId);
                
                // 완료 콜백 호출
                onStreamingUpdate({
                  messageId: assistantMessage.message_id,
                  content: data.message.text,
                  isComplete: true
                });
              }
              
            } catch (parseError) {
              console.error('스트리밍 데이터 파싱 실패', parseError);
            }
          }
        }
      }
      
    } finally {
      reader.releaseLock();
    }
    
    return assistantMessage;
  }
  
  private async sendRegularMessage(chatId: string, text: string, userId?: string): Promise<ChatMessage> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ message: text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const assistantMessage: ChatMessage = {
      message_id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: data.text || data.message,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    
    await this.saveMessage(chatId, assistantMessage, userId);
    return assistantMessage;
  }
  
  private async generateMockResponse(chatId: string, text: string, userId?: string): Promise<ChatMessage> {
    // 로컬 모드에서의 모의 AI 응답
    await new Promise(resolve => setTimeout(resolve, 1000)); // 응답 지연 시뮬레이션
    
    const responses = [
      '안녕하세요! 무엇을 도와드릴까요?',
      '좋은 질문이네요. 더 자세히 설명해드리겠습니다.',
      '이해했습니다. 다음과 같이 답변드리겠습니다.',
      '흥미로운 주제네요. 제가 아는 바로는...',
      '도움이 되었기를 바랍니다. 다른 질문이 있으시면 언제든 말씀해주세요!'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    const assistantMessage: ChatMessage = {
      message_id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `${randomResponse}\n\n입력하신 내용: "${text}"`,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    
    await this.saveMessage(chatId, assistantMessage, userId);
    return assistantMessage;
  }
}
