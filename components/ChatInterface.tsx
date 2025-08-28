/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import { Button } from './ui/Button';
import { Send } from 'lucide-react';

// 타입을 직접 정의
interface ChatMessage {
  id: string;
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
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [userQuery, setUserQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (userQuery.trim() && !isLoading) {
      onSendMessage(userQuery.trim());
      setUserQuery('');
    }
  };

  // messages가 undefined이거나 null일 때 빈 배열로 처리
  const safeMessages = messages || [];

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* 🎨 헤더 (시맨틱 색상 사용) */}
      <header className="bg-primary text-primary-foreground shadow-sm border-b border-border flex-shrink-0">
        <div className="p-3 sm:p-4 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-balance">
            채권도시 챗봇
          </h1>
        </div>
      </header>
      
      {/* 💬 메시지 영역 (모바일 우선 디자인) */}
      <main className="flex-grow overflow-hidden">
        <div className="h-full overflow-y-auto chat-container p-3 sm:p-4">
          <div className="flex flex-col gap-4 sm:gap-6 pb-4">
            {safeMessages.length === 0 ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center text-muted-foreground space-y-2">
                  <p className="text-base sm:text-lg text-balance">
                    새로운 대화를 시작해보세요!
                  </p>
                  <p className="text-sm text-pretty">
                    무엇이든 물어보시면 도와드리겠습니다.
                  </p>
                </div>
              </div>
            ) : (
              safeMessages.map((msg) => (
                <MessageItem key={msg.id} message={msg} onSuggestedQueryClick={onSendMessage} />
              ))
            )}
            {/* 스크롤 약커 */}
            <div ref={messagesEndRef} className="h-px" aria-hidden="true" />
          </div>
        </div>
      </main>
      
      {/* 📝 입력 영역 (접근성 및 모바일 최적화) */}
      <footer className="border-t border-border bg-background flex-shrink-0">
        <div className="p-3 sm:p-4">
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
                disabled={isLoading}
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
              disabled={isLoading || !userQuery.trim()}
              size="md"
              className="px-3 sm:px-4 flex-shrink-0"
              aria-label="메시지 전송"
              loading={isLoading}
            >
              {!isLoading && <Send size={16} className="sm:size-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatInterface;