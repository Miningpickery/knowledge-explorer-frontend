/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from './src/stores/authStore';
import { useUIStore } from './src/stores/uiStore';
import { useChatStore } from './src/stores/chatStore';

import { errorHandler, handleApiCall, handleResponse } from './src/services/errorHandler';
import { dataSyncService } from './src/services/dataSyncService';
import { performanceService } from './src/services/performanceService';
import AppHeader from './components/AppHeader';
import ChatSidebar from './components/ChatSidebar';
import ChatInterface from './components/ChatInterface';
import UserProfile from './components/UserProfile';
import NotificationSystem from './components/NotificationSystem';
import ErrorBoundary from './components/ErrorBoundary';
import Modal from './components/ui/Modal';
import SidebarModal from './components/ui/SidebarModal';
import { Button } from './components/ui/Button';
import { Send, MessageCircle, Plus } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';

// 채팅 ID 형식 정의 (백엔드와 일치)
const CHAT_ID_FORMATS = {
  ANONYMOUS: 'temp_', // 익명 사용자: temp_로 시작
  AUTHENTICATED: 'chat-' // 인증 사용자: chat-로 시작
};

// 익명 채팅 ID 확인 함수
const isAnonymousChat = (chatId: string) => {
  return chatId && chatId.startsWith(CHAT_ID_FORMATS.ANONYMOUS);
};

// 🌙 다크모드 스타일
const darkModeStyles = `
  .dark-mode {
    background-color: #1f2937 !important;
    border-color: #374151 !important;
    color: #f9fafb !important;
  }
  
  .dark-mode .prose {
    color: #f9fafb !important;
  }
  
  .dark-mode .prose h1,
  .dark-mode .prose h2,
  .dark-mode .prose h3,
  .dark-mode .prose h4,
  .dark-mode .prose h5,
  .dark-mode .prose h6 {
    color: #f9fafb !important;
  }
  
  .dark-mode .prose p {
    color: #d1d5db !important;
  }
  
  .dark-mode .prose code {
    background-color: #374151 !important;
    color: #f9fafb !important;
  }
  
  .dark-mode .prose pre {
    background-color: #111827 !important;
    color: #f9fafb !important;
  }
  
  .dark-mode .prose blockquote {
    border-left-color: #4b5563 !important;
    color: #d1d5db !important;
  }
  
  .dark-mode .prose a {
    color: #60a5fa !important;
  }
  
  .dark-mode .prose strong {
    color: #f9fafb !important;
  }
  
  .dark-mode .prose em {
    color: #d1d5db !important;
  }
  
  .dark-mode .prose ul li::marker {
    color: #9ca3af !important;
  }
  
  .dark-mode .prose ol li::marker {
    color: #9ca3af !important;
  }
`;

// 타입 정의
enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}



interface ChatMessage {
  message_id: string;
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



const App: React.FC = () => {
  // 🏪 Store Hooks
  const {
    chats,
    activeChatId,
    messages,
    isLoadingChats,
    isLoadingMessages,
    error: chatError,
    isInitialized,
    setChats,
    setActiveChatId,
    setMessages,
    setError: setChatError,
    setInitialized,
    setLoadingMessages,
    syncWithLocalStorage,
    getChatById,
    updateChat,
    addChat,
    removeChat,
    addMessage,
    updateMessage,
    removeMessage,
    setLoadingChats: setChatsLoading,
    setSendingMessage
  } = useChatStore();

  const {
    isAuthenticated,
    user,
    isLoading: authLoading,
    error: authError,
    showProfile,
    login,
    logout,
    updateUser,
    setShowProfile,
    setError: setAuthError,
  } = useAuthStore();

  const {
    sidebarOpen: isSidebarOpen,
    globalLoading,
    setSidebarOpen: setIsSidebarOpen,
  } = useUIStore();

  // 📤 메시지 전송 상태 관리
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  

  


  // 🌙 다크모드 상태 관리
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    const initialMode = saved ? JSON.parse(saved) : false;
    
    // 초기 상태를 body에 적용
    if (initialMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    return initialMode;
  });

