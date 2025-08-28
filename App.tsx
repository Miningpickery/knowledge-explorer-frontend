/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useCallback, useRef } from 'react';
import type { 
  StreamingMessageData,
  MessageSender
} from './src/types';

// 🏪 New Store Imports
import { useChatStore } from './src/stores/chatStore';
import { useAuthStore } from './src/stores/authStore';
import { useUIStore } from './src/stores/uiStore';

// 🧩 Component Imports
import ChatHistory from './components/ChatHistory';
import ChatInterface from './components/ChatInterface';
import LoginButton from './components/LoginButton';
import UserProfile from './components/UserProfile';
import AuthCallback from './components/AuthCallback';
import { Button } from './components/ui/Button';
import ThemeSwitcher from './components/ThemeSwitcher';
import { cn } from './lib/utils';

// 🔧 Service Imports
import { deleteChat } from './services/chatHistoryService';
import { httpClient } from './src/services/httpClient';
import { ErrorHandler } from './src/utils/errorHandler';

// 🛡️ Error Handling Components
import ErrorBoundary from './src/components/ErrorBoundary';
import NotificationSystem from './src/components/NotificationSystem';

const App: React.FC = () => {
  // 🏪 Store Hooks - 중앙화된 상태 관리
  const {
    chats,
    activeChatId,
    messages,
    isLoadingChats,
    isLoadingMessages,
    isSendingMessage,
    error: chatError,
    isInitialized,
    setChats,
    setActiveChatId,
    setMessages,
    addMessage,
    updateMessage,
    setLoadingChats,
    setLoadingMessages,
    setSendingMessage,
    setError: setChatError,
    setInitialized,
    syncWithLocalStorage,
    saveToLocalStorage,
    getChatById,
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
    sidebarOpen,
    theme,
    notifications,
    globalLoading,
    setSidebarOpen,
    setGlobalLoading,
    addNotification,
    removeNotification,
  } = useUIStore();

  // 🎯 Computed Values
  const activeChat = getChatById(activeChatId || '') || null;
  const isLoading = authLoading || isLoadingChats || isLoadingMessages || globalLoading;
  const error = chatError || authError;
  
  // 🔐 인증 관련 함수들
  const checkAuthStatus = useCallback(async () => {
    // localStorage와 sessionStorage 모두 확인
    let token = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');

    console.log('🔐 스토리지 상태 확인:', {
      localStorage: {
        hasToken: !!token,
        tokenLength: token?.length,
        allKeys: Object.keys(localStorage)
      },
      sessionStorage: {
        hasToken: !!sessionToken,
        tokenLength: sessionToken?.length,
        allKeys: Object.keys(sessionStorage)
      }
    });

    if (!token) {
      token = sessionToken;
      if (token) {
        // sessionStorage에만 있으면 localStorage에도 복사
        localStorage.setItem('token', token);
        console.log('🔄 sessionStorage에서 토큰 복원하여 localStorage에 저장');
      }
    }

    console.log('🔐 인증 상태 확인 시작:', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPrefix: token ? token.substring(0, 20) + '...' : 'null',
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      localStorageSize: localStorage.length,
      sessionStorageSize: sessionStorage.length
    });

    if (token) {
      try {
        console.log('🔍 토큰 검증 요청 전송');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('🔐 인증 API 응답:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('🔐 사용자 데이터 로드:', userData);
          const userInfo = userData.data; // userData.data에서 실제 사용자 정보 추출
          setUser(userInfo);
          setIsAuthenticated(true);
          console.log('✅ 인증 성공:', { userId: userInfo?.id, email: userInfo?.email });
          return { isAuthenticated: true, user: userInfo };
        } else {
          console.log('❌ 인증 실패 - 토큰 제거');
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          setUser(null);
          return { isAuthenticated: false, user: null };
        }
      } catch (error) {
        console.error('❌ 인증 상태 확인 오류:', error);
        // 토큰은 일단 유지하고 재시도할 수 있도록 함
        console.log('⚠️ 토큰 유지하고 재시도 준비');
        logout();
        return { isAuthenticated: false, user: null };
      }
    } else {
      console.log('🔒 토큰 없음 - 인증되지 않은 상태');
      logout();
      return { isAuthenticated: false, user: null };
    }
  }, []);

  const handleLogout = useCallback(() => {
    // 두 스토리지 모두에서 토큰 제거
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    logout();
    setShowProfile(false);
  }, [logout]);

  // 프로필 창 닫기 함수 최적화
  const closeProfile = useCallback(() => {
    setShowProfile(false);
  }, []);

  const handleProfileUpdate = useCallback((updatedUser: any) => {
    updateUser(updatedUser);
  }, [updateUser]);

  // 🔄 라우팅 처리
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/auth/callback') {
      // AuthCallback 컴포넌트가 처리하도록 함
      return;
    }
  }, []);

  // 📋 채팅 목록 로드 (개선된 에러 처리)
  const loadChats = useCallback(async () => {
    try {
      setLoadingChats(true);
      setChatError(null);
      
      if (isAuthenticated) {
        // 🔐 인증된 사용자: 서버에서 채팅 로드
        console.log('📋 인증된 사용자 채팅 목록 로드 중...');
        
        const response = await httpClient.get('/api/chats');
        const chatList = response.data || [];
        
        console.log(`✅ 서버에서 ${chatList.length}개의 채팅 발견`);
        setChats(chatList);
        
        // 첫 번째 채팅 자동 선택 (활성 채팅이 없을 때만)
        if (chatList.length > 0 && !activeChatId) {
          console.log('🎯 첫 번째 서버 채팅 선택:', chatList[0].id);
          setActiveChatId(chatList[0].id);
        }
        
        addNotification({
          type: 'success',
          title: '채팅 로드 완료',
          message: `${chatList.length}개의 채팅을 불러왔습니다.`,
          duration: 3000,
        });
      } else {
        // 🔓 비인증 사용자: 로컬 스토리지에서 채팅 로드
        console.log('📱 익명 사용자 로컬 채팅 목록 로드 중...');
        syncWithLocalStorage(false);
        
        const savedActiveChatId = localStorage.getItem('active_chat_id');
        if (savedActiveChatId) {
          setActiveChatId(savedActiveChatId);
        }
      }
    } catch (err) {
      console.error('❌ 채팅 목록 로드 오류:', err);
      
      // 중앙화된 에러 처리
      const detailedError = ErrorHandler.handle(err, {
        operation: 'loadChats',
        isAuthenticated,
        userId: user?.id,
      });
      
      setChatError(detailedError.userMessage);
    } finally {
      setLoadingChats(false);
    }
  }, [isAuthenticated, user, activeChatId, setChats, setActiveChatId, setLoadingChats, setChatError, syncWithLocalStorage, addNotification]);

  // 💬 메시지 로드 (개선된 에러 처리)
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      setLoadingMessages(true);
      console.log(`💬 메시지 로드 시작 - 채팅 ID: ${chatId}, 인증 여부: ${isAuthenticated}`);
      
      if (isAuthenticated) {
        // 🔐 인증된 사용자: 서버에서 메시지 로드
        const chat = getChatById(chatId);
        if (!chat) {
          console.log(`🚫 채팅 ${chatId}는 현재 사용자의 채팅이 아님 - 접근 거부`);
          setMessages([]);
          return;
        }

        console.log(`📡 서버에서 채팅 ${chatId} 메시지 로드 중...`);
        
        const response = await httpClient.get(`/api/chats/${chatId}`);
        const chatData = response.data;
        
        setMessages(chatData.messages || []);
        console.log(`✅ 서버에서 ${chatData.messages?.length || 0}개 메시지 로드 완료`);
      } else {
        // 🔓 비인증 사용자: 로컬 스토리지에서 메시지 로드
        console.log(`📱 로컬에서 채팅 ${chatId} 메시지 로드 중...`);
        
        const chat = getChatById(chatId);
        if (chat && chat.messages) {
          setMessages(chat.messages);
          console.log(`✅ 로컬에서 ${chat.messages.length}개 메시지 로드 완료`);
        } else {
          console.log(`📝 채팅 ${chatId}에 저장된 메시지 없음`);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('❌ 메시지 로드 오류:', err);
      
      // 중앙화된 에러 처리
      const detailedError = ErrorHandler.handle(err, {
        operation: 'loadMessages',
        chatId,
        isAuthenticated,
        userId: user?.id,
      });
      
      setMessages([]);
      setChatError(detailedError.userMessage);
    } finally {
      setLoadingMessages(false);
    }
  }, [isAuthenticated, getChatById, setMessages, setLoadingMessages, setChatError, user]);

  // 익명 새 채팅 생성 함수
  const createNewAnonymousChat = useCallback((): ChatSession => {
    const newChat: ChatSession = {
      id: `chat-${Date.now()}`,
      title: '새로운 대화',
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: []
    };
    setActiveChat(newChat);
    setChats([newChat]);
    
    // 로컬 스토리지에 저장
    localStorage.setItem('anonymous_chats', JSON.stringify([newChat]));
    localStorage.setItem('active_chat_id', newChat.id);
    
    console.log('✅ 익명 새 채팅 생성 완료');
    return newChat;
  }, []);

  // 새 채팅 생성
  const handleCreateNewChat = useCallback(async () => {
    try {
      setIsLoading(true);

      // 인증된 사용자인 경우 서버에 새 채팅 생성
      if (isAuthenticated) {
        console.log('👤 인증된 사용자 - 서버에 새 채팅 생성');
        
        // 토큰 확인 (localStorage와 sessionStorage 모두 확인)
        let token = localStorage.getItem('token');
        if (!token) {
          token = sessionStorage.getItem('token');
          if (token) {
            localStorage.setItem('token', token);
            console.log('🔄 sessionStorage에서 토큰 복원');
          }
        }

        if (!token) {
          console.error('❌ 토큰 없음');
          alert('인증 토큰이 없습니다. 다시 로그인해주세요.');
          setIsAuthenticated(false);
          setUser(null);
          return;
        }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch('http://localhost:3001/api/chats', {
        method: 'POST',
        headers,
      });
      
      if (response.ok) {
        const newChat = await response.json();
        console.log('Setting active chat:', newChat);
        setActiveChat(newChat);
        setMessages([]);
        await loadChats(); // 채팅 목록 새로고침
        } else if (response.status === 401) {
          console.error('❌ 인증 만료');
          alert('인증이 만료되었습니다. 다시 로그인해주세요.');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          setIsAuthenticated(false);
          setUser(null);
        } else {
          throw new Error('Failed to create new chat');
        }
      } else {
        // 익명 사용자인 경우 로컬에서 새 채팅 생성
        console.log('🔓 익명 사용자 - 로컬 새 채팅 생성');
        const newChat = {
          id: `chat-${Date.now()}`,
          title: '새로운 대화',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: []
        };
        setActiveChat(newChat);
        setMessages([]);
        console.log('✅ 익명 새 채팅 생성 완료');
      }


    } catch (err) {
      console.error('Failed to create new chat:', err);
      setError('새 채팅을 생성하는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [loadChats, isAuthenticated]);

  // 메시지 전송 (스트리밍)
  const sendMessage = useCallback(async (text: string) => {
    console.log('sendMessage called with:', { text, activeChat: activeChat?.id });
    if (!activeChat || !text || typeof text !== 'string' || !text.trim()) {
      console.log('sendMessage early return:', { activeChat: !!activeChat, text: !!text, textType: typeof text, textTrim: text?.trim() });
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      sender: MessageSender.USER,
      isLoading: false
    };

    // 사용자 메시지 추가
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      
      // 익명 사용자인 경우 로컬 스토리지에 저장
      if (!isAuthenticated && activeChat) {
        const updatedChat = { ...activeChat, messages: newMessages };
        setActiveChat(updatedChat);
        
        // 채팅 목록 업데이트
        setChats(prevChats => {
          const updatedChats = prevChats.map(chat => 
            chat.id === activeChat.id ? updatedChat : chat
          );
          
          // 로컬 스토리지에 저장
          localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
          localStorage.setItem('active_chat_id', activeChat.id);
          
          return updatedChats;
        });
      }
      
      return newMessages;
    });

    // AI 응답 대기 메시지 추가
    const aiLoadingMessage: ChatMessage = {
      id: `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: "준비",
      sender: MessageSender.MODEL,
      isLoading: true
    };
    setMessages(prev => {
      const newMessages = [...prev, aiLoadingMessage];
      
      // 익명 사용자인 경우 로컬 스토리지에 저장
      if (!isAuthenticated && activeChat) {
        const updatedChat = { ...activeChat, messages: newMessages };
        setActiveChat(updatedChat);
        
        // 채팅 목록 업데이트
        setChats(prevChats => {
          const updatedChats = prevChats.map(chat => 
            chat.id === activeChat.id ? updatedChat : chat
          );
          
          // 로컬 스토리지에 저장
          localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
          localStorage.setItem('active_chat_id', activeChat.id);
          
          return updatedChats;
        });
      }
      
      return newMessages;
    });

    // 로딩 텍스트 변경 타이머 시작
    const loadingWords = ['준비하고 있어요', '질문을 이해하고 있어요', '정보를 찾고 있어요', '생각하고 있어요', '답변을 만들고 있어요', '검토하고 있어요'];
    let wordIndex = 0;
    const loadingInterval = setInterval(() => {
      wordIndex = (wordIndex + 1) % loadingWords.length;
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? { ...msg, text: loadingWords[wordIndex] } : msg
      ));
    }, 2000);

    try {
      setIsLoading(true);
      console.log('Sending message to API:', { text: text.trim(), chatId: activeChat.id });
      
      // 스트리밍 응답 처리
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 인증된 사용자인 경우 토큰 추가
      if (token && isAuthenticated) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`http://localhost:3001/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`메시지 전송 실패: ${errorMessage}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Server-Sent Events 형식 파싱
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관

        for (const line of lines) {
                        if (line.startsWith('DATA: ')) {
                try {
                  const data: StreamingMessageData = JSON.parse(line.slice(6));
              
              if (data.type === 'streaming') {
                // 스트리밍 메시지 처리 - 기존 메시지 업데이트
                setMessages(prev => {
                  const filteredMessages = prev.filter(msg => !msg.isLoading);
                  
                  // 스트리밍 메시지는 paragraphIndex를 기반으로 고유 ID 생성
                  const streamingId = `streaming-${data.paragraphIndex}-${activeChat?.id}`;
                  const existingMessageIndex = filteredMessages.findIndex(msg => 
                    msg.id === streamingId || 
                    (msg.isStreaming && msg.sender === MessageSender.MODEL)
                  );
                  
                  if (existingMessageIndex >= 0) {
                    // 기존 메시지 업데이트
                    const updatedMessages = [...filteredMessages];
                    updatedMessages[existingMessageIndex] = {
                      ...updatedMessages[existingMessageIndex],
                      id: streamingId,
                      text: data.message.text,
                      isStreaming: true
                    };
                    return updatedMessages;
                  } else {
                    // 새 메시지 추가
                    return [...filteredMessages, {
                      ...data.message,
                      id: streamingId,
                      isLoading: false,
                      isStreaming: true
                    }];
                  }
                });
              } else if (data.type === 'paragraph' || data.type === 'followUp') {
                // 로딩 메시지 제거하고 새로운 메시지 추가
                setMessages(prev => {
                  const filteredMessages = prev.filter(msg => !msg.isLoading);
                  
                  // 문단 메시지는 paragraphIndex를 기반으로 고유 ID 생성
                  const paragraphId = `paragraph-${data.paragraphIndex}-${activeChat?.id}-${Date.now()}`;
                  const streamingId = `streaming-${data.paragraphIndex}-${activeChat?.id}`;
                  
                  // 스트리밍 메시지를 완료된 메시지로 변환
                  const existingMessageIndex = filteredMessages.findIndex(msg => 
                    msg.id === streamingId || msg.isStreaming
                  );
                  
                  if (existingMessageIndex >= 0) {
                    // 기존 스트리밍 메시지를 완료된 메시지로 업데이트
                    const updatedMessages = [...filteredMessages];
                    updatedMessages[existingMessageIndex] = {
                      ...updatedMessages[existingMessageIndex],
                      id: paragraphId,
                      isStreaming: false,
                      followUpQuestions: data.type === 'followUp' ? [] : undefined
                    };
                    return updatedMessages;
                  } else {
                    // 새 메시지 추가
                    return [...filteredMessages, {
                      ...data.message,
                      id: paragraphId,
                      isLoading: false,
                      isStreaming: false,
                      followUpQuestions: data.type === 'followUp' ? [] : undefined
                    }];
                  }
                });

              } else if (data.type === 'error') {
                // 로딩 메시지 제거하고 에러 메시지 추가
                setMessages(prev => {
                  const filteredMessages = prev.filter(msg => !msg.isLoading);
                  const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  return [...filteredMessages, {
                    ...data.message,
                    id: errorId,
                    isLoading: false
                  }];
                });
              } else if (data.type === 'complete') {
                // 스트리밍 완료 - 스트리밍 상태 해제
                setMessages(prev => {
                  const updatedMessages = prev.map(msg => ({ ...msg, isLoading: false, isStreaming: false }));
                  
                  // 익명 사용자인 경우 로컬 스토리지에 저장
                  if (!isAuthenticated && activeChat) {
                    const updatedChat = { ...activeChat, messages: updatedMessages };
                    setActiveChat(updatedChat);
                    
                    // 채팅 목록 업데이트
                    setChats(prevChats => {
                      const updatedChats = prevChats.map(chat => 
                        chat.id === activeChat.id ? updatedChat : chat
                      );
                      
                      // 로컬 스토리지에 저장
                      localStorage.setItem('anonymous_chats', JSON.stringify(updatedChats));
                      localStorage.setItem('active_chat_id', activeChat.id);
                      
                      return updatedChats;
                    });
                  }
                  
                  return updatedMessages;
                });
                console.log('Streaming completed');
                
                // 로딩 타이머 정리
                if (loadingInterval) {
                  clearInterval(loadingInterval);
                }
                
                // 스트리밍 완료 후 메시지 새로고침 (맥락 단위로 저장된 메시지들 로드)
                setTimeout(async () => {
                  if (activeChat) {
                    await loadMessages(activeChat.id);
                  }
                }, 100);
              } else if (data.type === 'refresh') {
                // 메시지 새로고침 신호
                console.log('Refreshing messages from database...');
                setTimeout(async () => {
                  if (activeChat) {
                    await loadMessages(activeChat.id);
                  }
                }, 200);
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError);
            }
          }
        }
      }

      // 채팅 목록 새로고침
      await loadChats();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('메시지 전송에 실패했습니다.');
      // 에러 발생 시 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsLoading(false);
      // 로딩 타이머 정리
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
    }
  }, [activeChat, loadChats]);

  // 채팅 선택
  const selectChat = useCallback(async (chatId: string) => {
    console.log('Selecting chat:', chatId);
    const selectedChat = chats.find(chat => chat.id === chatId);
    if (selectedChat) {
      setActiveChat(selectedChat);
      await loadMessages(chatId);
    }
  }, [chats, loadMessages]);

  // 채팅 삭제
  const handleDeleteChat = useCallback(async (chatId: string) => {
    try {
      // 백엔드에서 채팅 삭제
      await deleteChat(chatId);
      
      // 현재 활성 채팅이 삭제된 경우 첫 번째 채팅 선택
      if (activeChat?.id === chatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0]);
          await loadMessages(remainingChats[0].id);
        } else {
          setActiveChat(null);
          setMessages([]);
        }
      }
      
      // 채팅 목록 새로고침
      await loadChats();
    } catch (err) {
      console.error('Failed to delete chat:', err);
      setError('채팅 삭제에 실패했습니다.');
    }
  }, [activeChat, chats, loadChats, loadMessages]);

  // 🔄 초기화 상태 추적을 위한 ref
  const initializationRef = useRef(false);

  // 초기화
  useEffect(() => {
    // 이미 초기화가 진행 중이거나 완료된 경우 중복 실행 방지
    if (initializationRef.current) {
      return;
    }
    
    initializationRef.current = true;
    
    const initialize = async () => {
      try {
        console.log('🚀 앱 초기화 시작...');
        
        // 1단계: 인증 상태 확인
        const authResult = await checkAuthStatus();
        console.log('✅ 인증 상태 확인 완료');
        
        // 2단계: 채팅 목록 로드 (인증 여부와 관계없이)
        if (authResult.isAuthenticated && authResult.user) {
          console.log(`👤 인증된 사용자 ${authResult.user.email} - 개인 채팅 목록 로드 시작`);
        await loadChats();
          console.log('✅ 개인 채팅 목록 로드 완료');
        } else {
          console.log('🔓 인증되지 않은 사용자 - 로컬 세션 복원 시도');
          
          // 로컬 스토리지에서 이전 세션 복원
          const savedChats = localStorage.getItem('anonymous_chats');
          const savedActiveChatId = localStorage.getItem('active_chat_id');
          
          if (savedChats && savedActiveChatId) {
            try {
              const parsedChats = JSON.parse(savedChats);
              const activeChat = parsedChats.find((chat: any) => chat.id === savedActiveChatId);
              
              if (activeChat) {
                console.log('🔄 로컬 세션 복원 중...');
                setChats(parsedChats);
                setActiveChat(activeChat);
                console.log('✅ 로컬 세션 복원 완료');
              } else {
                console.log('❌ 활성 채팅을 찾을 수 없음 - 새 채팅 시작');
                createNewAnonymousChat();
              }
            } catch (error) {
              console.error('❌ 로컬 세션 복원 실패:', error);
              createNewAnonymousChat();
            }
          } else {
            console.log('💡 이전 세션 없음 - 새 채팅 시작');
            createNewAnonymousChat();
          }
        }
        
        setIsInitialized(true);
        console.log('✅ 앱 초기화 완료');
      } catch (err) {
        console.error('❌ 앱 초기화 실패:', err);
        setAuthError('앱 초기화에 실패했습니다.');
        // 에러가 발생해도 초기화는 완료로 처리
        setIsInitialized(true);
      }
    };

    initialize();
  }, []); // 빈 의존성 배열로 변경하여 한 번만 실행

  // 인증 상태 변경 시 채팅 목록 새로고침 (무한 루프 방지를 위해 제거)
  // useEffect(() => {
  //   if (isInitialized && isAuthenticated && user) {
  //     console.log(`🔄 인증 상태 변경 감지 - 채팅 목록 새로고침 (${user.email})`);
  //     loadChats();
  //   }
  // }, [isAuthenticated, user?.id]); // user.id만 의존성으로 사용

  // 활성 채팅 변경 시 메시지 로드
  useEffect(() => {
    if (activeChat && isInitialized) {
      loadMessages(activeChat.id);
    }
  }, [activeChat, isInitialized, loadMessages]);

  // 에러 표시
  const dismissError = () => {
    setError(null);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">채권도시 챗봇 로딩 중...</h2>
          <p className="text-gray-500 text-sm md:text-base">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 🔄 AuthCallback 라우팅 처리
  const path = window.location.pathname;
  if (path === '/auth/callback') {
    return <AuthCallback />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* 📱 모바일 우선 사이드바 레이아웃 */}
      <div className={cn(
        "transition-all duration-300 bg-card border-r border-border overflow-hidden",
        // 모바일: 전체 화면 오버레이
        isSidebarOpen ? 'fixed inset-0 z-50 md:relative md:z-auto' : 'hidden md:block',
        // 데스크톱: 고정 너비
        isSidebarOpen ? 'w-full md:w-80' : 'w-0 md:w-80'
      )}>
        {/* 모바일 오버레이 배경 */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        
        {/* 사이드바 컨텐츠 */}
        <div className="relative z-50 md:relative bg-card h-full">
          <ChatHistory 
            chats={chats}
            activeChatId={activeChat?.id || null}
            onNewChat={handleCreateNewChat}
            onSelectChat={selectChat}
            onDeleteChat={handleDeleteChat}
          />
        </div>
      </div>

      {/* 🖥️ 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 🎨 헤더 (시맨틱 색상 사용) */}
        <header className="bg-background shadow-sm border-b border-border flex-shrink-0">
          <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* 모바일 메뉴 버튼 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="md:hidden p-2"
                  aria-label="메뉴 열기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
                <h1 className="text-lg md:text-xl font-semibold text-foreground text-balance">
                  채권도시 챗봇
                </h1>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                {/* 활성 채팅 제목 (데스크톱에서만 표시) */}
                {activeChat && (
                  <div className="hidden lg:block text-sm text-muted-foreground truncate max-w-xs">
                    {activeChat.title}
                  </div>
                )}
                
                {/* 테마 스위처 */}
                <ThemeSwitcher />
                
                {/* 🔐 인증 UI (접근성 개선) */}
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-2">
                    {/* 프로필 창이 열려있을 때 닫기 버튼 */}
                    {showProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeProfile}
                        className="hidden sm:flex"
                      >
                        ← 채팅으로 돌아가기
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowProfile(!showProfile)}
                      className={cn(
                        "w-9 h-9 rounded-full p-0 transition-all",
                        showProfile 
                          ? 'bg-primary/10 ring-2 ring-primary/20' 
                          : 'bg-secondary hover:bg-accent'
                      )}
                      aria-label="사용자 프로필"
                    >
                      {user.profile_picture ? (
                        <img 
                          src={user.profile_picture} 
                          alt={user.name || '사용자'}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-foreground">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                      )}
                    </Button>
                  </div>
                ) : (
                  <LoginButton />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ⚠️ 에러 메시지 (접근성 개선) */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-lg" role="alert">
            <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
              <span className="text-sm text-pretty flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissError}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive/80 flex-shrink-0"
                aria-label="에러 메시지 닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* 🔐 프로필 관리 */}
        {showProfile && isAuthenticated && user && (
          <div className="flex-1 p-6">
            <UserProfile 
              user={user}
              onLogout={handleLogout}
              onProfileUpdate={handleProfileUpdate}
            />
          </div>
        )}

        {/* 채팅 인터페이스 - 항상 렌더링하되 조건부로 표시 */}
        <div className={`flex-1 ${showProfile ? 'hidden' : 'block'}`}>
          {activeChat ? (
            <ChatInterface
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center max-w-sm md:max-w-md mx-auto">
                {!isAuthenticated ? (
                  // 로그인되지 않은 상태 - 익명 채팅 가능
                  <div>
                    <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 mb-6 shadow-lg">
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">채권도시 챗봇</h2>
                      <p className="text-primary-100 text-sm md:text-base">지식 탐험을 시작해보세요</p>
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-3">새로운 대화를 시작해보세요!</h3>
                    <p className="text-gray-600 mb-6 text-sm md:text-base">
                      무엇이든 물어보시면 도와드리겠습니다.
                    </p>
                    <button
                      onClick={handleCreateNewChat}
                      disabled={isLoading}
                      className="bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                    >
                      {isLoading ? '생성 중...' : '새 대화 시작'}
                    </button>
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 mb-2">또는</p>
                      <LoginButton />
                    </div>
                  </div>
                ) : (
                  // 로그인된 상태
                  <div>
                    <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 mb-6 shadow-lg">
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">채권도시 챗봇</h2>
                      <p className="text-primary-100 text-sm md:text-base">지식 탐험을 시작해보세요</p>
                </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-3">새로운 대화를 시작하세요</h3>
                    <p className="text-gray-600 mb-6 text-sm md:text-base">채권도시 챗봇과 함께 새로운 지식을 발견해보세요.</p>
                <button
                  onClick={handleCreateNewChat}
                  disabled={isLoading}
                      className="bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                >
                  {isLoading ? '생성 중...' : '새 대화 시작'}
                </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
        {/* 🔔 알림 시스템 */}
        <NotificationSystem />
      </div>
    </ErrorBoundary>
  );
};

export default App;