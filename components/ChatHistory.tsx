/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ChatSession } from '../types';
import { Plus, MessageSquareText, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

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
    <div className="flex flex-col h-full bg-card">
      {/* 📁 헤더 영역 (모바일 우선) */}
      <div className="border-b border-border bg-card">
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-card-foreground text-balance">
              대화 기록
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              aria-label="새 대화 시작"
              className="flex-shrink-0"
            >
              <Plus size={18} className="sm:size-5" />
              <span className="sr-only">새 대화</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* 📜 대화 목록 (모바일 우선 스크롤) */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <div className="p-2 sm:p-3">
          {chats.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px] text-center">
              <div className="text-muted-foreground space-y-3">
                <MessageSquareText size={40} className="mx-auto opacity-50" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm text-balance">대화 기록이 없습니다</p>
                  <p className="text-xs text-pretty">새 대화를 시작해보세요!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => (
                <div key={chat.id} className="relative group">
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      "touch-manipulation",
                      activeChatId === chat.id 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground'
                    )}
                    aria-label={`대화 선택: ${chat.title || '새 대화'}`}
                  >
                    <MessageSquareText 
                      size={16} 
                      className="flex-shrink-0" 
                      aria-hidden="true" 
                    />
                    <span className="flex-1 truncate text-balance text-sm">
                      {chat.title || '새 대화'}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(e, chat.id)}
                    className={
                      "absolute right-2 top-1/2 -translate-y-1/2 " +
                      "opacity-0 group-hover:opacity-100 transition-opacity " +
                      "h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                    }
                    aria-label={`대화 삭제: ${chat.title || '새 대화'}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;