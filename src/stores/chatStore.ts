// 🏪 Chat State Management with Zustand
// 상용화 수준의 중앙 집중식 채팅 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 타입을 직접 정의
enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}

interface ChatMessage {
  message_id: string;  // 🚨 id → message_id로 변경
  text: string;
  sender: MessageSender;
  timestamp: string;
  sources?: string[];
  followUpQuestions?: string[];
  context?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string;
}

interface ChatSession {
  chat_id: string;  // 백엔드 Key와 통일
  user_id?: number;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  messages?: ChatMessage[];
  context?: string;
  tags?: string[];
  messageCount?: number;
}

interface ChatState {
  // 📋 Chat Data
  chats: ChatSession[];
  activeChatId: string | null;
  messages: ChatMessage[];
  
  // 🔄 Loading States
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  
  // 📱 Local Storage Support
  localChats: ChatSession[];
  activeLocalChatId: string | null;
  
  // 🎯 UI State
  error: string | null;
  isInitialized: boolean;
}

interface ChatActions {
  // 📋 Chat Management
  setChats: (chats: ChatSession[]) => void;
  addChat: (chat: ChatSession) => void;
  updateChat: (chatId: string, updates: Partial<ChatSession>) => void;
  removeChat: (chatId: string) => void;
  
  // 🎯 Active Chat
  setActiveChatId: (chatId: string | null) => void;
  getActiveChat: () => ChatSession | null;
  
  // 💬 Messages
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  
  // 🔄 Loading States
  setLoadingChats: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setSendingMessage: (sending: boolean) => void;
  
  // 📱 Local Storage
  syncWithLocalStorage: (isAuthenticated: boolean) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  
  // 🎯 Utilities
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
  
  // 📊 Advanced Features
  getChatById: (chatId: string) => ChatSession | null;
  getMessageById: (messageId: string) => ChatMessage | null;
  getRecentChats: (limit?: number) => ChatSession[];
  searchChats: (query: string) => ChatSession[];
}

const initialState: ChatState = {
  chats: [],
  activeChatId: null,
  messages: [],
  isLoadingChats: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  localChats: [],
  activeLocalChatId: null,
  error: null,
  isInitialized: false,
};

