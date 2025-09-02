/**
 * 🧠 채팅 스토어 - 상용화 수준 상태 관리
 * @description Zustand 기반 중앙화된 채팅 상태 관리
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ChatSession, ChatMessage, User } from '../types/chat.types';
import { ChatService } from '../services/ChatService';

interface ChatState {
  // 📊 상태
  chats: ChatSession[];
  activeChat: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // 🔐 인증 상태
  user: User | null;
  isAuthenticated: boolean;
  
  // 🎯 액션
  actions: {
    // 채팅 관리
    loadChats: () => Promise<void>;
    createChat: (title?: string) => Promise<ChatSession>;
    selectChat: (chatId: string) => Promise<void>;
    deleteChat: (chatId: string) => Promise<void>;
    
    // 메시지 관리
    sendMessage: (text: string) => Promise<void>;
    loadMessages: (chatId: string) => Promise<void>;
    
    // 인증 관리
    login: (user: User) => void;
    logout: () => void;
    
    // 에러 관리
    setError: (error: string | null) => void;
    clearError: () => void;
  };
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        // 📊 초기 상태
        chats: [],
        activeChat: null,
        messages: [],
        isLoading: false,
        error: null,
        user: null,
        isAuthenticated: false,
        
        // 🎯 액션 구현
        actions: {
          // 📋 채팅 목록 로드
          loadChats: async () => {
            try {
              set({ isLoading: true, error: null });
              
              const { isAuthenticated, user } = get();
              const chatService = new ChatService(
                isAuthenticated ? 'server' : 'local'
              );
              
              const chats = await chatService.loadChats(user?.user_id as any);
              
              set({ 
                chats, 
                isLoading: false,
                // 첫 번째 채팅 자동 선택
                activeChat: chats.length > 0 ? chats[0] : null
              });
              
              console.log('채팅 목록 로드 완료', { count: chats.length });
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '채팅 로드 실패';
              set({ error: errorMessage, isLoading: false });
              console.error('채팅 로드 실패', error);
            }
          },
          
          // ➕ 새 채팅 생성
          createChat: async (title = '새로운 대화') => {
            try {
              set({ isLoading: true, error: null });
              
              const { isAuthenticated, user } = get();
              const chatService = new ChatService(
                isAuthenticated ? 'server' : 'local'
              );
              
              const newChat = await chatService.createChat({
                title,
                userId: user?.user_id
              });
              
              set(state => ({
                chats: [newChat, ...state.chats],
                activeChat: newChat,
                isLoading: false
              }));
              
              console.log('새 채팅 생성', { chatId: newChat.chat_id, title });
              return newChat;
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '채팅 생성 실패';
              set({ error: errorMessage, isLoading: false });
              console.error('채팅 생성 실패', error);
              throw error;
            }
          },
          
          // 🎯 채팅 선택
          selectChat: async (chatId: string) => {
            try {
              const { chats } = get();
              const selectedChat = chats.find(chat => chat.chat_id === chatId);
              
              if (!selectedChat) {
                throw new Error('채팅을 찾을 수 없습니다.');
              }
              
              set({ activeChat: selectedChat });
              
              // 해당 채팅의 메시지 로드
              await get().actions.loadMessages(chatId);
              
              console.log('채팅 선택', { chatId, title: selectedChat.title });
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '채팅 선택 실패';
              set({ error: errorMessage });
              console.error('채팅 선택 실패', error);
            }
          },
          
          // 🗑️ 채팅 삭제
          deleteChat: async (chatId: string) => {
            try {
              const { isAuthenticated, user } = get();
              const chatService = new ChatService(
                isAuthenticated ? 'server' : 'local'
              );
              
              await chatService.deleteChat(chatId);
              
              set(state => ({
                chats: state.chats.filter(chat => chat.chat_id !== chatId),
                activeChat: state.activeChat?.chat_id === chatId ? null : state.activeChat
              }));
              
              console.log('채팅 삭제', { chatId });
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '채팅 삭제 실패';
              set({ error: errorMessage });
              console.error('채팅 삭제 실패', error);
            }
          },
          
          // 📤 메시지 전송
          sendMessage: async (text: string) => {
            try {
              const { activeChat, user } = get();
              
              if (!activeChat) {
                throw new Error('활성 채팅이 없습니다.');
              }
              
              set({ isLoading: true, error: null });
              
              const chatService = new ChatService('server');
              
                             // 사용자 메시지 즉시 추가 (낙관적 업데이트)
               const userMessage: ChatMessage = {
                 message_id: `temp-${Date.now()}`,
                 text,
                 sender: 'user',
                 timestamp: new Date().toISOString(),
                 status: 'sent'
               };
              
              set(state => ({
                messages: [...state.messages, userMessage]
              }));
              
              // AI 응답 받기 (스트리밍)
              await (chatService.sendMessage as any)(
                activeChat.chat_id,
                text,
                user?.user_id,
                (streamingMessage: any) => {
                  // 실시간 응답 업데이트
                  set(state => {
                    const updatedMessages = [...state.messages];
                    const lastIndex = updatedMessages.length - 1;
                    
                    if (lastIndex >= 0 && updatedMessages[lastIndex].sender === 'assistant') {
                      updatedMessages[lastIndex] = streamingMessage;
                    } else {
                      updatedMessages.push(streamingMessage);
                    }
                    
                    return { messages: updatedMessages };
                  });
                }
              );
              
              set({ isLoading: false });
              console.log('메시지 전송 완료', { text: text.substring(0, 50) });
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '메시지 전송 실패';
              set({ error: errorMessage, isLoading: false });
              console.error('메시지 전송 실패', error);
            }
          },
          
          // 📥 메시지 로드
          loadMessages: async (chatId: string) => {
            try {
              const { isAuthenticated, user } = get();
              const chatService = new ChatService(
                isAuthenticated ? 'server' : 'local'
              );
              
              const messages = await (chatService.loadMessages as any)(chatId, user?.user_id);
              set({ messages });
              
              console.log('메시지 로드 완료', { chatId, count: messages.length });
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '메시지 로드 실패';
              set({ error: errorMessage });
              console.error('메시지 로드 실패', error);
            }
          },
          
          // 🔐 로그인
          login: (user: User) => {
            set({ 
              user, 
              isAuthenticated: true,
              // 로그인 시 서버 데이터로 전환
              chats: [],
              activeChat: null,
              messages: []
            });
            
            // 서버 채팅 목록 로드
            get().actions.loadChats();
            
            console.log('사용자 로그인', { userId: user.user_id, email: user.email });
          },
          
          // 🚪 로그아웃
          logout: () => {
            set({ 
              user: null, 
              isAuthenticated: false,
              // 로그아웃 시 로컬 데이터로 전환
              chats: [],
              activeChat: null,
              messages: []
            });
            
            // 로컬 채팅 목록 로드
            get().actions.loadChats();
            
            console.log('사용자 로그아웃');
          },
          
          // ❌ 에러 설정
          setError: (error: string | null) => {
            set({ error });
            if (error) {
              console.error('애플리케이션 에러', error);
            }
          },
          
          // 🧹 에러 초기화
          clearError: () => {
            set({ error: null });
          }
        }
      }),
      {
        name: 'chat-store',
        // 민감한 정보는 persist에서 제외
        partialize: (state) => ({
          chats: state.chats,
          activeChat: state.activeChat,
          messages: state.messages,
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    )
  )
);

// 🎯 편의 함수들
export const useChats = () => useChatStore(state => state.chats);
export const useActiveChat = () => useChatStore(state => state.activeChat);
export const useMessages = () => useChatStore(state => state.messages);
export const useIsLoading = () => useChatStore(state => state.isLoading);
export const useError = () => useChatStore(state => state.error);
export const useUser = () => useChatStore(state => state.user);
export const useIsAuthenticated = () => useChatStore(state => state.isAuthenticated);
export const useChatActions = () => useChatStore(state => state.actions);
