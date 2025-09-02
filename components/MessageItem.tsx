/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Link } from 'lucide-react';
import { Streamdown } from 'streamdown';

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

enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}

interface MessageItemProps {
  message: ChatMessage;
  onSuggestedQueryClick: (query: string) => void;
  isDarkMode?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onSuggestedQueryClick, isDarkMode = false }) => {
  // 디버깅 로그 제거 (무한루프 방지)
  // console.log('🔍 MessageItem 렌더링:', {
  //   messageId: message.message_id,
  //   text: message.text,
  //   sender: message.sender,
  //   timestamp: message.timestamp,
  //   isStreaming: message.isStreaming,
  //   isLoading: message.isLoading
  // });
  
  const isUser = message.sender === MessageSender.USER;
  const hasTextContent = !!message.text?.trim();
  const hasSources = !!message.sources && message.sources.length > 0;

  const renderMessageContent = () => {
    if (message.isLoading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s] bg-primary"></div>
            <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s] bg-primary"></div>
            <div className="w-2 h-2 rounded-full animate-bounce bg-primary"></div>
          </div>
          <span className="text-sm text-foreground font-medium">{message.text}</span>
        </div>
      );
    }
    
    if (message.isStreaming && message.text) {
      return (
        <div className="text-sm">
          <Streamdown 
            parseIncompleteMarkdown={true}
            className="prose prose-sm max-w-none"
          >
            {message.text}
          </Streamdown>
          <span className="inline-block w-1 h-4 ml-1 animate-pulse rounded-sm bg-primary"></span>
        </div>
      );
    }
    if (!hasTextContent) return null;

    // 추천 질문 메시지인지 확인
    const isFollowUpMessage = message.text.includes('추천 질문:');
    
    if (isFollowUpMessage) {
      // 추천 질문을 파싱 (| 구분자로 분리)
      const questionText = message.text.replace('추천 질문:', '').trim();
      const followUpQuestions = questionText.split('|').map(q => q.trim()).filter(q => q);
      
      return (
        <div className="my-4">
          {/* 추천 질문 헤더 */}
          <div className="flex items-center mb-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full mr-2 bg-primary">
              <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-foreground">이런 질문은 어떠세요?</h4>
          </div>
          
          {/* 추천 질문 버튼들 - 한 줄에 1개씩 */}
          <div className="space-y-1.5">
            {followUpQuestions.map((question, index) => (
              <button
                key={`followup-${index}-${question.substring(0, 10)}`}
                onClick={() => onSuggestedQueryClick && onSuggestedQueryClick(question)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-left text-xs text-card-foreground hover:border-primary hover:shadow-soft transition-all duration-200 hover:bg-secondary"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // 일반 텍스트 메시지
    return (
      <div className="text-sm">
        <Streamdown 
          parseIncompleteMarkdown={true}
          className="prose prose-sm max-w-none"
        >
          {message.text}
        </Streamdown>
      </div>
    );
  };

  // 소스 링크 렌더링
  const renderSources = () => {
    if (!hasSources) return null;

    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <Link className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">참고 자료</span>
        </div>
        <div className="space-y-1">
          {message.sources?.map((source, index) => (
            <a
              key={`source-${index}-${source.substring(0, 20)}`}
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-primary hover:text-primary/80 transition-colors duration-200"
            >
              {source}
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 w-full`}>
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-model'} max-w-[75%]`}>
        {renderMessageContent()}
        {renderSources()}
      </div>
    </div>
  );
};

export default MessageItem;