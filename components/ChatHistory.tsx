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
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  isOpen,
  setIsOpen,
}) => {

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('이 대화를 삭제하시겠습니까?')) {
      onDeleteChat(id);
    }
  };

  return (
    <>
      <div 
        className={`
          flex flex-col bg-[#EAE5DB] text-gray-800 transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64' : 'w-0'} 
          md:w-64 flex-shrink-0 h-screen
        `}
      >
        <div className="p-3 flex items-center justify-between border-b border-gray-300/60">
          <h2 className="text-lg font-semibold truncate">대화 기록</h2>
          <button
            onClick={onNewChat}
            className="p-2 rounded-md hover:bg-black/10 transition-colors"
            aria-label="새 대화 시작"
          >
            <Plus size={20} />
          </button>
        </div>
        <nav className="flex-grow overflow-y-auto sidebar-scroll">
          <ul className="py-2">
            {chats.map((chat) => (
              <li key={chat.id} className="px-2 mb-1">
                <button
                  onClick={() => onSelectChat(chat.id)}
                  className={`
                    w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors group
                    ${activeChatId === chat.id ? 'bg-[#D55C2D] text-white' : 'hover:bg-black/5'}
                  `}
                >
                  <MessageSquareText size={16} className="flex-shrink-0" />
                  <span className="flex-grow truncate">{chat.title}</span>
                  <Trash2 
                    size={16} 
                    className={`
                      flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity
                      ${activeChatId === chat.id ? 'opacity-60 hover:opacity-100' : 'hover:opacity-100'}
                    `}
                    onClick={(e) => handleDelete(e, chat.id)}
                  />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 bg-black/30 z-10 md:hidden"
        ></div>
      )}
    </>
  );
};

export default ChatHistory;