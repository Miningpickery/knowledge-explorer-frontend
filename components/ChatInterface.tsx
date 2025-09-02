/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';

// 타입을 직접 정의
interface ChatMessage {
  message_id: string;
  text: string;
  sender: 'user' | 'model';
  timestamp: string;
  sources?: string[];
  followUpQuestions?: string[];
  context?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  isDarkMode?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isDarkMode = false 
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 디버깅 로그 제거 (무한루프 방지)
  // console.log('🔍 ChatInterface 렌더링:', {
  //   messagesLength: messages?.length,
  //   firstMessage: messages?.[0]
  // });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // messages가 undefined이거나 null일 때 빈 배열로 처리
  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="flex flex-col h-full w-full">
      {/* 💬 메시지 영역 (스크롤 가능) */}
      <main className="flex-1 overflow-hidden">
        <div className={`h-full overflow-y-auto chat-container transition-colors duration-200 ${
          isDarkMode ? 'bg-slate-800' : 'bg-gray-50'
        }`}>
          <div className="flex flex-col gap-4 sm:gap-6 p-3 sm:p-4 max-w-4xl mx-auto w-full">
            {safeMessages.length === 0 ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className={`text-center space-y-2 ${
                  isDarkMode ? 'text-gray-400' : 'text-muted-foreground'
                }`}>
                  <p className="text-base sm:text-lg text-balance">
                    새로운 대화를 시작해보세요!
                  </p>
                  <p className="text-sm text-pretty">
                    무엇이든 물어보시면 도와드리겠습니다.
                  </p>
                </div>
              </div>
            ) : (
              safeMessages.map((msg: any, index) => (
                <MessageItem key={msg.message_id} message={msg} onSuggestedQueryClick={onSendMessage} isDarkMode={isDarkMode} />
              ))
            )}
            {/* 스크롤 약커 */}
            <div ref={messagesEndRef} className="h-px" aria-hidden="true" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatInterface;