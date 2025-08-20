/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage, MessageSender } from '../types';
import { Link } from 'lucide-react';

const renderer = new Renderer();
renderer.code = ({ text: code, lang }) => {
  const language = hljs.getLanguage(lang || '') ? lang || '' : 'plaintext';
  const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
}
marked.use({ renderer });

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
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
        </div>
      );
    }
    if (!hasTextContent) return null;

    const proseClasses = "prose prose-sm max-w-none";
    const rawMarkup = marked.parse(message.text || "") as string;
    return <div className={proseClasses} dangerouslySetInnerHTML={{ __html: rawMarkup }} />;
  };

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-model'} shadow-sm`}>
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
                {message.followUpQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSuggestedQueryClick(q)}
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