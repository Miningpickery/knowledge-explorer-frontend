/**
 * 🧪 테스트 유틸리티 - 상용화 수준
 * @description 포괄적인 테스트 헬퍼 함수들과 목킹 유틸리티
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, Mock, MockedFunction } from 'vitest';

import { 
  ChatSession, 
  ChatMessage, 
  User, 
  TestContext,
  MockChatSession,
  MockMessage 
} from '../../business/types/chat.types';
import { useChatStore } from '../../business/stores/chatStore';
import { ChatService } from '../../business/services/ChatService';
import { ErrorHandler } from '../../infrastructure/errors/ErrorHandler';
import { Logger } from '../../infrastructure/logger/Logger';

// ============================================================================
// 🎭 Mock 데이터 팩토리
// ============================================================================

export class MockDataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: 'https://example.com/avatar.jpg',
      googleId: 'google-123',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides
    };
  }

  static createChat(overrides?: Partial<MockChatSession>): ChatSession {
    const now = new Date().toISOString();
    return {
      id: `chat-${Date.now()}`,
      title: 'Test Chat',
      type: 'conversation',
      userId: 'user-123',
      createdAt: now,
      updatedAt: now,
      metadata: {
        totalMessages: 0,
        lastActivity: now,
        topics: ['test'],
        sentiment: 'neutral'
      },
      isActive: true,
      isArchived: false,
      ...overrides
    };
  }

  static createMessage(overrides?: Partial<MockMessage>): ChatMessage {
    return {
      id: `msg-${Date.now()}`,
      text: 'Test message',
      sender: 'user',
      timestamp: new Date().toISOString(),
      status: 'sent',
      ...overrides
    };
  }

  static createConversation(messageCount: number = 4): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const now = Date.now();
    
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg-${i}`,
        text: i % 2 === 0 ? `User message ${i / 2 + 1}` : `Assistant response ${Math.floor(i / 2) + 1}`,
        sender: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date(now + i * 1000).toISOString(),
        status: 'sent'
      });
    }
    
    return messages;
  }

  static createTestContext(overrides?: Partial<TestContext>): TestContext {
    return {
      user: this.createUser(),
      chats: [this.createChat(), this.createChat({ title: 'Second Chat' })],
      messages: this.createConversation(6),
      config: {
        api: {
          baseUrl: 'http://localhost:3001',
          timeout: 5000,
          retryAttempts: 2
        }
      },
      ...overrides
    };
  }
}

// ============================================================================
// 🎯 커스텀 렌더 함수
// ============================================================================

interface CustomRenderOptions extends RenderOptions {
  initialState?: Partial<any>;
  testContext?: TestContext;
  withRouter?: boolean;
  withQueryClient?: boolean;
}

function createTestProviders(options: CustomRenderOptions = {}) {
  const { withRouter = true, withQueryClient = true, testContext } = options;
  
  const providers: React.ComponentType<{ children: React.ReactNode }>[] = [];
  
  // React Query Provider
  if (withQueryClient) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    providers.push(({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ));
  }
  
  // Router Provider
  if (withRouter) {
    providers.push(({ children }) => (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    ));
  }
  
  // Test Context Provider (Zustand store 초기화)
  if (testContext) {
    providers.push(({ children }) => {
      // Store 초기화 로직
      React.useEffect(() => {
        const store = useChatStore.getState();
        
        if (testContext.user) {
          store.actions.login(testContext.user);
        }
        
        // 테스트 데이터로 store 초기화 (실제 구현에서는 store의 내부 메서드 사용)
      }, []);
      
      return <>{children}</>;
    });
  }
  
  return providers;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof render> & { user: ReturnType<typeof userEvent.setup> } {
  const providers = createTestProviders(options);
  
  const AllProviders = ({ children }: { children: React.ReactNode }) => {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
  };
  
  const user = userEvent.setup();
  
  return {
    user,
    ...render(ui, { wrapper: AllProviders, ...options })
  };
}

// ============================================================================
// 🎭 Service Mocking
// ============================================================================

export class ServiceMocker {
  static mockChatService(): MockedFunction<any> {
    const mockService = {
      loadChats: vi.fn(),
      createChat: vi.fn(),
      deleteChat: vi.fn(),
      loadMessages: vi.fn(),
      sendMessage: vi.fn()
    };
    
    // 기본 동작 설정
    mockService.loadChats.mockResolvedValue([
      MockDataFactory.createChat(),
      MockDataFactory.createChat({ title: 'Another Chat' })
    ]);
    
    mockService.createChat.mockResolvedValue(
      MockDataFactory.createChat({ title: 'New Chat' })
    );
    
    mockService.deleteChat.mockResolvedValue(undefined);
    
    mockService.loadMessages.mockResolvedValue(
      MockDataFactory.createConversation()
    );
    
    mockService.sendMessage.mockResolvedValue(
      MockDataFactory.createMessage({ 
        sender: 'assistant', 
        text: 'Mock AI response' 
      })
    );
    
    return mockService;
  }

  static mockErrorHandler(): void {
    vi.spyOn(ErrorHandler, 'handle').mockImplementation((error) => {
      console.error('Mock ErrorHandler:', error);
      return error as any;
    });
    
    vi.spyOn(ErrorHandler, 'handleWithRetry').mockImplementation(
      async (operation) => {
        return await operation();
      }
    );
  }

  static mockLogger(): void {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  }

  static mockLocalStorage(): void {
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
    
    return localStorageMock;
  }

  static mockFetch(): MockedFunction<typeof fetch> {
    const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
    
    // 기본 성공 응답
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK'
    } as Response);
    
    global.fetch = mockFetch;
    return mockFetch;
  }
}

// ============================================================================
// 🎯 테스트 헬퍼 함수들
// ============================================================================

export class TestHelpers {
  /**
   * 메시지 전송 시뮬레이션
   */
  static async simulateMessageSend(
    messageText: string,
    user: ReturnType<typeof userEvent.setup>
  ): Promise<void> {
    const messageInput = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /전송|send/i });
    
    await user.type(messageInput, messageText);
    await user.click(sendButton);
    
    // 메시지가 UI에 나타날 때까지 대기
    await waitFor(() => {
      expect(screen.getByText(messageText)).toBeInTheDocument();
    });
  }

  /**
   * 채팅 선택 시뮬레이션
   */
  static async simulateChatSelection(
    chatTitle: string,
    user: ReturnType<typeof userEvent.setup>
  ): Promise<void> {
    const chatItem = screen.getByText(chatTitle);
    await user.click(chatItem);
    
    // 채팅이 활성화될 때까지 대기
    await waitFor(() => {
      expect(chatItem).toHaveClass('active'); // 실제 클래스명에 맞게 조정
    });
  }

  /**
   * 로딩 상태 대기
   */
  static async waitForLoadingToFinish(): Promise<void> {
    await waitFor(() => {
      expect(screen.queryByText(/로딩|loading/i)).not.toBeInTheDocument();
    });
  }

  /**
   * 에러 메시지 확인
   */
  static async expectErrorMessage(message: string): Promise<void> {
    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
    });
  }

  /**
   * 스트리밍 메시지 시뮬레이션
   */
  static simulateStreamingResponse(
    chunks: string[],
    onChunk?: (chunk: string) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      let index = 0;
      const interval = setInterval(() => {
        if (index < chunks.length) {
          const chunk = chunks[index];
          onChunk?.(chunk);
          index++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 네트워크 지연 시뮬레이션
   */
  static createNetworkDelay(ms: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 랜덤 에러 생성
   */
  static createRandomError(): Error {
    const errorTypes = [
      'Network Error',
      'Authentication Failed',
      'Server Error',
      'Validation Error'
    ];
    
    const randomType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    return new Error(randomType);
  }
}

// ============================================================================
// 🎯 테스트 상태 관리
// ============================================================================

export class TestStateManager {
  private static store: any = null;
  
  /**
   * 테스트용 store 상태 설정
   */
  static setState(state: Partial<any>): void {
    if (!this.store) {
      this.store = useChatStore.getState();
    }
    
    // 상태 직접 설정 (테스트용)
    Object.assign(this.store, state);
  }

  /**
   * 테스트용 store 초기화
   */
  static resetState(): void {
    if (this.store) {
      // 초기 상태로 리셋
      this.setState({
        chats: [],
        activeChat: null,
        messages: [],
        isLoading: false,
        error: null,
        user: null,
        isAuthenticated: false
      });
    }
  }

  /**
   * 현재 store 상태 가져오기
   */
  static getState(): any {
    return this.store || useChatStore.getState();
  }
}

// ============================================================================
// 🎯 통합 테스트 헬퍼
// ============================================================================

export function createIntegrationTest(
  testName: string,
  testFn: (context: {
    render: typeof renderWithProviders;
    user: ReturnType<typeof userEvent.setup>;
    helpers: typeof TestHelpers;
    mocks: typeof ServiceMocker;
    state: typeof TestStateManager;
  }) => Promise<void>
) {
  return async () => {
    // 테스트 환경 설정
    const user = userEvent.setup();
    
    // Mock 설정
    ServiceMocker.mockLogger();
    ServiceMocker.mockErrorHandler();
    const mockFetch = ServiceMocker.mockFetch();
    
    // 테스트 실행
    await testFn({
      render: renderWithProviders,
      user,
      helpers: TestHelpers,
      mocks: ServiceMocker,
      state: TestStateManager
    });
    
    // 정리
    vi.clearAllMocks();
    TestStateManager.resetState();
  };
}

// ============================================================================
// 🎯 성능 테스트 헬퍼
// ============================================================================

export class PerformanceTestHelpers {
  /**
   * 렌더링 성능 측정
   */
  static measureRenderTime(component: ReactElement): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      render(component);
      
      requestAnimationFrame(() => {
        const endTime = performance.now();
        resolve(endTime - startTime);
      });
    });
  }

  /**
   * 메모리 사용량 측정 (브라우저 환경에서만)
   */
  static measureMemoryUsage(): any {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  /**
   * 대량 데이터 테스트
   */
  static createLargeDataSet(messageCount: number): ChatMessage[] {
    return Array.from({ length: messageCount }, (_, i) => 
      MockDataFactory.createMessage({
        id: `msg-${i}`,
        text: `Message ${i} - ${Math.random().toString(36).substr(2, 20)}`,
        sender: i % 2 === 0 ? 'user' : 'assistant'
      })
    );
  }
}

// 내보내기
export {
  screen,
  waitFor,
  userEvent,
  vi
} from '@testing-library/react';
