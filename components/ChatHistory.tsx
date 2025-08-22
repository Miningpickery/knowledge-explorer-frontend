/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ChatSession } from '../types';
import { Plus, MessageSquareText, Trash2 } from 'lucide-react';

interface ChatHistoryProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}) => {

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('이 대화를 삭제하시겠습니까?')) {
      onDeleteChat(id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">대화 기록</h2>
          <button
            onClick={onNewChat}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="새 대화 시작"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {chats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquareText size={48} className="mx-auto mb-4 opacity-50" />
              <p>대화 기록이 없습니다</p>
              <p className="text-sm">새 대화를 시작해보세요!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-colors group
                    ${activeChatId === chat.id 
                      ? 'bg-[#D55C2D] text-white shadow-sm' 
                      : 'hover:bg-gray-50 text-gray-700'
                    }
                  `}
                >
                  <MessageSquareText size={16} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{chat.title}</span>
                  <Trash2 
                    size={16} 
                    className={`
                      flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity
                      ${activeChatId === chat.id ? 'opacity-60 hover:opacity-100' : 'hover:opacity-100'}
                    `}
                    onClick={(e) => handleDelete(e, chat.id)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;