  // 다크모드 토글 함수
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev: boolean) => {
      const newMode = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newMode));
      
      // 🌙 body에 다크모드 클래스 추가/제거
      if (newMode) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
      
      return newMode;
    });
  }, []);

  // 구글 로그인 함수
  const handleGoogleLogin = useCallback(() => {
    const googleAuthUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google`;
    window.location.href = googleAuthUrl;
  }, []);

  // 🌙 다크모드 스타일 적용
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = darkModeStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // 🎯 Computed Values
  const activeChat = useChatStore.getState().getChatById(activeChatId || '') || null;
  const isLoading = authLoading || isLoadingChats || isLoadingMessages || globalLoading;
  const error = authError || authError;
  
  // 🔐 인증 관련 함수들
  const checkAuthStatus = useCallback(async () => {
    let token = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');

    if (!token) {
      token = sessionToken;
      if (token) {
        localStorage.setItem('token', token);
      }
    }

    if (token) {
      try {
        // 직접 URL 생성 (API_CONFIG.getApiUrl 대신)
        const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/me`;
        console.log('🔍 API 호출 URL:', apiUrl);
        console.log('🔍 환경 변수 VITE_API_URL:', import.meta.env.VITE_API_URL);
        console.log('🔍 토큰 존재 여부:', !!token);
        console.log('🔍 토큰 길이:', token ? token.length : 0);
        console.log('🔍 토큰 시작 부분:', token ? `${token.substring(0, 50)  }...` : '없음');
        
        // 추가 디버깅: 실제 fetch 요청 상세 정보
        console.log('🔍 Fetch 요청 상세:', {
          method: 'GET',
          url: apiUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : '없음'
          }
        });
        
        // URL 유효성 검사
        try {
          const urlObj = new URL(apiUrl);
          console.log('🔍 URL 파싱 결과:', {
            protocol: urlObj.protocol,
            host: urlObj.host,
            pathname: urlObj.pathname,
            href: urlObj.href
          });
        } catch (urlError) {
          console.error('🔍 URL 파싱 오류:', urlError);
        }
        
        // 직접 fetch 호출
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const userData = await handleResponse<{ data: any }>(response, 'checkAuthStatus');
        const userInfo = userData.data;
        
        // 먼저 현재 사용자의 기존 채팅을 로드
        try {
          console.log('🔄 사용자 기존 채팅 로드 중...');
          const chatResponse = await performanceService.measureApiCall(() =>
            handleApiCall(
              () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }),
              'loadUserChats'
            )
          );
          
          const chatData = await handleResponse<any>(chatResponse, 'loadUserChats');
          const userChats = Array.isArray(chatData) ? chatData : (chatData?.data || []);
          
          if (userChats.length > 0) {
            console.log(`✅ 사용자 채팅 ${userChats.length}개 로드 완료`);
            
            // 백엔드 응답을 프론트엔드 형식으로 정규화
            const normalizedChats = userChats.map((chat: any) => ({
              chat_id: chat.chat_id,
              title: chat.title || '새 대화',
              created_at: chat.created_at || new Date().toISOString(),
              updated_at: chat.updated_at || new Date().toISOString(),
              messages: []
            }));
            
            setChats(normalizedChats);
            
            // 가장 최근 채팅을 활성화하고 메시지 로드
            const latestChat = userChats[0];
            const chatId = latestChat.chat_id;
            setActiveChatId(chatId);
            console.log('✅ 활성 채팅 ID 설정:', chatId);
            
            // 해당 채팅의 메시지도 로드
            try {
              // temp_ 접두사가 있는 채팅은 익명 채팅이므로 로컬 스토리지에서 메시지 로드
              if (chatId.startsWith('temp_')) {
                console.log('📱 익명 채팅 메시지 로드:', chatId);
                const messages = localStorage.getItem(`chat_messages_${chatId}`);
                if (messages) {
                  try {
                    const parsedMessages = JSON.parse(messages);
                    setMessages(parsedMessages);
                    console.log(`✅ 익명 채팅 메시지 ${parsedMessages.length}개 로드 완료`);
                  } catch (error) {
                    console.error('❌ 익명 채팅 메시지 파싱 실패:', error);
                    setMessages([]);
                  }
                } else {
                  console.log('📝 익명 채팅 메시지 없음:', chatId, ', 빈 메시지로 설정');
                  setMessages([]);
                }
              } else {
                // 정상 채팅은 백엔드에서 메시지 로드
                console.log('🔐 인증된 사용자 채팅 메시지 로드:', chatId);
                const messageResponse = await performanceService.measureApiCall(() =>
                  handleApiCall(
                    () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}/messages`, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    }),
                    'loadChatMessages'
                  )
                );
                
                const messages = await handleResponse<ChatMessage[]>(messageResponse, 'loadChatMessages');
                // messages가 undefined이거나 배열이 아닌 경우 처리
                const validMessages = Array.isArray(messages) ? messages : [];
                setMessages(validMessages);
                console.log(`✅ 채팅 메시지 ${validMessages.length}개 로드 완료`);
              }
            } catch (messageError) {
              console.error('❌ 채팅 메시지 로드 실패:', messageError);
              setMessages([]);
            }
          } else {
            console.log('📝 사용자의 기존 채팅이 없습니다.');
          }
        } catch (error) {
          console.error('❌ 사용자 채팅 로드 중 오류:', error);
          // 채팅 로드 실패 시에도 기존 채팅 목록을 유지
          console.log('📝 채팅 로드 실패, 기존 채팅 목록 유지');
          errorHandler.logError({
            code: 'CHAT_LOAD_ERROR',
            message: '사용자 채팅 로드 실패',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            retryable: true,
            severity: 'MEDIUM'
          });
        }
        
        // 익명 채팅이 있으면 마이그레이션 (사용자 채팅 로드 후)
        console.log('🔄 익명 채팅 마이그레이션 시작...');
        await migrateAnonymousChats(token);
        
        // 채팅 목록 로드
        await cleanupChatList(token);
        
        login(userInfo, token);
        return { isAuthenticated: true, user: userInfo };
      } catch (error) {
        console.error('인증 확인 실패:', error);
        localStorage.removeItem('token');
        logout();
      }
    } else {
      // 비로그인 상태: 백엔드에서 익명 채팅 로드
      try {
        console.log('🔄 익명 채팅 로드 중...');
        
        // 백엔드에서 익명 채팅 목록 가져오기
        const chatResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          const anonymousChats = Array.isArray(chatData) ? chatData : (chatData?.data || []);
          
          if (anonymousChats.length > 0) {
            console.log(`✅ 익명 채팅 ${anonymousChats.length}개 로드 완료`);
            
            // 백엔드 응답을 프론트엔드 형식으로 정규화
            const normalizedChats = anonymousChats.map((chat: any) => ({
              chat_id: chat.chat_id,
              title: chat.title || '새 대화',
              created_at: chat.created_at || new Date().toISOString(),
              updated_at: chat.updated_at || new Date().toISOString(),
              messages: []
            }));
            
            // 중복 채팅 제거: chat_id 기준으로 중복 제거
            const uniqueChats = normalizedChats.filter((chat, index, self) => 
              index === self.findIndex(c => c.chat_id === chat.chat_id)
            );
            
            console.log(`🔍 중복 제거: ${normalizedChats.length}개 → ${uniqueChats.length}개`);
            setChats(uniqueChats);
            
            // 가장 최근 채팅을 활성화
            const latestChat = anonymousChats[0];
            const chatId = latestChat.chat_id;
            setActiveChatId(chatId);
            console.log('✅ 익명 활성 채팅 ID 설정:', chatId);
            
            // 해당 채팅의 메시지도 로드
            try {
              const messageResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}/messages`, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (messageResponse.ok) {
                const messages = await messageResponse.json();
                // messages가 undefined이거나 배열이 아닌 경우 처리
                const validMessages = Array.isArray(messages) ? messages : [];
                setMessages(validMessages);
                console.log(`✅ 익명 채팅 메시지 ${validMessages.length}개 로드 완료`);
              } else {
                console.log('📝 익명 채팅 메시지 없음, 빈 메시지로 설정');
                setMessages([]);
              }
            } catch (messageError) {
              console.error('❌ 익명 채팅 메시지 로드 실패:', messageError);
              setMessages([]);
            }
          } else {
            console.log('📝 익명 채팅이 없습니다.');
          }
        } else {
          console.log('📝 익명 채팅 로드 실패, 빈 목록으로 설정');
        }
      } catch (error) {
        console.error('❌ 익명 채팅 로드 실패:', error);
      }
      
      logout();
    }
    
    return { isAuthenticated: false, user: null };
  }, [login, logout]);

  // 🧹 채팅 목록 정리 함수 (단순화)
  const cleanupChatList = useCallback(async (token: string) => {
    try {
      // 백엔드에서 채팅 목록 조회
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const responseData = await response.json();
        const backendChats = responseData.data || responseData;
        
        if (Array.isArray(backendChats)) {
          setChats(backendChats);
          console.log(`✅ 채팅 목록 로드 완료: ${backendChats.length}개`);
        }
      }
    } catch (error) {
      console.error('❌ 채팅 목록 로드 실패:', error);
    }
  }, [setChats]);

  // 🔄 익명 채팅 마이그레이션 함수
  const migrateAnonymousChats = useCallback(async (token: string) => {
    try {
      const anonymousChats = localStorage.getItem('anonymous_chats');
      if (!anonymousChats || anonymousChats === 'undefined' || anonymousChats === 'null') {
        console.log('📝 마이그레이션할 익명 채팅이 없습니다.');
        return;
      }

      let parsedChats;
      try {
        parsedChats = JSON.parse(anonymousChats);
      } catch (error) {
        console.error('❌ 익명 채팅 JSON 파싱 실패:', error);
        return;
      }
      if (!Array.isArray(parsedChats) || parsedChats.length === 0) {
        console.log('📝 마이그레이션할 익명 채팅이 없습니다.');
        return;
      }

      console.log(`🔄 익명 채팅 마이그레이션 시작 - ${parsedChats.length}개 채팅`);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/migrate-anonymous`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ anonymousChats: parsedChats })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 익명 채팅 마이그레이션 완료: ${result.migratedCount}/${result.totalCount}개`);
        
                 // 마이그레이션된 채팅을 기존 채팅 목록에 추가
        if (result.migratedChats && result.migratedChats.length > 0) {
          // 현재 채팅 목록을 가져와서 중복 제거 후 통합
          const currentChats = useChatStore.getState().chats;
          
          // 마이그레이션된 채팅을 정규화
          const normalizedMigratedChats = result.migratedChats.map((chat: any) => ({
            chat_id: chat.chat_id,
            title: chat.title || '새 대화',
            created_at: chat.created_at || new Date().toISOString(),
            updated_at: chat.updated_at || new Date().toISOString(),
            messages: []
          }));
          
          const existingChatIds = new Set(currentChats.map((chat: any) => chat.chat_id));
          const newChats = normalizedMigratedChats.filter((chat: any) => !existingChatIds.has(chat.chat_id));
          
          if (newChats.length > 0) {
            const combinedChats = [...newChats, ...currentChats];
            setChats(combinedChats);
            console.log(`✅ 마이그레이션된 채팅 ${newChats.length}개를 기존 채팅 목록에 추가`);
          } else {
            console.log('📝 마이그레이션할 새로운 채팅이 없습니다.');
          }
          
          // 마이그레이션된 가장 최근 채팅을 활성화
          if (result.migratedChats.length > 0) {
            const latestMigratedChat = result.migratedChats[0];
            const chatId = latestMigratedChat.chat_id;
            setActiveChatId(chatId);
            
            // 해당 채팅의 메시지 로드
            try {
              const messageResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}/messages`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (messageResponse.ok) {
                const messages = await messageResponse.json();
                setMessages(messages);
                console.log(`✅ 마이그레이션된 채팅 메시지 ${messages.length}개 로드 완료`);
              } else {
                console.log(`📝 마이그레이션된 채팅 메시지 없음: ${latestMigratedChat.chat_id}`);
                setMessages([]);
              }
            } catch (error) {
              console.error('❌ 마이그레이션된 채팅 메시지 로드 중 오류:', error);
              setMessages([]);
            }
          }
        }
        
        // 마이그레이션 성공 시에만 로컬스토리지에서 익명 채팅 데이터 삭제
        if (result.migratedCount > 0) {
          localStorage.removeItem('anonymous_chats');
          localStorage.removeItem('active_chat_id');
          console.log('✅ 익명 채팅 마이그레이션 성공 - 로컬 스토리지 데이터 삭제');
        } else {
          console.log('📝 마이그레이션할 채팅이 없어서 익명 채팅 데이터 유지');
        }
        
        console.log('✅ 익명 채팅 마이그레이션 완료 및 기존 채팅과 통합');
      } else {
        console.error('❌ 익명 채팅 마이그레이션 실패:', response.statusText);
        // 마이그레이션 실패 시 익명 채팅 데이터는 유지 (로그아웃 후 복원을 위해)
        console.log('📝 마이그레이션 실패로 익명 채팅 데이터 유지');
      }
    } catch (error) {
      console.error('❌ 익명 채팅 마이그레이션 중 오류:', error);
    }
  }, [setChats, setActiveChatId]);

  // 🔐 OAuth 콜백 처리
  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        console.log('🔐 OAuth 콜백에서 토큰 수신:', {
          hasToken: !!token,
          tokenLength: token.length,
          tokenStart: `${token.substring(0, 20)  }...`
        });
        
        // 토큰을 로컬 스토리지에 저장
        localStorage.setItem('token', token);
        
        // URL에서 토큰 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // 인증 상태 재확인
        checkAuthStatus();
        
        console.log('✅ OAuth 콜백 처리 완료 - 토큰 저장 및 인증 상태 업데이트');
      }
    };
    
    // 컴포넌트 마운트 시 OAuth 콜백 처리
    handleOAuthCallback();
  }, [checkAuthStatus]);

  // 🔄 앱 초기화
  const initialize = useCallback(async () => {
    console.log('🚀 앱 초기화 시작...');
    
    try {
      // 성능 모니터링 시작
      const endRenderMeasure = performanceService.measureRenderTime('App Initialization');
      
      // 토큰 존재 여부 먼저 확인
      const token = localStorage.getItem('token');
      console.log('🔍 초기화 시 토큰 확인:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenStart: token ? `${token.substring(0, 20)  }...` : '없음'
      });
      
      // 인증 상태 확인
      await checkAuthStatus();
      
      // 데이터 동기화 서비스 초기화 (인증된 사용자만)
      if (isAuthenticated) {
        dataSyncService.startAutoSync();
      }
      
      // 로컬 스토리지 동기화 (인증되지 않은 사용자만)
      if (!isAuthenticated) {
        syncWithLocalStorage(false);
      }
      
      // 채팅 목록 로드
      if (isAuthenticated && user?.user_id) {
        console.log('🔍 인증된 사용자 채팅 목록 로드 시작...');
        try {
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const token = localStorage.getItem('token');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(`${baseUrl}/api/chats`, {
            method: 'GET',
            headers: headers,
          });
          
          console.log('🔍 채팅 목록 API 응답:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          if (response.ok) {
            const chatsData = await response.json();
            console.log('🔍 채팅 목록 API 응답 데이터:', chatsData);
            
            // 백엔드 응답 구조에 맞게 수정
            let chatArray: any[] = [];
            if (chatsData.success && Array.isArray(chatsData.data)) {
              chatArray = chatsData.data;
              console.log('🔍 백엔드 응답에서 data 배열 추출:', chatArray);
            } else if (Array.isArray(chatsData)) {
              chatArray = chatsData;
              console.log('🔍 직접 배열 응답 사용:', chatArray);
            } else {
              console.warn('⚠️ 예상하지 못한 응답 구조:', chatsData);
              chatArray = [];
            }
            
            console.log('🔍 최종 chatArray:', {
              length: chatArray.length,
              firstChat: chatArray[0],
              chatFields: chatArray[0] ? Object.keys(chatArray[0]) : []
            });
            
            setChats(chatArray);
            console.log(`✅ 인증된 사용자 채팅 목록 로드 완료: ${chatArray.length}개 채팅`);
            
            // 🚨 자동으로 최신 채팅방 선택 및 메시지 로드
            if (chatArray.length > 0) {
              // updated_at 기준으로 최신 채팅방 찾기 (배열 복사 후 정렬)
              const sortedChats = [...chatArray].sort((a, b) => 
                new Date(b.updated_at || b.updatedAt || 0).getTime() - 
                new Date(a.updated_at || a.updatedAt || 0).getTime()
              );
              const mostRecentChat = sortedChats[0];
              
              console.log('🎯 자동 최신 채팅방 선택:', {
                chatId: mostRecentChat.chat_id,
                title: mostRecentChat.title,
                updatedAt: mostRecentChat.updated_at || mostRecentChat.updatedAt
              });
              
              // 최신 채팅방 자동 선택
              setActiveChatId(mostRecentChat.chat_id);
              
              // 최신 채팅방의 메시지 자동 로드
              try {
                const messagesResponse = await fetch(`${baseUrl}/api/chats/${mostRecentChat.chat_id}/messages`, {
                  method: 'GET',
                  headers: headers,
                });
                
                if (messagesResponse.ok) {
                  const messagesData = await messagesResponse.json();
                  const messages = messagesData.data || messagesData;
                  const messageArray = Array.isArray(messages) ? messages : [];
                  
                  console.log('🔍 최신 채팅방 메시지 자동 로드:', {
                    chatId: mostRecentChat.chat_id,
                    messageCount: messageArray.length,
                    firstMessage: messageArray[0]
                  });
                  
                  setMessages(messageArray);
                  console.log('✅ 최신 채팅방 메시지 자동 로드 완료');
                } else {
                  console.warn('⚠️ 최신 채팅방 메시지 로드 실패:', messagesResponse.status);
                  setMessages([]);
                }
              } catch (error) {
                console.error('❌ 최신 채팅방 메시지 로드 실패:', error);
                setMessages([]);
              }
            }
          } else {
            console.warn('⚠️ 서버에서 채팅 목록 로드 실패:', response.status);
            // 실패해도 빈 배열로 설정
            setChats([]);
          }
        } catch (error) {
          console.error('❌ 채팅 목록 로드 실패:', error);
          setChats([]);
        }
      } else {
        console.log('🔍 익명 사용자 로컬 채팅 로드...');
        // 익명 사용자는 로컬 스토리지에서 채팅 로드
        const localChats = localStorage.getItem('anonymous_chats');
        let parsedChats: any[] = [];
        
        if (localChats) {
          try {
            parsedChats = JSON.parse(localChats);
            setChats(parsedChats);
            console.log(`✅ 익명 사용자 로컬 채팅 로드 완료: ${parsedChats.length}개 채팅`);
          } catch (error) {
            console.error('❌ 로컬 채팅 파싱 실패:', error);
            setChats([]);
          }
        } else {
          setChats([]);
          console.log('📝 로컬 채팅 없음, 빈 배열로 설정');
        }
        
        // 🚨 익명 사용자도 최신 채팅방 자동 선택
        if (parsedChats && parsedChats.length > 0) {
          // updated_at 기준으로 최신 채팅방 찾기 (배열 복사 후 정렬)
          const sortedChats = [...parsedChats].sort((a, b) => 
            new Date(b.updated_at || b.updatedAt || 0).getTime() - 
            new Date(a.updated_at || a.updatedAt || 0).getTime()
          );
          const mostRecentChat = sortedChats[0];
          
          console.log('🎯 익명 사용자 자동 최신 채팅방 선택:', {
            chatId: mostRecentChat.chat_id,
            title: mostRecentChat.title,
            updatedAt: mostRecentChat.updated_at || mostRecentChat.updatedAt
          });
          
          // 최신 채팅방 자동 선택
          setActiveChatId(mostRecentChat.chat_id);
          
          // 최신 채팅방의 메시지 자동 로드 (로컬 스토리지에서)
          try {
            // 익명 사용자 메시지 키: anonymous_chat_messages_${chatId}
            const localMessages = localStorage.getItem(`anonymous_chat_messages_${mostRecentChat.chat_id}`);
            if (localMessages) {
              const messageArray = JSON.parse(localMessages);
              console.log('🔍 익명 사용자 최신 채팅방 메시지 자동 로드:', {
                chatId: mostRecentChat.chat_id,
                messageCount: messageArray.length,
                firstMessage: messageArray[0]
              });
              
              setMessages(messageArray);
              console.log('✅ 익명 사용자 최신 채팅방 메시지 자동 로드 완료');
            } else {
              // 메시지가 없으면 빈 배열로 설정
              setMessages([]);
              console.log('📝 익명 사용자 최신 채팅방 메시지 없음 - 새 채팅 시작');
            }
          } catch (error) {
            console.error('❌ 익명 사용자 최신 채팅방 메시지 로드 실패:', error);
            setMessages([]);
          }
        }
      }
      
      setInitialized(true);
      endRenderMeasure();
      
      // 성능 리포트 생성 (개발 모드에서만)
      if (import.meta.env.DEV) {
        const performanceReport = performanceService.generatePerformanceReport();
        console.log('📊 성능 리포트:', performanceReport);
      }
      
    } catch (error) {
      console.error('❌ 앱 초기화 실패:', error);
      setAuthError('앱 초기화에 실패했습니다.');
      
      // 에러 로깅
      errorHandler.logError({
        code: 'APP_INIT_ERROR',
        message: '앱 초기화 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: true,
        severity: 'HIGH'
      });
    }
  }, [checkAuthStatus, isAuthenticated, syncWithLocalStorage, setInitialized, setAuthError]);

  // 🎯 채팅 관련 함수들
  const selectChat = useCallback(async (chatId: string) => {
    console.log('🎯 selectChat 함수 호출됨:', chatId);
    console.log('🔍 현재 상태:', {
      activeChatId,
      isLoadingMessages,
      chatId,
      chatsLength: chats.length
    });
    
    // 이미 선택된 채팅이면 중복 처리 방지
    if (activeChatId === chatId) {
      console.log('⚠️ 이미 선택된 채팅방입니다:', chatId);
      return;
    }
    
    // 이미 로딩 중이면 중복 요청 방지 (일시적으로 주석 처리)
    // if (isLoadingMessages) {
    //   console.log('⚠️ 메시지 로딩 중입니다. 중복 요청 방지:', chatId);
    //   return;
    // }
    
    // 채팅 ID 설정
    setActiveChatId(chatId);
    setChatError(null);
    
    // 🚨 로딩 상태 표시 제거 - 기존 메시지 보존
    // 로딩 상태만 설정 (메시지는 덮어쓰지 않음)
    setLoadingMessages(true);
    console.log('🔄 채팅방 선택 - 메시지 로딩 시작 (기존 메시지 보존)');
    

    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && isAuthenticated) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const commonHeaders = headers;
      
      // 익명 채팅인지 확인
      const isAnonymousChatId = isAnonymousChat(chatId);
      
      if (isAnonymousChatId) {
        // 익명 채팅: 로컬 스토리지 우선 확인, 없으면 백엔드 API 호출
        console.log(`📱 익명 채팅 메시지 로드: ${chatId}`);
        
        // 1. 로컬 스토리지에서 메시지 확인
        const localMessages = localStorage.getItem(`anonymous_chat_messages_${chatId}`);
        if (localMessages) {
          try {
            const messageArray = JSON.parse(localMessages);
            console.log('🔍 로컬 스토리지에서 익명 채팅 메시지 로드:', {
              chatId,
              messageCount: messageArray.length,
              firstMessage: messageArray[0]
            });
            
            setMessages(messageArray);
            console.log(`✅ 익명 채팅 로컬 메시지 로드 완료: ${chatId} (${messageArray.length}개 메시지)`);
            setLoadingMessages(false);
            return; // 로컬에서 로드했으면 API 호출 건너뜀
          } catch (error) {
            console.error('❌ 로컬 메시지 파싱 실패:', error);
            // 파싱 실패 시 백엔드 API 호출
          }
        }
        
        // 2. 로컬에 없으면 백엔드 API 호출
        try {
          const response = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
            method: 'GET',
            headers: commonHeaders,
          });
          
          console.log(`📊 익명 채팅 백엔드 응답 상태: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const responseData = await response.json();
            const messages = responseData.data || responseData;
            const messageArray = Array.isArray(messages) ? messages : [];
            
            // 백엔드에서 받은 메시지를 로컬에도 저장
            if (messageArray.length > 0) {
              localStorage.setItem(`anonymous_chat_messages_${chatId}`, JSON.stringify(messageArray));
              console.log('💾 익명 채팅 메시지를 로컬에 저장 완료');
            }
            
            setMessages(messageArray);
            console.log(`✅ 익명 채팅 백엔드 메시지 로드 완료: ${chatId} (${messageArray.length}개 메시지)`);
          } else if (response.status === 404) {
            console.log(`📝 익명 채팅이 존재하지 않음: ${chatId}, 빈 메시지로 설정`);
            setMessages([]);
          } else {
            console.log(`⚠️ 익명 채팅 백엔드 로드 실패: ${response.status} ${response.statusText}`);
            setMessages([]);
          }
        } catch (error) {
          console.error(`❌ 익명 채팅 백엔드 로드 실패: ${chatId}`, error);
          setMessages([]);
        }
      } else {
        // 인증된 사용자 채팅: 백엔드에서 메시지 로드
        console.log(`🔐 인증된 사용자 채팅 메시지 로드: ${chatId}`);
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}/messages`, {
          headers
        });
        
        if (response.ok) {
          const responseData = await response.json();
          console.log('🔍 사용자 채팅 응답 데이터:', responseData);
          const messages = responseData.data || responseData; // 백엔드 응답 구조 처리
          const messageArray = Array.isArray(messages) ? messages : [];
          
          // 🚨 메시지 데이터 구조 상세 로깅
          console.log('📊 메시지 데이터 구조 분석:', {
            responseData,
            messages,
            messageArray,
            firstMessage: messageArray[0],
            messageFields: messageArray[0] ? Object.keys(messageArray[0]) : [],
            expectedFields: ['message_id', 'text', 'sender', 'timestamp']
          });
          
          // 메시지를 직접 설정하여 UI 업데이트
          setMessages(messageArray);
          console.log(`✅ 사용자 채팅 메시지 로드 완료: ${chatId} (${messageArray.length}개 메시지)`);
          
          // 메시지 상태 업데이트 완료
          console.log('🎯 사용자 채팅 메시지 업데이트 완료');
        } else if (response.status === 404) {
          console.log(`📝 사용자 채팅이 존재하지 않음: ${chatId}, 빈 메시지로 설정`);
          setMessages([]);
        } else {
          console.error(`❌ 사용자 채팅 메시지 로드 실패: ${response.status}`);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('❌ 채팅 선택 실패:', error);
      setChatError('채팅을 불러오는데 실패했습니다.');
      setMessages([]);
      
      // 에러 로깅
      errorHandler.logError({
        code: 'CHAT_SELECT_ERROR',
        message: '채팅 선택 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: true,
        severity: 'MEDIUM'
      });
    } finally {
      // 로딩 상태 항상 해제
      setLoadingMessages(false);
      console.log('🔄 채팅방 선택 - 로딩 상태 해제');
    }
  }, [activeChatId, setChatError, isAuthenticated, setLoadingMessages]);

  // 🗑️ 채팅 삭제 함수
  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!confirm('정말 이 대화를 삭제하시겠습니까?')) return;
    
    try {
      // 익명 채팅인지 확인
      const isAnonymousChatId = isAnonymousChat(chatId);
      
      if (isAnonymousChatId) {
        // 익명 채팅: 백엔드와 로컬 스토리지에서 모두 삭제
        console.log(`🗑️ 익명 채팅 삭제: ${chatId}`);
        
        // 백엔드에서 익명 채팅 삭제
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            console.warn(`⚠️ 백엔드 익명 채팅 삭제 실패: ${response.status}`);
          } else {
            console.log(`✅ 백엔드 익명 채팅 삭제 완료: ${chatId}`);
          }
        } catch (backendError) {
          console.warn(`⚠️ 백엔드 익명 채팅 삭제 중 오류:`, backendError);
        }
        
        // 로컬 스토리지에서 채팅 목록 업데이트
        const existingChats = JSON.parse(localStorage.getItem('anonymous_chats') || '[]');
        const updatedChats = existingChats.filter((chat: any) => chat.chat_id !== chatId);
        localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
        
        // 채팅 메시지도 삭제
        localStorage.removeItem(`chat_messages_${chatId}`);
        localStorage.removeItem(`anonymous_chat_messages_${chatId}`);
        localStorage.removeItem(`anonymous_chat_title_${chatId}`);
        
        // 삭제된 채팅이 현재 활성 채팅인 경우 처리
        if (activeChatId === chatId) {
          setActiveChatId(null);
          localStorage.removeItem('active_chat_id');
        }
        
        // 채팅 목록에서 제거
        const currentChats = useChatStore.getState().chats;
        setChats(currentChats.filter((chat) => chat.chat_id !== chatId));
        
        console.log(`✅ 익명 채팅 삭제 완료: ${chatId}`);
      } else {
        // 인증된 사용자 채팅: 백엔드에서 삭제
        console.log(`🗑️ 사용자 채팅 삭제: ${chatId}`);
        
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token && isAuthenticated) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await performanceService.measureApiCall(() =>
          handleApiCall(
            () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}`, {
              method: 'DELETE',
              headers
            }),
            'deleteChat'
          )
        );
        
        await handleResponse(response, 'deleteChat');
        
        // 삭제된 채팅이 현재 활성 채팅인 경우 처리
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
        
        // 채팅 목록에서 제거
        const currentChats = useChatStore.getState().chats;
        setChats(currentChats.filter((chat) => chat.chat_id !== chatId));
        
        console.log(`✅ 사용자 채팅 삭제 완료: ${chatId}`);
      }
    } catch (error) {
      console.error('❌ 채팅 삭제 실패:', error);
      setChatError('채팅 삭제에 실패했습니다.');
      
      // 에러 로깅
      errorHandler.logError({
        code: 'CHAT_DELETE_ERROR',
        message: '채팅 삭제 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: true,
        severity: 'MEDIUM'
      });
    }
  }, [activeChatId, setActiveChatId, setMessages, setChats, setChatError, isAuthenticated]);

  // 📝 새 채팅 생성 함수
  const handleCreateNewChat = useCallback(async () => {
    console.log('🚀 handleCreateNewChat 시작!');
    console.log('🔍 isLoading 상태:', isLoading);
    console.log('🔍 authLoading:', authLoading);
    console.log('🔍 setChatsLoading:', setChatsLoading);
    console.log('🔍 setLoadingMessages:', setLoadingMessages);
    console.log('🔍 globalLoading:', globalLoading);
    
    if (isLoading) {
      console.log('❌ isLoading이 true라서 함수 종료');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let newChat: any;
      if (isAuthenticated) {
        // 인증된 사용자: 백엔드에서 생성
        const response = await performanceService.measureApiCall(() =>
          handleApiCall(
            () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ title: '새 대화' })
            }),
            'createNewChat'
          )
        );
        
        newChat = await handleResponse(response, 'createNewChat');
      } else {
        // 익명 사용자: 백엔드에서 생성 (temp_ 접두사로 자동 생성)
        const response = await performanceService.measureApiCall(() =>
          handleApiCall(
            () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ title: '새 대화' })
            }),
            'createNewChat'
          )
        );
        
        newChat = await handleResponse(response, 'createNewChat');
        console.log('✅ 백엔드에서 익명 채팅 생성 완료:', newChat);
      }

      // 새 채팅을 목록 맨 앞에 추가하고 즉시 전환
      const currentChats = useChatStore.getState().chats;
      
      // 백엔드 응답을 프론트엔드 타입에 맞게 변환 (chat_id 사용)
      console.log('🔍 백엔드 응답 확인:', newChat);
      const chatData = newChat.data || newChat; // 백엔드 응답 구조 처리
      const chatId = chatData.chat_id || `temp_${Date.now()}`;
      
      // 중복 채팅 방지: 이미 존재하는 채팅인지 확인
      const existingChat = currentChats.find(chat => chat.chat_id === chatId);
      if (existingChat) {
        console.log(`⚠️ 중복 채팅 감지, 기존 채팅 사용: ${chatId}`);
        setActiveChatId(chatId);
        return;
      }
      
      const normalizedChat = {
        chat_id: chatId,
        title: chatData.title || '새 대화',
        created_at: chatData.created_at || new Date().toISOString(),
        updated_at: chatData.updated_at || new Date().toISOString(),
        messages: []
      };
      
      // 중복 체크: 이미 같은 chat_id의 채팅이 있는지 확인
      const existingChatIndex = currentChats.findIndex(chat => chat.chat_id === chatId);
      if (existingChatIndex >= 0) {
        // 기존 채팅이 있으면 교체
        const updatedChats = [...currentChats];
        updatedChats[existingChatIndex] = normalizedChat;
        setChats(updatedChats);
      } else {
        // 새 채팅 추가
        setChats([normalizedChat, ...currentChats]);
      }
      
      // 새 채팅을 자동으로 선택하고 활성화
      setActiveChatId(chatId);
      setMessages([]); // 빈 메시지 배열로 초기화 (스트리밍 상태도 자동으로 초기화됨)
      
      // 익명 사용자의 경우 로컬 스토리지에도 저장
      if (!isAuthenticated) {
        localStorage.setItem('active_chat_id', chatId);
      }

      console.log('✅ 새 채팅 생성 완료:', chatId);
      console.log('📋 정규화된 채팅 객체:', normalizedChat);
    } catch (error) {
      console.error('❌ 새 채팅 생성 실패:', error);
      setChatError('새 채팅을 생성할 수 없습니다.');
      
      // 에러 로깅
      errorHandler.logError({
        code: 'NEW_CHAT_ERROR',
        message: '새 채팅 생성 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: true,
        severity: 'MEDIUM'
      });
    }
  }, [isLoading, setActiveChatId, setChats, setMessages, setChatError, isAuthenticated]);

  // ✏️ 채팅 제목 수정 함수
  const handleUpdateChatTitle = useCallback(async (chatId: string, newTitle: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (isAuthenticated) {
        // 인증된 사용자: 백엔드에서 수정
        const response = await performanceService.measureApiCall(() =>
          handleApiCall(
            () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chats/${chatId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ title: newTitle })
            }),
            'updateChatTitle'
          )
        );
        
        await handleResponse(response, 'updateChatTitle');
      } else {
        // 익명 사용자: 로컬 스토리지에서 수정
        const existingChats = JSON.parse(localStorage.getItem('anonymous_chats') || '[]');
        const updatedChats = existingChats.map((chat: any) => 
          chat.chat_id === chatId ? { ...chat, title: newTitle } : chat
        );
        localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
      }

      // 상태 업데이트
      const currentChats = useChatStore.getState().chats;
      const updatedChats = currentChats.map((chat: any) => 
        chat.chat_id === chatId ? { ...chat, title: newTitle } : chat
      );
      setChats(updatedChats);

      console.log(`✅ 채팅 제목 수정 완료: ${chatId} -> ${newTitle}`);
    } catch (error) {
      console.error('❌ 채팅 제목 수정 실패:', error);
      setChatError('채팅 제목 수정에 실패했습니다.');
      
      // 에러 로깅
      errorHandler.logError({
        code: 'CHAT_TITLE_UPDATE_ERROR',
        message: '채팅 제목 수정 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: true,
        severity: 'LOW'
      });
    }
  }, [setChats, setChatError, isAuthenticated]);

  // 스트리밍 데이터 처리 함수
  const handleStreamingData = useCallback((data: any) => {
    console.log('🔍 handleStreamingData 호출됨:', { 
      data, 
      activeChatId: activeChat?.chat_id,
      currentTime: new Date().toISOString(),
      dataType: data.type 
    });
    
    // 스트리밍 데이터의 채팅방 ID 확인
    const streamingChatId = data.message?.chat_id || activeChat?.chat_id;
    console.log('🎯 스트리밍 채팅 ID:', streamingChatId);
    
    // 해당 채팅방이 존재하는지 확인
    const currentChats = useChatStore.getState().chats;
    const targetChat = currentChats.find(chat => chat.chat_id === streamingChatId);
    
    if (!targetChat) {
      console.log(`⚠️ 스트리밍 데이터 무시: 채팅방을 찾을 수 없음 (${streamingChatId})`);
      console.log('📋 현재 채팅 목록:', currentChats.map(c => ({ chat_id: c.chat_id, title: c.title })));
      return;
    }
    
    console.log('✅ 대상 채팅방 찾음:', targetChat.chat_id, targetChat.title);
    console.log('📊 현재 메시지 수:', targetChat.messages?.length || 0);
    
    if (data.type === 'streaming') {
      const paragraphIndex = data.paragraphIndex || 'unknown';
      const streamingId = `streaming-${paragraphIndex}-${streamingChatId}`;
      console.log('📤 스트리밍 메시지 처리:', { streamingId, paragraphIndex: data.paragraphIndex, fallbackIndex: paragraphIndex });
      
      // 기존 메시지를 보존하면서 스트리밍 메시지만 업데이트 (중요: 사용자 메시지는 항상 보존)
      const currentMessages = targetChat.messages || [];
      
      // 1. 🚨 기존 메시지는 모두 보존하고 로딩 중인 메시지만 제거 (더 안전한 방식)
      const messagesWithoutLoading = currentMessages.filter((msg: any) => {
        // 사용자 메시지는 절대 제거하지 않음
        if (msg.sender === 'user') {
          return true;
        }
        // AI 메시지 중에서 로딩 상태이면서 임시 ID인 것만 제거
        if (msg.isLoading && msg.message_id && msg.message_id.startsWith('loading-')) {
          return false;
        }
        // 나머지 모든 메시지는 보존
        return true;
      });
      
      console.log('🔍 스트리밍 중 기존 메시지 보존:', {
        원본메시지수: currentMessages.length,
        보존된메시지수: messagesWithoutLoading.length,
        보존된메시지: messagesWithoutLoading.map(m => ({ 
          sender: m.sender, 
          text: m.text?.substring(0, 30),
          isStreaming: m.isStreaming,
          isLoading: m.isLoading
        }))
      });
      
      // 2. 스트리밍 메시지 찾기
      const existingIndex = messagesWithoutLoading.findIndex((msg: any) => msg.message_id === streamingId);
      
      let updatedMessages;
      if (existingIndex >= 0) {
        // 기존 스트리밍 메시지 업데이트
        updatedMessages = [...messagesWithoutLoading];
        updatedMessages[existingIndex] = { ...updatedMessages[existingIndex], text: data.message.text, isStreaming: true };
        console.log('🔄 기존 스트리밍 메시지 업데이트');
      } else {
        // 새 스트리밍 메시지 추가 (기존 메시지 뒤에)
        const newStreamingMessage = {
          ...data.message,
          message_id: streamingId,  // 🚨 id → message_id로 수정
          isStreaming: true,
          sender: 'model'  // 🚨 sender 명시적 설정
        };
        updatedMessages = [...messagesWithoutLoading, newStreamingMessage];
        console.log('➕ 새 스트리밍 메시지 추가:', newStreamingMessage);
      }
      
      console.log('📝 업데이트된 메시지 수:', updatedMessages.length);
      console.log('📊 보존된 기존 메시지 수:', messagesWithoutLoading.length);
      console.log('👥 보존된 메시지 타입:', messagesWithoutLoading.map(m => ({ sender: m.sender, text: `${m.text?.substring(0, 20)  }...` })));
      
      // 특정 채팅의 메시지만 업데이트
      console.log('🔄 updateChat 호출 시작:', { chatId: streamingChatId, messageCount: updatedMessages.length });
      updateChat(streamingChatId, { messages: updatedMessages });
      console.log('✅ 채팅 메시지 업데이트 완료:', updatedMessages.length);
      
      // 🚨 익명 채팅인 경우 개별 메시지 키에도 저장
      if (!isAuthenticated) {
        localStorage.setItem(`anonymous_chat_messages_${streamingChatId}`, JSON.stringify(updatedMessages));
        console.log('💾 익명 채팅 스트리밍 메시지를 개별 키에 저장 완료:', {
          chatId: streamingChatId,
          messageCount: updatedMessages.length
        });
      }
      
      // 🚨 현재 활성 채팅방이면 실시간 UI 업데이트 (단어 단위 스트리밍을 위해 setMessages 호출)
      if (useChatStore.getState().activeChatId === streamingChatId) {
        console.log('🎯 활성 채팅방 스트리밍 UI 업데이트 시작');
        
        // 🚨 메시지 배열 안전성 검증
        if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
          // 사용자 메시지가 보존되었는지 확인
          const userMessages = updatedMessages.filter(msg => msg.sender === 'user');
          console.log('🔍 스트리밍 중 사용자 메시지 보존 확인:', {
            총메시지수: updatedMessages.length,
            사용자메시지수: userMessages.length,
            사용자메시지: userMessages.map(m => ({ id: m.message_id, text: m.text?.substring(0, 30) }))
          });
          
          // 🚨 단어 단위 스트리밍을 위해 setMessages 호출 (실시간 UI 업데이트)
          setMessages(updatedMessages);
          console.log('✅ 활성 채팅방 스트리밍 UI 업데이트 완료 (setMessages 호출)');
        } else {
          console.log('⚠️ 업데이트할 메시지가 없음 - UI 업데이트 건너뜀');
        }
      } else {
        console.log('⚠️ 활성 채팅방이 아님 - 스트리밍 UI 업데이트 건너뜀');
      }
    } else if (data.type === 'paragraph' || data.type === 'followUp') {
      // 스트리밍 완료, 최종 메시지로 변환
      const paragraphIndex = data.paragraphIndex || 'unknown';
      const streamingId = `streaming-${paragraphIndex}-${streamingChatId}`;
      const paragraphId = `paragraph-${paragraphIndex}-${streamingChatId}-${Date.now()}`;
      console.log('📝 최종 메시지 변환:', { streamingId, paragraphId, type: data.type, paragraphIndex });
      
      // 기존 메시지를 보존하면서 새 메시지만 추가 (중요: 사용자 메시지는 항상 보존)
      const currentMessages = targetChat.messages || [];
      
      // 1. 🚨 스트리밍 중인 메시지와 로딩 중인 메시지만 제거 (사용자 메시지와 완성된 AI 메시지는 보존)
      const filtered = currentMessages.filter((msg: any) => {
        // 사용자 메시지는 절대 제거하지 않음
        if (msg.sender === 'user') {
          return true;
        }
        // AI 메시지 중에서 스트리밍 ID와 일치하거나 로딩/스트리밍 상태인 것만 제거
        if (msg.message_id === streamingId || msg.isLoading || msg.isStreaming) {
          return false;
        }
        // 나머지 모든 메시지는 보존
        return true;
      });
      
      console.log('🔍 최종 메시지 업데이트 시 기존 메시지 보존:', {
        원본메시지수: currentMessages.length,
        보존된메시지수: filtered.length,
        보존된메시지: filtered.map(m => ({ 
          sender: m.sender, 
          text: m.text?.substring(0, 30),
          message_id: m.message_id
        })),
        제거된메시지: currentMessages.filter(m => !filtered.includes(m)).map(m => ({
          sender: m.sender,
          text: m.text?.substring(0, 30),
          reason: m.message_id === streamingId ? 'streamingId' : m.isLoading ? 'loading' : m.isStreaming ? 'streaming' : 'other'
        }))
      });
      
      // 2. 새 메시지 추가 (기존 메시지 뒤에)
      const updatedMessages = [...filtered, { ...data.message, message_id: paragraphId, isStreaming: false }];
      
      console.log('📝 최종 메시지 업데이트:', { 
        기존메시지수: currentMessages.length, 
        필터링후: filtered.length, 
        최종메시지수: updatedMessages.length,
        보존된메시지: filtered.map(m => ({ 
          message_id: m.message_id, 
          sender: m.sender,
          text: `${m.text?.substring(0, 30)  }...` 
        })),
        제거된메시지: currentMessages.filter(m => !filtered.includes(m)).map(m => ({
          message_id: m.message_id,
          sender: m.sender,
          reason: m.message_id === streamingId ? 'streamingId' : m.isLoading ? 'loading' : m.isStreaming ? 'streaming' : 'other'
        }))
      });
      
      // 특정 채팅의 메시지만 업데이트
      console.log('🔄 최종 메시지 updateChat 호출 시작:', { chatId: streamingChatId, messageCount: updatedMessages.length });
      updateChat(streamingChatId, { messages: updatedMessages });
      console.log('✅ 최종 메시지 업데이트 완료:', updatedMessages.length);
      
      // 🚨 익명 채팅인 경우 개별 메시지 키에도 저장
      if (!isAuthenticated) {
        localStorage.setItem(`anonymous_chat_messages_${streamingChatId}`, JSON.stringify(updatedMessages));
        console.log('💾 익명 채팅 최종 메시지를 개별 키에 저장 완료:', {
          chatId: streamingChatId,
          messageCount: updatedMessages.length
        });
      }
      
      // 현재 활성 채팅방이면 전역 messages 상태도 업데이트
      if (useChatStore.getState().activeChatId === streamingChatId) {
        console.log('🎯 활성 채팅방 최종 메시지 상태 업데이트 시작');
        
        // 🚨 메시지 배열 안전성 검증
        if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
          // 사용자 메시지가 보존되었는지 확인
          const userMessages = updatedMessages.filter(msg => msg.sender === 'user');
          console.log('🔍 최종 메시지 업데이트 시 사용자 메시지 보존 확인:', {
            총메시지수: updatedMessages.length,
            사용자메시지수: userMessages.length,
            사용자메시지: userMessages.map(m => ({ id: m.message_id, text: m.text?.substring(0, 30) }))
          });
          
          // 🚨 전역 messages 상태도 업데이트해야 ChatInterface에 표시됨
          setMessages(updatedMessages);
          console.log('✅ 활성 채팅방 최종 메시지 상태 업데이트 완료 (setMessages 호출)');
        } else {
          console.log('⚠️ 업데이트할 메시지가 없음 - 최종 메시지 상태 업데이트 건너뜀');
        }
      } else {
        console.log('⚠️ 활성 채팅방이 아님 - 최종 메시지 상태 업데이트 건너뜀');
      }
    } else if (data.type === 'complete') {
      // 스트리밍 완료 신호
      console.log('✅ 스트리밍 완료');
    } else if (data.type === 'refresh') {
      // 메시지 새로고침 신호 - 불필요한 재로딩 방지
      console.log('🔄 메시지 새로고침 신호 수신 (재로딩 건너뜀)');
      // 백엔드에서 보내는 refresh 신호는 무시
      // 프론트엔드에서 이미 스트리밍으로 메시지를 업데이트했으므로 추가 로딩 불필요
    }
  }, [activeChat, setMessages, updateChat]);

  const sendMessage = useCallback(async (text: string) => {
    if (!activeChat || isSendingMessage) return;
    
    // 🚨 기존 메시지는 보존하고 스트리밍 상태만 초기화
    const currentMessages = useChatStore.getState().messages;
    const cleanedMessages = Array.isArray(currentMessages) 
      ? currentMessages.map(msg => ({
          ...msg,
          isStreaming: false,
          isLoading: false
        }))
      : [];
    
    // 🚨 기존 메시지를 보존하면서 스트리밍 상태만 업데이트
    setMessages(cleanedMessages);
    console.log('🔍 메시지 전송 시작 - 기존 메시지 보존:', {
      messageCount: cleanedMessages.length,
      messages: cleanedMessages.map(m => ({ sender: m.sender, text: m.text?.substring(0, 30) }))
    });
    
    setIsSendingMessage(true);
    let loadingInterval: NodeJS.Timeout | null = null;
    
    try {
      // 사전 확인: 인증된 사용자만 백엔드 확인
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const commonHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && isAuthenticated) {
        commonHeaders['Authorization'] = `Bearer ${token}`;
      }

      let ensuredChatId = activeChat.chat_id;
      
      // 인증된 사용자만 백엔드 확인
      if (isAuthenticated) {
        try {
          const ensureRes = await fetch(`${baseUrl}/api/chats/${ensuredChatId}`, { headers: commonHeaders });
          if (ensureRes.status === 404) {
            // 존재하지 않으면 새 채팅 생성
            const createRes = await fetch(`${baseUrl}/api/chats`, { method: 'POST', headers: commonHeaders });
            if (!createRes.ok) throw new Error('채팅 세션 자동 생성 실패');
            const created = await createRes.json();
            ensuredChatId = created.chat_id;
            // 상태 업데이트
            setActiveChatId(created.chat_id);
            const currentChats = useChatStore.getState().chats;
            setChats([created, ...currentChats]);
          }
        } catch (preErr) {
          // 확인 API 실패시에도 진행 (메시지 전송 중 404로 다시 처리됨)
        }
      }

    const userMessage: ChatMessage = {
        message_id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      sender: MessageSender.USER,
        timestamp: new Date().toISOString()
    };

    // 사용자 메시지 추가
      const currentMessages = useChatStore.getState().messages;
      const newMessages = [...(Array.isArray(currentMessages) ? currentMessages : []), userMessage];
      // 🚨 updateChat과 setMessages 모두 호출해야 함
      updateChat(activeChat.chat_id, { messages: newMessages });
      setMessages(newMessages); // 전역 messages 상태도 업데이트
      
      // 익명 사용자인 경우 로컬 스토리지에 저장
      if (!isAuthenticated) {
        const updatedChat = { ...activeChat, messages: newMessages };
        const currentChats = useChatStore.getState().chats;
        const updatedChats = currentChats.map(chat => 
            chat.chat_id === activeChat.chat_id ? updatedChat : chat
          );
          
        setChats(updatedChats);
        localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
        localStorage.setItem('active_chat_id', activeChat.chat_id);
        
        // 🚨 익명 채팅 메시지를 개별 키로도 저장 (selectChat에서 로딩용)
        localStorage.setItem(`anonymous_chat_messages_${activeChat.chat_id}`, JSON.stringify(newMessages));
        console.log('💾 익명 채팅 메시지를 개별 키에 저장 완료:', {
          chatId: activeChat.chat_id,
          messageCount: newMessages.length
        });
      }

      // AI 응답 대기 메시지 추가 (단계별 변화)
      const loadingId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const aiLoadingMessage: any = {
        message_id: loadingId,
        text: "질문을 분석하고 있어요...",
        sender: MessageSender.MODEL,
        timestamp: new Date().toISOString(),
        isLoading: true
      };
      
      // 🚨 현재 메시지 상태를 안전하게 가져와서 로딩 메시지 추가
      const currentMessagesWithLoading = useChatStore.getState().messages;
      console.log('🔍 로딩 메시지 추가 전 현재 메시지 상태:', {
        messageCount: Array.isArray(currentMessagesWithLoading) ? currentMessagesWithLoading.length : 0,
        messages: Array.isArray(currentMessagesWithLoading) ? currentMessagesWithLoading.map(m => ({ 
          id: m.message_id, 
          sender: m.sender, 
          text: m.text?.substring(0, 30) 
        })) : []
      });
      
      const newMessagesWithLoading = [...(Array.isArray(currentMessagesWithLoading) ? currentMessagesWithLoading : []), aiLoadingMessage];
      setMessages(newMessagesWithLoading);
      
      console.log('✅ 로딩 메시지 추가 완료:', {
        totalMessageCount: newMessagesWithLoading.length,
        loadingMessageId: loadingId
      });

      // 단계별 로딩 메시지 변화
      const loadingStages = [
        "질문을 분석하고 있어요...",
        "생각하고 있어요...", 
        "답변을 준비하고 있어요...",
        "거의 완료되었어요..."
      ];
      
      let stageIndex = 0;
      loadingInterval = setInterval(() => {
        stageIndex = (stageIndex + 1) % loadingStages.length;
        const currentMessages = useChatStore.getState().messages;
        
        // 🚨 메시지 상태를 안전하게 업데이트
        if (Array.isArray(currentMessages)) {
          const updatedMessages = currentMessages.map((msg: any) => 
            msg.message_id === loadingId
              ? { ...msg, text: loadingStages[stageIndex] }
              : msg
          );
          
          console.log('🔄 로딩 메시지 단계 업데이트:', {
            stage: loadingStages[stageIndex],
            totalMessages: updatedMessages.length,
            loadingMessageId: loadingId
          });
          
          setMessages(updatedMessages);
        }
      }, 1500); // 1.5초마다 메시지 변경

      // API 호출 (인증 상태에 따라 다르게 처리)
      let response;
      
      // 메시지 전송 시 원본 채팅방 ID 보존 (활성 채팅방 변경과 무관하게)
      const originalChatId = activeChat.chat_id;
      console.log(`📤 메시지 전송 시작 - 원본 채팅방: ${originalChatId}`);
      
      if (isAuthenticated) {
        // 인증된 사용자: 백엔드 API 호출
        const headers: Record<string, string> = { ...commonHeaders };
        response = await fetch(`${baseUrl}/api/chats/${ensuredChatId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: text.trim() }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            // 보호적 재시도: 새 채팅 생성 후 재전송
            const createRes = await fetch(`${baseUrl}/api/chats`, { method: 'POST', headers });
            if (!createRes.ok) throw new Error('새 채팅 생성 실패 (재시도)');
            const created = await createRes.json();
            setActiveChatId(created.chat_id);
            const currentChats = useChatStore.getState().chats;
            setChats([created, ...currentChats]);
            response = await fetch(`${baseUrl}/api/chats/${created.chat_id}/messages`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ message: text.trim() }),
            });
            if (!response.ok) {
              throw new Error(`메시지 전송 실패: ${response.statusText}`);
            }
          } else {
            throw new Error(`메시지 전송 실패: ${response.statusText}`);
          }
        }
            } else {
        // 익명 사용자: 백엔드 API 호출 (인증 없이)
        console.log('🔄 익명 사용자 메시지 처리 - 백엔드 API 호출');
        
        // 기존 익명 채팅이 있는지 확인
        const currentChats = useChatStore.getState().chats;
        const existingAnonymousChat = currentChats.find(chat => isAnonymousChat(chat.chat_id));
        
        let chatId: string;
        
        if (existingAnonymousChat) {
          // 기존 익명 채팅이 있으면 사용 (백엔드에 존재하는지 확인 필요)
          chatId = existingAnonymousChat.chat_id;
          console.log(`📱 기존 익명 채팅 사용: ${chatId}`);
          
          // 백엔드에서 해당 채팅이 존재하는지 확인
          try {
            const checkChatResponse = await fetch(`${baseUrl}/api/chats/${chatId}`, {
              method: 'GET',
              headers: commonHeaders,
            });
            
            if (!checkChatResponse.ok) {
              console.log(`⚠️ 백엔드에서 채팅을 찾을 수 없음: ${chatId}, 새로 생성합니다.`);
              // 기존 채팅을 목록에서 제거하고 새로 생성
              const updatedChats = currentChats.filter(chat => chat.chat_id !== chatId);
              setChats(updatedChats);
              throw new Error('Chat not found in backend');
            }
          } catch (error) {
            console.log(`🔄 백엔드 채팅 확인 실패, 새로 생성: ${chatId}`);
            // 새 채팅 생성 로직으로 진행
            throw error;
          }
        } else {
          // 새로운 익명 채팅 생성 (IP 기반으로 백엔드에서 자동 생성)
          const createChatResponse = await fetch(`${baseUrl}/api/chats`, {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ 
              title: '새 대화'
              // userId를 전달하지 않으면 백엔드에서 IP 기반으로 자동 생성
            }),
          });
          
          if (!createChatResponse.ok) {
            throw new Error(`익명 채팅 생성 실패: ${createChatResponse.statusText}`);
          }
          
          const createdChat = await createChatResponse.json();
          chatId = createdChat.chat_id;
          
          // 생성된 채팅을 프론트엔드 채팅 목록에 추가
          const normalizedChat = {
            chat_id: chatId,
            title: createdChat.title || '새 대화',
            created_at: createdChat.created_at || new Date().toISOString(),
            updated_at: createdChat.updated_at || new Date().toISOString(),
            messages: []
          };
          
          setChats([normalizedChat, ...currentChats]);
          setActiveChatId(chatId);
          
          console.log(`✅ 새 익명 채팅 생성 및 활성화: ${chatId}`);
        }
        
        // 생성된 채팅으로 메시지 전송
        response = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({ message: text.trim() }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`⚠️ 채팅을 찾을 수 없음: ${chatId}, 새로 생성합니다.`);
            // 기존 채팅을 목록에서 제거
            const updatedChats = currentChats.filter(chat => chat.chat_id !== chatId);
            setChats(updatedChats);
            
            // 새 채팅 생성
            const createChatResponse = await fetch(`${baseUrl}/api/chats`, {
              method: 'POST',
              headers: commonHeaders,
              body: JSON.stringify({ 
                title: '새 대화',
                userId: null
              }),
            });
            
            if (!createChatResponse.ok) {
              throw new Error(`익명 채팅 생성 실패: ${createChatResponse.statusText}`);
            }
            
            const createdChat = await createChatResponse.json();
            const newChatId = createdChat.chat_id;
            
            // 새 채팅을 목록에 추가
            const normalizedChat = {
              chat_id: newChatId,
              title: createdChat.title || '새 대화',
              created_at: createdChat.created_at || new Date().toISOString(),
              updated_at: createdChat.updated_at || new Date().toISOString(),
              messages: []
            };
            
            setChats([normalizedChat, ...updatedChats]);
            setActiveChatId(newChatId);
            
            // 새 채팅으로 메시지 전송
            response = await fetch(`${baseUrl}/api/chats/${newChatId}/messages`, {
              method: 'POST',
              headers: commonHeaders,
              body: JSON.stringify({ message: text.trim() }),
            });
            
            if (!response.ok) {
              throw new Error(`익명 사용자 메시지 전송 실패: ${response.statusText}`);
            }
          } else {
            throw new Error(`익명 사용자 메시지 전송 실패: ${response.statusText}`);
          }
        }
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      // 스트리밍 시작 시 로딩 interval 정리
      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }

      // 첫 메시지인 경우 채팅방 제목 업데이트
      const isFirstMessage = useChatStore.getState().messages.filter(msg => msg.sender === MessageSender.USER).length === 1;
      if (isFirstMessage && activeChat) {
        const newTitle = text.trim().length > 12 ? `${text.trim().substring(0, 12)  }...` : text.trim();
        const updatedChat = { ...activeChat, title: newTitle };
        const currentChats = useChatStore.getState().chats;
        const updatedChats = currentChats.map(chat => 
          chat.chat_id === activeChat.chat_id ? updatedChat : chat
        );
        setChats(updatedChats);
        
        // 익명 사용자인 경우 로컬 스토리지도 업데이트
        if (!isAuthenticated) {
          localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
        }
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관

        for (const line of lines) {
          if (line.toLowerCase().startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamingData(data);
            } catch (error) {
              console.error('Failed to parse streaming data:', error);
            }
          }
        }
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError('메시지 전송에 실패했습니다.');
      
      // 에러 메시지로 업데이트
      const currentMessages = useChatStore.getState().messages;
      const updatedMessages = currentMessages.map(msg => 
        msg.isLoading ? { ...msg, text: '메시지 전송에 실패했습니다.', isLoading: false, error: 'send_failed' } : msg
      );
      // 🚨 setMessages 대신 updateChat 사용
      updateChat(activeChat.chat_id, { messages: updatedMessages });
    } finally {
      // 로딩 interval 정리
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      setIsSendingMessage(false);
    }
  }, [activeChat, isSendingMessage, isAuthenticated, setChats, setChatError, updateChat]);

  const [userQuery, setUserQuery] = useState('');

  const handleSend = useCallback(() => {
    if (!userQuery.trim() || isSendingMessage) return;
    sendMessage(userQuery);
    setUserQuery('');
  }, [userQuery, isSendingMessage, sendMessage]);

  const handleLogout = useCallback(() => {
    logout();
    setActiveChatId(null);
    // 🚨 setMessages 호출 제거 - 로그아웃 시에는 채팅방 전체 초기화
    setChats([]);
    localStorage.removeItem('token');
    localStorage.removeItem('anonymous_chats');
    localStorage.removeItem('active_chat_id');
  }, [logout, setActiveChatId, setChats]);

  const handleProfileUpdate = useCallback((updatedUser: any) => {
    updateUser(updatedUser);
    setShowProfile(false);
  }, [updateUser, setShowProfile]);

  // 🔄 앱 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  // 🚨 초기화 후 가장 최근 채팅방 자동 선택
  useEffect(() => {
    console.log('🔍 채팅 자동 선택 useEffect 실행:', {
      isInitialized,
      isAuthenticated,
      chatsLength: chats.length,
      activeChatId,
      chats: chats.map(c => ({ chat_id: c.chat_id, title: c.title }))
    });
    
    if (isInitialized && isAuthenticated && chats.length > 0 && !activeChatId) {
      console.log('🔄 초기화 후 가장 최근 채팅방 자동 선택 시작...');
      
      // 가장 최근 채팅방 (updated_at 기준)
      const mostRecentChat = [...chats].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      
      console.log('🎯 가장 최근 채팅방 발견:', { 
        chatId: mostRecentChat.chat_id, 
        title: mostRecentChat.title,
        updatedAt: mostRecentChat.updated_at 
      });
      
      // 자동으로 채팅방 선택
      selectChat(mostRecentChat.chat_id);
      console.log('✅ 가장 최근 채팅방 자동 선택 완료');
    }
  }, [isInitialized, isAuthenticated, chats, activeChatId, selectChat]);

  // 에러 표시
  const dismissError = () => {
    setChatError(null);
    setAuthError(null);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">채권도시 챗봇 로딩 중...</h2>
          <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 관리자 페이지 체크
  if (window.location.pathname === '/admin') {
    return <AdminDashboard />;
  }

  return (
    <ErrorBoundary>
      <div className={`h-screen flex flex-col transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-slate-900 text-slate-100' 
          : 'bg-gray-50 text-gray-900'
      }`}>
        {/* 🏢 헤더 */}
                  <AppHeader
            projectTitle="채권도시 챗봇"
            chatTitle={activeChat?.title}
            user={isAuthenticated && user ? {
              name: user.name || user.email || '사용자',
              email: user.email || '',
              avatar: (user as any).picture
            } : undefined}
            onLogout={handleLogout}
            onProfileClick={() => setShowProfile(true)}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onLogin={handleGoogleLogin}
          />



        {/* ⚠️ 에러 메시지 */}
        {error && (
          <div className={`mx-4 mt-4 rounded-lg border shadow-soft transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-red-950/50 border-red-800/50 text-red-300' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`} role="alert" style={{ marginTop: '80px' }}>
            <div className="flex items-start justify-between gap-3 p-3">
              <span className="text-sm flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissError}
                className={`h-6 w-6 p-0 transition-colors ${
                  isDarkMode 
                    ? 'text-red-300 hover:text-red-200 hover:bg-red-900/30' 
                    : 'text-red-700 hover:text-red-800'
                }`}
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* 🎨 메인 레이아웃 */}
        <div className="flex-1 flex overflow-hidden relative" style={{ marginTop: '80px' }}>
          {/* 💬 사이드바 모달 */}
          <SidebarModal
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            width="lg"
          >
            <ChatSidebar
              chats={chats}
              activeChatId={activeChatId}
              onChatSelect={(chatId) => {
                console.log('🖱️ App.tsx에서 채팅 선택됨:', chatId);
                console.log('🔍 현재 chats 배열:', chats);
                console.log('🔍 chats 길이:', chats.length);
                selectChat(chatId);
                // 모달은 사용자가 직접 닫을 때까지 유지
              }}
              onNewChat={() => {
                handleCreateNewChat();
                // 모달은 사용자가 직접 닫을 때까지 유지
              }}
              onDeleteChat={handleDeleteChat}
              onUpdateChatTitle={handleUpdateChatTitle}
              isLoading={isLoadingChats}
              isDarkMode={isDarkMode}
            />
          </SidebarModal>

          {/* 📝 메인 채팅 영역 */}
          <div className={`flex flex-col overflow-hidden w-full transition-colors duration-200 ${
            isDarkMode ? 'bg-slate-800' : 'bg-white'
          }`}>
          {activeChat ? (
            <>
              <ChatInterface
                messages={Array.isArray(messages) ? messages : []}
                onSendMessage={sendMessage}
                isDarkMode={isDarkMode}
              />

            </>
          ) : (
              <div className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-8 ${
                isDarkMode ? 'bg-gray-900' : 'bg-white'
              }`}>
                <div className="text-center w-full max-w-md px-4">
                  {/* 심플한 로고/아이콘 */}
                  <div className="mb-8">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto ${
                      isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <MessageCircle className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                  </div>

                  {/* 심플한 제목과 설명 */}
                  <h2 className={`text-xl sm:text-2xl font-semibold mb-3 text-center ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    채권도시 챗봇에 오신 것을 환영합니다!
                  </h2>
                  <p className={`text-sm sm:text-base mb-6 text-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    새로운 대화를 시작하거나 기존 대화를 이어가세요.
                  </p>

                  {/* 새 대화 시작 버튼 */}
                  <Button
                    onClick={handleCreateNewChat}
                    className="w-full sm:w-auto px-6 py-3 text-base"
                    disabled={isSendingMessage}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    새 대화 시작하기
                  </Button>
                </div>
              </div>
          )}

          {/* 📝 입력창 (화면 하단 고정) - 채팅 중일 때만 표시 */}
          {activeChat && (
            <div className={`border-t flex-shrink-0 transition-colors duration-200 ${
              isDarkMode 
                ? 'border-slate-600 bg-slate-700' 
                : 'border-border bg-background'
            }`}>
              <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full">
                <div className="flex gap-2 sm:gap-3 items-end">
                  <div className="flex-1">
                    <label htmlFor="message-input" className="sr-only">
                      메시지 입력
                    </label>
                    <textarea
                      id="message-input"
                      name="message"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="무엇이든 물어보세요..."
                      className={
                        "w-full px-3 py-2.5 border border-input rounded-lg " +
                        "text-sm bg-background text-foreground " +
                        "placeholder:text-muted-foreground " +
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 " +
                        "disabled:opacity-50 disabled:cursor-not-allowed " +
                        "transition-colors resize-none max-h-32"
                      }
                      rows={1}
                      disabled={isSendingMessage}
                      aria-describedby="send-button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSend();
                        }
                      }}
                    />
                  </div>
                  <Button
                    id="send-button"
                    onClick={handleSend}
                    disabled={isSendingMessage || !userQuery.trim()}
                    size="md"
                    className="px-3 sm:px-4 flex-shrink-0"
                    aria-label="메시지 전송"
                    loading={isSendingMessage}
                  >
                    {!isSendingMessage && <Send size={16} className="sm:size-5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>



        {/* 🔐 프로필 관리 모달 */}
        <Modal
          isOpen={showProfile && isAuthenticated && !!user}
          onClose={() => setShowProfile(false)}
          title="사용자 프로필"
          maxWidth="md"
        >
          {user && (
            <UserProfile 
              user={user as any}
              onLogout={handleLogout}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
        </Modal>
        
        {/* 🔔 알림 시스템 */}
        <NotificationSystem />


      </div>
    </ErrorBoundary>
  );
};

export default App;