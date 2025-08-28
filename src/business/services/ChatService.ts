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
  EventHandler
} from '../types/chat.types';

import { StorageAdapter } from '../../data/adapters/StorageAdapter';
import { LocalStorageAdapter } from '../../data/adapters/LocalStorageAdapter';
import { ServerStorageAdapter } from '../../data/adapters/ServerStorageAdapter';
import { ApiClient } from '../../data/api/ApiClient';
import { Logger } from '../../infrastructure/logger/Logger';
import { ErrorHandler } from '../../infrastructure/errors/ErrorHandler';
import { InputValidator } from '../validators/InputValidator';

export class ChatService {
  private readonly storageAdapter: StorageAdapter;
  private readonly apiClient: ApiClient;
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
    
    // 스토리지 어댑터 초기화
    this.storageAdapter = this.createStorageAdapter(storageType);
    
    // API 클라이언트 초기화
    this.apiClient = new ApiClient({
      baseURL: this.config.apiBaseUrl,
      timeout: this.config.requestTimeout,
      retryAttempts: this.config.retryAttempts
    });
    
    Logger.info('ChatService 초기화됨', { 
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
  async loadChats(userId?: string, options?: ChatListOptions): Promise<ChatSession[]> {
    try {
      Logger.info('채팅 목록 로드 시작', { userId, options });
      
      let chats: ChatSession[];
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 로드
        const response = await this.apiClient.get<ChatSession[]>('/api/chats', {
          headers: this.getAuthHeaders(),
          params: this.buildQueryParams(options)
        });
        
        chats = response.data || [];
        
        // 캐시에 저장
        if (this.config.enableCache) {
          await this.storageAdapter.set(`chats:${userId}`, chats);
        }
        
      } else {
        // 로컬에서 로드
        const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
        chats = await this.storageAdapter.get(storageKey) || [];
      }
      
      // 정렬 및 필터링
      chats = this.sortAndFilterChats(chats, options);
      
      Logger.info('채팅 목록 로드 완료', { 
        count: chats.length, 
        storageType: this.config.storageType 
      });
      
      return chats;
      
    } catch (error) {
      Logger.error('채팅 목록 로드 실패', error);
      throw ErrorHandler.handle(error, 'CHAT_LOAD_FAILED');
    }
  }
  
  /**
   * 새 채팅 생성
   */
  async createChat(options: ChatCreateOptions): Promise<ChatSession> {
    try {
      InputValidator.validateChatTitle(options.title);
      
      Logger.info('새 채팅 생성 시작', options);
      
      const chatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const newChat: ChatSession = {
        id: chatId,
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
        // 서버에 저장
        const response = await this.apiClient.post<ChatSession>('/api/chats', newChat, {
          headers: this.getAuthHeaders()
        });
        
        const serverChat = response.data!;
        
        // 캐시 업데이트
        if (this.config.enableCache) {
          const existingChats = await this.storageAdapter.get(`chats:${options.userId}`) || [];
          await this.storageAdapter.set(`chats:${options.userId}`, [serverChat, ...existingChats]);
        }
        
        Logger.info('새 채팅 서버에 생성됨', { chatId: serverChat.id });
        return serverChat;
        
      } else {
        // 로컬에 저장
        const storageKey = options.userId ? `chats:${options.userId}` : 'anonymous_chats';
        const existingChats = await this.storageAdapter.get(storageKey) || [];
        const updatedChats = [newChat, ...existingChats];
        
        await this.storageAdapter.set(storageKey, updatedChats);
        
        // 활성 채팅 ID 저장
        await this.storageAdapter.set('active_chat_id', chatId);
        
        Logger.info('새 채팅 로컬에 생성됨', { chatId });
        return newChat;
      }
      
    } catch (error) {
      Logger.error('채팅 생성 실패', error);
      throw ErrorHandler.handle(error, 'CHAT_CREATE_FAILED');
    }
  }
  
  /**
   * 채팅 삭제
   */
  async deleteChat(chatId: string, userId?: string): Promise<void> {
    try {
      InputValidator.validateId(chatId);
      
      Logger.info('채팅 삭제 시작', { chatId, userId });
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 삭제
        await this.apiClient.delete(`/api/chats/${chatId}`, {
          headers: this.getAuthHeaders()
        });
        
        // 캐시에서도 제거
        if (this.config.enableCache) {
          const existingChats = await this.storageAdapter.get(`chats:${userId}`) || [];
          const updatedChats = existingChats.filter((chat: ChatSession) => chat.id !== chatId);
          await this.storageAdapter.set(`chats:${userId}`, updatedChats);
        }
        
      } else {
        // 로컬에서 삭제
        const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
        const existingChats = await this.storageAdapter.get(storageKey) || [];
        const updatedChats = existingChats.filter((chat: ChatSession) => chat.id !== chatId);
        
        await this.storageAdapter.set(storageKey, updatedChats);
        
        // 메시지도 함께 삭제
        await this.storageAdapter.delete(`messages:${chatId}`);
      }
      
      Logger.info('채팅 삭제 완료', { chatId });
      
    } catch (error) {
      Logger.error('채팅 삭제 실패', error);
      throw ErrorHandler.handle(error, 'CHAT_DELETE_FAILED');
    }
  }
  
