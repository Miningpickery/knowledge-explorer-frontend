/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ChatMessage, MessageSender } from '../types';
import { Link } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface MessageItemProps {
  message: ChatMessage;
  onSuggestedQueryClick: (query: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onSuggestedQueryClick }) => {
  const isUser = message.sender === MessageSender.USER;
  const hasTextContent = !!message.text?.trim();
  const hasSources = !!message.sources && message.sources.length > 0;

  const renderMessageContent = () => {
    if (message.isLoading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-[#D55C2D] rounded-full animate-bounce"></div>
          </div>
          <span className="text-sm text-gray-600 font-medium">{message.text}</span>
        </div>
      );
    }
    
    if (message.isStreaming) {
      return (
        <div className="text-sm">
          <Streamdown 
            parseIncompleteMarkdown={true}
            className="prose prose-sm max-w-none"
          >
            {message.text}
          </Streamdown>
          <span className="inline-block w-1 h-4 bg-[#D55C2D] ml-1 animate-pulse rounded-sm"></span>
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
        <div className="text-sm">
          <div className="bg-white border border-[#D55C2D] rounded-lg p-3 shadow-sm">
            <div className="flex items-center mb-2">
              <span className="text-[#D55C2D] mr-2">💡</span>
              <span className="text-sm font-medium text-gray-700">추천 질문</span>
            </div>
            <div className="space-y-2">
              {followUpQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestedQueryClick && onSuggestedQueryClick(question)}
                  className="w-full text-left px-3 py-2 bg-[#FFEFE6] text-[#C05621] rounded-md hover:bg-[#FBDAC8] transition-colors duration-200 text-xs"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    // 일반 텍스트 렌더링 (Streamdown으로 마크다운 처리)
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

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'} message-item`}>
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-model'} shadow-sm ${message.isLoading ? 'streaming-text' : ''}`}>
        {renderMessageContent()}
        
        {hasSources && (
          <div className={hasTextContent ? "mt-3 pt-2 border-t border-gray-200" : ""}>
            <h4 className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Link size={12} />
              출처
            </h4>
            <ul className="space-y-1">
              {message.sources!.map((source, index) => (
                <li key={index} className="text-xs">
                  <a 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[#C05621] hover:underline truncate block"
                    title={source.uri}
                  >
                    {source.title || source.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className={(hasTextContent || hasSources) ? "mt-3 pt-2 border-t border-gray-200/80" : ""}>
             <h4 className="text-xs font-semibold text-gray-600 mb-1.5">추천 질문:</h4>
             <div className="flex flex-wrap gap-1.5">
                {message.followUpQuestions?.filter(q => q && typeof q === 'string' && q.trim()).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSuggestedQueryClick(q.trim())}
                    className="bg-[#FFEFE6] text-[#C05621] px-2.5 py-1 rounded-full text-xs hover:bg-[#FBDAC8] transition-colors"
                  >
                    {q}
                  </button>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;