export const useChatStore = create<ChatState & ChatActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // 📋 Chat Management
      setChats: (chats) => set((state) => {
        state.chats = chats;
      }),

      addChat: (chat) => set((state) => {
        state.chats.unshift(chat); // Add to beginning for latest first
      }),

      updateChat: (chatId, updates) => set((state) => {
        const index = state.chats.findIndex(chat => chat.chat_id === chatId);
        if (index !== -1) {
          Object.assign(state.chats[index], updates);
        }
      }),

      removeChat: (chatId) => set((state) => {
        state.chats = state.chats.filter(chat => chat.chat_id !== chatId);
        if (state.activeChatId === chatId) {
          state.activeChatId = null;
          state.messages = [];
        }
      }),

      // 🎯 Active Chat
      setActiveChatId: (chatId) => set((state) => {
        // 실제로 다른 채팅방으로 바뀔 때만 메시지 초기화
        if (state.activeChatId !== chatId) {
          state.messages = [];
          console.log('🔄 채팅방 변경 - 메시지 초기화:', { from: state.activeChatId, to: chatId });
        }
        state.activeChatId = chatId;
      }),

      getActiveChat: () => {
        const { chats, activeChatId } = get();
        return chats.find(chat => chat.chat_id === activeChatId) || null;
      },

      // 💬 Messages
      setMessages: (messages) => set((state) => {
        state.messages = messages;
      }),

      addMessage: (message) => set((state) => {
        state.messages.push(message);
      }),

      updateMessage: (messageId, updates) => set((state) => {
        const index = state.messages.findIndex(msg => msg.message_id === messageId);
        if (index !== -1) {
          Object.assign(state.messages[index], updates);
        }
      }),

      removeMessage: (messageId) => set((state) => {
        state.messages = state.messages.filter(msg => msg.message_id !== messageId);
      }),

      clearMessages: () => set((state) => {
        state.messages = [];
      }),

      // 🔄 Loading States
      setLoadingChats: (loading) => set((state) => {
        state.isLoadingChats = loading;
      }),

      setLoadingMessages: (loading) => set((state) => {
        state.isLoadingMessages = loading;
      }),

      setSendingMessage: (sending) => set((state) => {
        state.isSendingMessage = sending;
      }),

      // 📱 Local Storage
      syncWithLocalStorage: (isAuthenticated) => set((state) => {
        if (!isAuthenticated) {
          // Use local storage for anonymous users
          const savedChats = localStorage.getItem('anonymous_chats');
          const savedActiveChatId = localStorage.getItem('active_chat_id');
          
          if (savedChats) {
            try {
              state.localChats = JSON.parse(savedChats);
              state.chats = state.localChats;
            } catch (error) {
              console.error('Failed to parse local chats:', error);
              state.localChats = [];
              state.chats = [];
            }
          }
          
          if (savedActiveChatId) {
            state.activeLocalChatId = savedActiveChatId;
            state.activeChatId = savedActiveChatId;
          }
        }
      }),

      saveToLocalStorage: () => {
        const { chats, activeChatId } = get();
        localStorage.setItem('anonymous_chats', JSON.stringify(chats));
        if (activeChatId) {
          localStorage.setItem('active_chat_id', activeChatId);
        }
      },

      loadFromLocalStorage: () => {
        const savedChats = localStorage.getItem('anonymous_chats');
        const savedActiveChatId = localStorage.getItem('active_chat_id');
        
        if (savedChats) {
          try {
            const parsedChats: ChatSession[] = JSON.parse(savedChats);
            set((state) => {
              state.localChats = parsedChats;
              state.chats = parsedChats;
            });
          } catch (error) {
            console.error('Failed to parse local chats:', error);
          }
        }
        
        if (savedActiveChatId) {
          set((state) => {
            state.activeLocalChatId = savedActiveChatId;
            state.activeChatId = savedActiveChatId;
          });
        }
      },

      // 🎯 Utilities
      setError: (error) => set((state) => {
        state.error = error;
      }),

      setInitialized: (initialized) => set((state) => {
        state.isInitialized = initialized;
      }),

      reset: () => set((state) => {
        Object.assign(state, initialState);
      }),

      // 📊 Advanced Features
      getChatById: (chatId) => {
        const { chats } = get();
        return chats.find(chat => chat.chat_id === chatId) || null;
      },

      getMessageById: (messageId) => {
        const { messages } = get();
        return messages.find(msg => msg.message_id === messageId) || null;
      },

      getRecentChats: (limit = 10) => {
        const { chats } = get();
        return chats
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, limit);
      },

      searchChats: (query) => {
        const { chats } = get();
        const lowercaseQuery = query.toLowerCase();
        return chats.filter(chat => 
          chat.title.toLowerCase().includes(lowercaseQuery) ||
          chat.messages?.some(msg => 
            msg.text.toLowerCase().includes(lowercaseQuery)
          )
        );
      },
    }))
  )
);

// 🎣 Convenient Hooks
export const useChats = () => useChatStore(state => state.chats);
export const useActiveChat = () => useChatStore(state => {
  const { chats, activeChatId } = state;
  return chats.find(chat => chat.chat_id === activeChatId) || null;
});
export const useMessages = () => useChatStore(state => state.messages);
export const useChatLoading = () => useChatStore(state => ({
  isLoadingChats: state.isLoadingChats,
  isLoadingMessages: state.isLoadingMessages,
  isSendingMessage: state.isSendingMessage,
}));

// 📊 Selectors for optimized re-renders
export const selectChatById = (chatId: string) => (state: ChatState) => 
  state.chats.find(chat => chat.chat_id === chatId);

export const selectMessageById = (messageId: string) => (state: ChatState) => 
  state.messages.find(msg => msg.message_id === messageId);

export const selectActiveChatMessages = (state: ChatState) => {
  const activeChat = state.chats.find(chat => chat.chat_id === state.activeChatId);
  return activeChat?.messages || state.messages;
};

// 🔄 Auto-save subscription
if (typeof window !== 'undefined') {
  useChatStore.subscribe(
    (state) => state.chats,
    (chats) => {
      // Auto-save to localStorage when chats change
      if (chats.length > 0) {
        localStorage.setItem('anonymous_chats', JSON.stringify(chats));
      }
    }
  );
}

export default useChatStore;