  // ============================================================================
  // 💬 메시지 관리
  // ============================================================================
  
  /**
   * 메시지 목록 로드
   */
  async loadMessages(chatId: string, userId?: string): Promise<ChatMessage[]> {
    try {
      InputValidator.validateId(chatId);
      
      Logger.info('메시지 로드 시작', { chatId, userId });
      
      let messages: ChatMessage[];
      
      if (this.config.storageType === 'server' && userId) {
        // 서버에서 로드
        const response = await this.apiClient.get<{ messages: ChatMessage[] }>(
          `/api/chats/${chatId}`,
          { headers: this.getAuthHeaders() }
        );
        
        messages = response.data?.messages || [];
        
        // 캐시에 저장
        if (this.config.enableCache) {
          await this.storageAdapter.set(`messages:${chatId}`, messages);
        }
        
      } else {
        // 로컬에서 로드
        messages = await this.storageAdapter.get(`messages:${chatId}`) || [];
      }
      
      Logger.info('메시지 로드 완료', { 
        chatId, 
        count: messages.length 
      });
      
      return messages;
      
    } catch (error) {
      Logger.error('메시지 로드 실패', error);
      throw ErrorHandler.handle(error, 'MESSAGE_LOAD_FAILED');
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
      InputValidator.validateMessage(text);
      InputValidator.validateId(chatId);
      
      Logger.info('메시지 전송 시작', { 
        chatId, 
        textLength: text.length,
        enableStreaming: this.config.enableStreaming 
      });
      
      // 사용자 메시지 생성
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text,
        sender: 'user',
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      
      // 사용자 메시지 저장
      await this.saveMessage(chatId, userMessage, userId);
      
      if (this.config.storageType === 'server') {
        // 서버 API 호출
        if (this.config.enableStreaming && onStreamingUpdate) {
          return await this.sendStreamingMessage(chatId, text, userId, onStreamingUpdate);
        } else {
          return await this.sendRegularMessage(chatId, text, userId);
        }
        
      } else {
        // 로컬 모드에서는 모의 AI 응답 생성
        return await this.generateMockResponse(chatId, text, userId);
      }
      
    } catch (error) {
      Logger.error('메시지 전송 실패', error);
      throw ErrorHandler.handle(error, 'MESSAGE_SEND_FAILED');
    }
  }
  
  // ============================================================================
  // 🔧 Private 헬퍼 메서드들
  // ============================================================================
  
  private createStorageAdapter(storageType: StorageType): StorageAdapter {
    switch (storageType) {
      case 'local':
        return new LocalStorageAdapter();
      case 'server':
        return new ServerStorageAdapter(this.apiClient);
      default:
        throw new Error(`지원되지 않는 스토리지 타입: ${storageType}`);
    }
  }
  
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
    const existingMessages = await this.storageAdapter.get(storageKey) || [];
    const updatedMessages = [...existingMessages, message];
    
    await this.storageAdapter.set(storageKey, updatedMessages);
    
    // 채팅 세션의 lastActivity 업데이트
    await this.updateChatActivity(chatId, userId);
  }
  
  private async updateChatActivity(chatId: string, userId?: string): Promise<void> {
    try {
      const storageKey = userId ? `chats:${userId}` : 'anonymous_chats';
      const chats = await this.storageAdapter.get(storageKey) || [];
      
      const updatedChats = chats.map((chat: ChatSession) => {
        if (chat.id === chatId) {
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
      
      await this.storageAdapter.set(storageKey, updatedChats);
      
    } catch (error) {
      Logger.error('채팅 활동 업데이트 실패', error);
      // 이 오류는 치명적이지 않으므로 무시
    }
  }
  
  private async sendStreamingMessage(
    chatId: string, 
    text: string, 
    userId?: string,
    onStreamingUpdate: EventHandler<MessageStreamChunk>
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
      id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: '',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      status: 'streaming',
      isStreaming: true
    };
    
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
                };
                
                // 스트리밍 업데이트 콜백 호출
                onStreamingUpdate({
                  messageId: assistantMessage.id,
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
                };
                
                // 최종 메시지 저장
                await this.saveMessage(chatId, assistantMessage, userId);
                
                // 완료 콜백 호출
                onStreamingUpdate({
                  messageId: assistantMessage.id,
                  content: data.message.text,
                  isComplete: true
                });
              }
              
            } catch (parseError) {
              Logger.error('스트리밍 데이터 파싱 실패', parseError);
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
    const response = await this.apiClient.post(`/api/chats/${chatId}/messages`, 
      { message: text },
      { headers: this.getAuthHeaders() }
    );
    
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: response.data.text || response.data.message,
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
      id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `${randomResponse}\n\n입력하신 내용: "${text}"`,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    
    await this.saveMessage(chatId, assistantMessage, userId);
    return assistantMessage;
  }
}
