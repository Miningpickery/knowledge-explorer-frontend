/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import MessageItem from './MessageItem';
import { Send } from 'lucide-react';

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
      <header className="bg-[#D55C2D] text-white p-4 text-center shadow-md z-10 flex-shrink-0">
        <h1 className="text-xl font-bold">지식 탐험가</h1>
      </header>
      
      <main className="flex-grow p-4 overflow-y-auto chat-container" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="space-y-6 pb-4">
          {safeMessages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>새로운 대화를 시작해보세요!</p>
              <p className="text-sm mt-2">무엇이든 물어보시면 도와드리겠습니다.</p>
            </div>
          ) : (
            safeMessages.map((msg) => (
              <MessageItem key={msg.id} message={msg} onSuggestedQueryClick={onSendMessage} />
            ))
          )}
        </div>
        <div ref={messagesEndRef} />
      </main>
      
      <footer className="bg-[#F5F6F8] p-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <textarea
            id="message-input"
            name="message"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="무엇이든 물어보세요..."
            className="flex-grow p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-[#D55C2D] focus:border-transparent transition-shadow text-sm"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !userQuery.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-md text-white bg-[#D55C2D] disabled:bg-gray-400 transition-colors flex-shrink-0"
            aria-label="메시지 보내기"
          >
            {isLoading ? 
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
              : <Send size={20} />
            }
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatInterface;