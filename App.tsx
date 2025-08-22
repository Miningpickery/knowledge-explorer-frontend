/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import ChatHistory from './components/ChatHistory';
import ChatInterface from './components/ChatInterface';
import { ChatMessage, ChatSession, MessageSender } from './types';
import { getAllChats, createNewChat as createChatService, deleteChat } from './services/chatHistoryService';

const App: React.FC = () => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // 채팅 목록 로드
  const loadChats = useCallback(async () => {
    try {
      console.log('Loading chats...');
      const chatList = await getAllChats();
      console.log('Chats loaded:', chatList);
      setChats(chatList);
      
      // 첫 번째 채팅을 자동으로 선택 (초기 로드 시에만)
      if (chatList.length > 0 && !activeChat) {
        console.log('Setting active chat:', chatList[0]);
        setActiveChat(chatList[0]);
      }
    } catch (err) {
      console.error('Failed to load chats:', err);
      setError('채팅 목록을 불러오는데 실패했습니다.');
    }
  }, []); // activeChat 의존성 제거하여 무한 루프 방지

  // 메시지 로드
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      // 백엔드에서 메시지를 가져오는 방식으로 변경
      const response = await fetch(`http://localhost:3001/api/chats/${chatId}`);
      if (response.ok) {
        const chat = await response.json();
        setMessages(chat.messages || []);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  }, []);

  // 새 채팅 생성
  const handleCreateNewChat = useCallback(async () => {
    try {
      setIsLoading(true);
      const newChat = await createChatService();
      console.log('Setting active chat:', newChat);
      setActiveChat(newChat);
      setMessages([]);
      await loadChats(); // 채팅 목록 새로고침
    } catch (err) {
      console.error('Failed to create new chat:', err);
      setError('새 채팅을 생성하는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [loadChats]);

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
    setMessages(prev => [...prev, userMessage]);

    // AI 응답 대기 메시지 추가
    const aiLoadingMessage: ChatMessage = {
      id: `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: "준비",
      sender: MessageSender.MODEL,
      isLoading: true
    };
    setMessages(prev => [...prev, aiLoadingMessage]);

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
      const response = await fetch(`http://localhost:3001/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
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
              const data = JSON.parse(line.slice(6));
              
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
                setMessages(prev => prev.map(msg => ({ ...msg, isLoading: false, isStreaming: false })));
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

  // 초기화
  useEffect(() => {
    const initialize = async () => {
      try {
        await loadChats();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('앱 초기화에 실패했습니다.');
      }
    };

    initialize();
  }, []);

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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 사이드바 */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white shadow-lg overflow-hidden`}>
      <ChatHistory 
          chats={chats}
          activeChatId={activeChat?.id || null}
          onNewChat={handleCreateNewChat}
          onSelectChat={selectChat}
        onDeleteChat={handleDeleteChat}
        />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-800">지식 탐험가</h1>
            </div>
            
            {activeChat && (
              <div className="text-sm text-gray-500">
                {activeChat.title}
              </div>
            )}
          </div>
        </header>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-4 mt-4 flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={dismissError}
              className="text-red-700 hover:text-red-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
        </button>
          </div>
        )}

        {/* 채팅 인터페이스 */}
        {activeChat ? (
        <ChatInterface
          messages={messages}
            onSendMessage={sendMessage}
          isLoading={isLoading}
        />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">새로운 대화를 시작하세요</h3>
              <p className="text-gray-500 mb-4">지식 탐험가와 함께 새로운 지식을 발견해보세요.</p>
              <button
                onClick={handleCreateNewChat}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '생성 중...' : '새 대화 시작'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;