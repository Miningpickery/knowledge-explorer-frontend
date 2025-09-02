import React, { useState } from 'react';
import { Plus, Trash2, MessageCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

interface ChatSidebarProps {
  chats: any[];
  activeChatId: string | null;
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onUpdateChatTitle?: (id: string, newTitle: string) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onUpdateChatTitle,
  isLoading = false,
  isDarkMode = false
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const handleEditTitle = (chat: any) => {
    setEditingChatId(chat.chat_id);
    setEditingTitle(chat.title || '새 대화');
  };

  const handleSaveTitle = async () => {
    if (editingChatId && editingTitle.trim() && onUpdateChatTitle) {
      await onUpdateChatTitle(editingChatId, editingTitle.trim());
    }
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 새 대화 버튼 */}
      <div className="p-4 border-b border-border bg-card">
        <Button
          onClick={onNewChat}
          disabled={isLoading}
          variant="primary"
          size="sm"
          className="w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>새 대화</span>
        </Button>
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 sidebar-scroll">
        {chats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">대화를 시작해보세요</p>
          </div>
        ) : (
          chats.map((chat, index) => (
            <div
              key={chat.chat_id}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-all duration-200",
                "hover:bg-secondary hover:shadow-soft",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                activeChatId === chat.chat_id
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-card text-card-foreground"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ ChatSidebar에서 채팅 클릭됨:', chat.chat_id);
                console.log('🔍 onChatSelect 함수:', onChatSelect);
                console.log('🔍 이벤트 타겟:', e.target);
                console.log('🔍 이벤트 타입:', e.type);
                onChatSelect(chat.chat_id);
              }}
              onMouseDown={(e) => {
                console.log('🖱️ 마우스 다운 이벤트:', chat.chat_id);
              }}
              onMouseUp={(e) => {
                console.log('🖱️ 마우스 업 이벤트:', chat.chat_id);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {editingChatId === chat.chat_id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={handleKeyPress}
                      className={cn(
                        "text-sm font-medium bg-transparent border-none outline-none w-full",
                        "text-gray-900 dark:text-gray-100", // 🎨 명시적인 텍스트 색상
                        "placeholder:text-gray-500 dark:placeholder:text-gray-400", // 🎨 placeholder 색상
                        activeChatId === chat.chat_id
                          ? "text-primary-foreground"
                          : "text-card-foreground"
                      )}
                      placeholder="채팅방 제목을 입력하세요"
                      autoFocus
                    />
                  ) : (
                    <h3 
                      className={cn(
                        "text-sm font-medium truncate cursor-pointer",
                        activeChatId === chat.chat_id
                          ? "text-primary-foreground"
                          : "text-card-foreground"
                      )}
                      onDoubleClick={() => handleEditTitle(chat)}
                      title="더블클릭하여 제목 수정"
                    >
                      {chat.title || '새로운 대화'}
                    </h3>
                  )}
                  <p className={cn(
                    "text-xs truncate mt-1",
                    activeChatId === chat.chat_id
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}>
                    {chat.updated_at 
                      ? new Date(chat.updated_at).toLocaleDateString('ko-KR')
                      : '방금 전'
                    }
                  </p>
                </div>
                
                {/* 삭제 버튼 */}
                <div className="flex items-center gap-1">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       handleEditTitle(chat);
                     }}
                     className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                   >
                     ✏️
                   </button>
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       onDeleteChat(chat.chat_id);
                     }}
                     className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                   >
                     🗑️
                   </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
