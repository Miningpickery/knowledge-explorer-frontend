/**
 * ⚡ 성능 최적화된 채팅 훅 - 상용화 수준
 * @description React 성능 최적화 기법들을 적용한 채팅 관리 훅
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { debounce, throttle } from 'lodash-es';
import { ChatMessage, ChatSession } from '../../business/types/chat.types';
import { useChatStore, useChatActions } from '../../business/stores/chatStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorHandler } from '../../infrastructure/errors/ErrorHandler';
// import { Logger } from '../../infrastructure/logger/Logger';

interface UseOptimizedChatOptions {
  enableVirtualization?: boolean;
  messageBufferSize?: number;
  autoSaveInterval?: number;
  debounceDelay?: number;
  enablePreloading?: boolean;
}

interface UseOptimizedChatReturn {
  // 기본 상태
  messages: ChatMessage[];
  chats: ChatSession[];
  activeChat: ChatSession | null;
  isLoading: boolean;
  error: string | null;
  
  // 최적화된 액션들
  sendMessage: (text: string) => Promise<void>;
  selectChat: (chatId: string) => void;
  createChat: () => Promise<void>;
  deleteChat: (chatId: string) => void;
  
  // 성능 관련
  virtualizer: any; // 가상화 객체
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  isTyping: boolean;
  lastSeen: Record<string, number>;
  
  // 고급 기능
  searchMessages: (query: string) => ChatMessage[];
  exportChat: (chatId: string) => Promise<Blob>;
  getMessageMetrics: () => MessageMetrics;
}

interface MessageMetrics {
  totalMessages: number;
  averageResponseTime: number;
  messagesPerHour: number;
  mostActiveHour: number;
}

export function useOptimizedChat(options: UseOptimizedChatOptions = {}): UseOptimizedChatReturn {
  const {
    enableVirtualization = true,
    messageBufferSize = 50,
    autoSaveInterval = 5000,
    debounceDelay = 300,
    enablePreloading = true
  } = options;
  
  // ============================================================================
  // 🏪 Zustand Store 연결
  // ============================================================================
  
  const messages = useChatStore(state => state.messages);
  const chats = useChatStore(state => state.chats);
  const activeChat = useChatStore(state => state.activeChat);
  const isLoading = useChatStore(state => state.isLoading);
  const error = useChatStore(state => state.error);
  const actions = useChatActions();
  
  // ============================================================================
  // 🎯 로컬 상태 관리
  // ============================================================================
  
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  const [searchCache, setSearchCache] = useState<Map<string, ChatMessage[]>>(new Map());
  
  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const metricsRef = useRef<MessageMetrics>({
    totalMessages: 0,
    averageResponseTime: 0,
    messagesPerHour: 0,
    mostActiveHour: 0
  });
  
  // ============================================================================
  // 📊 가상화 설정 (대량 메시지 처리)
  // ============================================================================
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: useCallback((index: number) => {
      const message = messages[index];
      if (!message) return 80; // 기본 높이
      
      // 메시지 길이 기반 높이 추정
      const textLength = message.text.length;
      const estimatedLines = Math.ceil(textLength / 50); // 50문자당 1줄
      const lineHeight = 24;
      const padding = 32;
      
      return Math.max(80, estimatedLines * lineHeight + padding);
    }, [messages]),
    overscan: 5, // 성능을 위한 오버스캔
    enabled: enableVirtualization && messages.length > messageBufferSize
  });
  
  // ============================================================================
  // 🚀 최적화된 액션들
  // ============================================================================
  
  // 디바운스된 메시지 전송
  const debouncedSendMessage = useMemo(
    () => debounce(async (text: string) => {
      try {
        setIsTyping(false);
        await actions.sendMessage(text);
        
        // 메트릭 업데이트
        updateMessageMetrics();
        
        // 자동 저장 트리거
        scheduleAutoSave();
        
      } catch (error) {
        ErrorHandler.handle(error, 'sendMessage');
      }
    }, debounceDelay),
    [actions.sendMessage, debounceDelay]
  );
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    setIsTyping(true);
    
         // 즉시 사용자 메시지 표시 (낙관적 업데이트)
     const optimisticMessage: ChatMessage = {
       message_id: `temp-${Date.now()}`,
       text: text.trim(),
       sender: 'user',
       timestamp: new Date().toISOString(),
       status: 'sending'
     };
    
    // 임시로 메시지 추가 (실제 구현에서는 store 액션 사용)
    await debouncedSendMessage(text);
    
  }, [debouncedSendMessage]);
  
  // 쓰로틀된 채팅 선택
  const throttledSelectChat = useMemo(
    () => throttle(async (chatId: string) => {
      try {
        await actions.selectChat(chatId);
        
        // 마지막 확인 시간 업데이트
        setLastSeen(prev => ({
          ...prev,
          [chatId]: Date.now()
        }));
        
        // 프리로딩 (다음 채팅들)
        if (enablePreloading) {
          schedulePreloading(chatId);
        }
        
      } catch (error) {
        ErrorHandler.handle(error, 'selectChat');
      }
    }, 100),
    [actions.selectChat, enablePreloading]
  );
  
  const selectChat = useCallback((chatId: string) => {
    throttledSelectChat(chatId);
  }, [throttledSelectChat]);
  
  // 메모이즈된 채팅 생성
  const createChat = useCallback(async () => {
    try {
      await actions.createChat();
      scheduleAutoSave();
    } catch (error) {
      ErrorHandler.handle(error, 'createChat');
    }
  }, [actions.createChat]);
  
  // 메모이즈된 채팅 삭제
  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await actions.deleteChat(chatId);
      
      // 캐시에서 관련 데이터 제거
      setSearchCache(prev => {
        const newCache = new Map(prev);
        // 해당 채팅의 검색 결과 제거
        for (const [key] of newCache) {
          if (key.includes(chatId)) {
            newCache.delete(key);
          }
        }
        return newCache;
      });
      
      scheduleAutoSave();
      
    } catch (error) {
      ErrorHandler.handle(error, 'deleteChat');
    }
  }, [actions.deleteChat]);
  
  // ============================================================================
  // 🔍 고급 기능들
  // ============================================================================
  
  // 메모이즈된 메시지 검색
  const searchMessages = useCallback((query: string): ChatMessage[] => {
    if (!query.trim()) return [];
    
            const cacheKey = `${activeChat?.chat_id || 'all'}-${query.toLowerCase()}`;
    
    // 캐시 확인
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }
    
    // 검색 수행
    const results = messages.filter(message => 
      message.text.toLowerCase().includes(query.toLowerCase())
    );
    
    // 결과 캐싱 (최대 100개 검색어)
    if (searchCache.size >= 100) {
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }
    
    setSearchCache(prev => new Map(prev).set(cacheKey, results));
    
    console.log('메시지 검색 완료', { 
      query, 
      resultCount: results.length,
      cached: false 
    });
    
    return results;
  }, [messages, activeChat?.chat_id, searchCache]);
  
  // 채팅 내보내기
  const exportChat = useCallback(async (chatId: string): Promise<Blob> => {
    try {
      const chat = chats.find(c => c.chat_id === chatId);
      if (!chat) throw new Error('채팅을 찾을 수 없습니다');
      
      const chatMessages = await actions.loadMessages(chatId) as any;
      
      const exportData = {
        chat: {
          id: chat.chat_id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt
        },
        messages: chatMessages.map(msg => ({
          id: msg.message_id,
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp
        })),
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      console.log('채팅 내보내기 완료', { 
        chatId, 
        messageCount: chatMessages.length 
      });
      
      return blob;
      
    } catch (error) {
      throw ErrorHandler.handle(error, 'exportChat');
    }
  }, [chats, actions.loadMessages]);
  
  // 메시지 메트릭 계산
  const getMessageMetrics = useCallback((): MessageMetrics => {
    return { ...metricsRef.current };
  }, []);
  
  // ============================================================================
  // 🔧 내부 헬퍼 함수들
  // ============================================================================
  
  const updateMessageMetrics = useCallback(() => {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp).getTime() > hourAgo
    );
    
    const responseTimes: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      if (current.sender === 'assistant' && previous.sender === 'user') {
        const responseTime = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
        responseTimes.push(responseTime);
      }
    }
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    // 시간대별 메시지 분포 계산
    const hourlyDistribution = new Array(24).fill(0);
    messages.forEach(msg => {
      const hour = new Date(msg.timestamp).getHours();
      hourlyDistribution[hour]++;
    });
    
    const mostActiveHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    
    metricsRef.current = {
      totalMessages: messages.length,
      averageResponseTime,
      messagesPerHour: recentMessages.length,
      mostActiveHour
    };
  }, [messages]);
  
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
             // 자동 저장 로직 (실제 구현에서는 store의 persist 기능 활용)
       console.log('자동 저장 수행');
    }, autoSaveInterval);
  }, [autoSaveInterval]);
  
  const schedulePreloading = useCallback((currentChatId: string) => {
    // 다음 채팅들을 백그라운드에서 프리로드
    setTimeout(async () => {
              const currentIndex = chats.findIndex(chat => chat.chat_id === currentChatId);
      const nextChats = chats.slice(currentIndex + 1, currentIndex + 3); // 다음 2개 채팅
      
      for (const chat of nextChats) {
        try {
          await actions.loadMessages(chat.chat_id) as any;
        } catch (error) {
          // 프리로딩 실패는 무시 (중요하지 않음)
                      console.warn('프리로딩 실패', { chatId: chat.chat_id });
        }
      }
    }, 1000);
  }, [chats, actions.loadMessages]);
  
  // ============================================================================
  // 🎯 Effect 훅들
  // ============================================================================
  
  // 타이핑 상태 관리
  useEffect(() => {
    if (isTyping && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping]);
  
  // 메트릭 업데이트
  useEffect(() => {
    updateMessageMetrics();
  }, [messages, updateMessageMetrics]);
  
  // 스크롤 위치 복원
  useEffect(() => {
    if (activeChat && messagesContainerRef.current) {
              const savedPosition = localStorage.getItem(`scroll-${activeChat.chat_id}`);
      if (savedPosition) {
        messagesContainerRef.current.scrollTop = parseInt(savedPosition, 10);
      } else {
        // 새 채팅이면 맨 아래로 스크롤
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [activeChat]);
  
  // 스크롤 위치 저장
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !activeChat) return;
    
    const handleScroll = throttle(() => {
                localStorage.setItem(`scroll-${activeChat.chat_id}`, container.scrollTop.toString());
    }, 500);
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      handleScroll.cancel();
    };
  }, [activeChat]);
  
  // 정리
  useEffect(() => {
    return () => {
      debouncedSendMessage.cancel();
      throttledSelectChat.cancel();
      
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [debouncedSendMessage, throttledSelectChat]);
  
  // ============================================================================
  // 🎯 Return
  // ============================================================================
  
  return {
    // 기본 상태
    messages,
    chats,
    activeChat,
    isLoading,
    error,
    
    // 최적화된 액션들
    sendMessage,
    selectChat,
    createChat,
    deleteChat,
    
    // 성능 관련
    virtualizer,
    messagesContainerRef,
    isTyping,
    lastSeen,
    
    // 고급 기능
    searchMessages,
    exportChat,
    getMessageMetrics
  };
}
