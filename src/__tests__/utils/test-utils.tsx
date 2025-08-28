// 🧪 Test Utilities
// 상용화 수준의 테스트 유틸리티 및 헬퍼

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { ChatSession, ChatMessage, User } from '../../types';

/**
 * 🏭 Mock Data Factory
 */
export class MockDataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createChatSession(overrides?: Partial<ChatSession>): ChatSession {
    return {
      id: `chat-${Date.now()}`,
      title: 'Test Chat',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 1,
      ...overrides,
    };
  }

  static createChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
    return {
      id: `msg-${Date.now()}`,
      text: 'Test message',
      sender: 'user',
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  static createMultipleChats(count: number): ChatSession[] {
    return Array.from({ length: count }, (_, index) =>
      MockDataFactory.createChatSession({
        id: `chat-${index}`,
        title: `Test Chat ${index + 1}`,
      })
    );
  }

  static createMultipleMessages(count: number): ChatMessage[] {
    return Array.from({ length: count }, (_, index) =>
      MockDataFactory.createChatMessage({
        id: `msg-${index}`,
        text: `Test message ${index + 1}`,
        sender: index % 2 === 0 ? 'user' : 'model',
      })
    );
  }
}

/**
 * 🔧 Mock Store Creator
 */
export function createMockStores() {
  const mockChatStore = {
    chats: [],
    activeChatId: null,
    messages: [],
    isLoadingChats: false,
    isLoadingMessages: false,
    isSendingMessage: false,
    error: null,
    isInitialized: false,
    setChats: vi.fn(),
    setActiveChatId: vi.fn(),
    setMessages: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    setLoadingChats: vi.fn(),
    setLoadingMessages: vi.fn(),
    setSendingMessage: vi.fn(),
    setError: vi.fn(),
    setInitialized: vi.fn(),
    syncWithLocalStorage: vi.fn(),
    saveToLocalStorage: vi.fn(),
    getChatById: vi.fn(),
  };

  const mockAuthStore = {
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,
    showProfile: false,
    login: vi.fn(),
    logout: vi.fn(),
    setShowProfile: vi.fn(),
    setError: vi.fn(),
  };

  const mockUIStore = {
    sidebarOpen: true,
    theme: 'light' as const,
    notifications: [],
    globalLoading: false,
    setSidebarOpen: vi.fn(),
    setGlobalLoading: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
  };

  return {
    mockChatStore,
    mockAuthStore,
    mockUIStore,
  };
}

/**
 * 🎭 Custom Render Function
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialStoreState?: {
    chat?: Partial<typeof createMockStores>['mockChatStore'];
    auth?: Partial<typeof createMockStores>['mockAuthStore'];
    ui?: Partial<typeof createMockStores>['mockUIStore'];
  };
  withQueryClient?: boolean;
}

function AllTheProviders({ children, options }: { 
  children: React.ReactNode; 
  options?: CustomRenderOptions;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  let Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;

  if (options?.withQueryClient !== false) {
    Wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return <Wrapper>{children}</Wrapper>;
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & {
  rerender: (ui: ReactElement) => void;
} {
  const renderResult = render(ui, {
    wrapper: ({ children }) => <AllTheProviders options={options}>{children}</AllTheProviders>,
    ...options,
  });

  return {
    ...renderResult,
    rerender: (ui: ReactElement) => {
      return renderResult.rerender(
        <AllTheProviders options={options}>{children}</AllTheProviders>
      );
    },
  };
}

/**
 * 🌐 API Mocking Utilities
 */
export class ApiMocker {
  static mockFetch(response: any, status: number = 200, ok: boolean = true) {
    return vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers(),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      clone: () => ({}),
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
    });
  }

  static mockStreamingResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    let chunkIndex = 0;

    const stream = new ReadableStream({
      start(controller) {
        const sendChunk = () => {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
            setTimeout(sendChunk, 100); // Simulate streaming delay
          } else {
            controller.close();
          }
        };
        sendChunk();
      },
    });

    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      getReader: () => stream.getReader(),
    });
  }

  static mockErrorResponse(status: number = 500, message: string = 'Server Error') {
    return vi.fn().mockRejectedValue(new Error(message));
  }
}

/**
 * 🎯 Event Utilities
 */
export class EventUtils {
  static createFile(
    name: string = 'test.txt',
    content: string = 'test content',
    type: string = 'text/plain'
  ): File {
    return new File([content], name, { type });
  }

  static createDropEvent(files: File[]): Partial<DragEvent> {
    return {
      dataTransfer: {
        files: files as any,
        items: files.map(file => ({
          kind: 'file',
          type: file.type,
          getAsFile: () => file,
        })) as any,
        types: ['Files'],
        getData: vi.fn(),
        setData: vi.fn(),
        clearData: vi.fn(),
        setDragImage: vi.fn(),
        dropEffect: 'copy',
        effectAllowed: 'all',
      },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
  }

  static waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 📊 Assertion Helpers
 */
export class AssertionHelpers {
  static expectToBeLoading(element: HTMLElement) {
    expect(element).toHaveAttribute('aria-busy', 'true');
  }

  static expectToHaveError(element: HTMLElement, errorMessage?: string) {
    expect(element).toHaveAttribute('aria-invalid', 'true');
    if (errorMessage) {
      expect(element.closest('div')).toHaveTextContent(errorMessage);
    }
  }

  static expectToBeAccessible(element: HTMLElement) {
    expect(element).toHaveAttribute('role');
    expect(element).toHaveAttribute('aria-label');
  }

  static expectValidationToPass(validationResult: { isValid: boolean; errors: string[] }) {
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
  }

  static expectValidationToFail(
    validationResult: { isValid: boolean; errors: string[] },
    expectedErrors?: string[]
  ) {
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThan(0);
    if (expectedErrors) {
      expectedErrors.forEach(error => {
        expect(validationResult.errors).toContain(error);
      });
    }
  }
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { vi, expect } from 'vitest';

export default {
  MockDataFactory,
  createMockStores,
  customRender,
  ApiMocker,
  EventUtils,
  AssertionHelpers,
};
