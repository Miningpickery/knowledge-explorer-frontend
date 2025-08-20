/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageSender, ChatSession } from './types';
import { createChatSession, sendMessage } from './services/geminiService';
import * as chatHistoryService from './services/chatHistoryService';
import ChatInterface from './components/ChatInterface';
import ChatHistory from './components/ChatHistory';
import { Chat } from '@google/genai';
import { Menu, X } from 'lucide-react';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [allChats, setAllChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const loadChats = useCallback(() => {
    const chats = chatHistoryService.getAllChats();
    setAllChats(chats);
    if (chats.length > 0) {
      const lastActiveId = localStorage.getItem('lastActiveChatId') || chats[0].id;
      handleSelectChat(lastActiveId);
    } else {
      handleNewChat();
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (activeChatId) {
      const activeChat = allChats.find(c => c.id === activeChatId);
      if (activeChat) {
        setMessages(activeChat.messages);
        setChat(createChatSession(activeChat.messages));
        localStorage.setItem('lastActiveChatId', activeChatId);
      }
    }
  }, [activeChatId, allChats]);

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || isLoading || !chat || !activeChatId) return;

    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: query,
      sender: MessageSender.USER,
    };
    
    // This is the state of messages before the current turn's user message.
    const messagesBeforeTurn = [...messages];
    
    const modelPlaceholderId = `model-${Date.now()}`;
    const modelPlaceholder: ChatMessage = {
      id: modelPlaceholderId,
      text: '생각 중...',
      sender: MessageSender.MODEL,
      isLoading: true,
    };

    // Update UI with user message and placeholder
    setMessages([...messagesBeforeTurn, userMessage, modelPlaceholder]);

    try {
      const response = await sendMessage(chat, query);
      
      const newModelMessages: ChatMessage[] = [];
      
      // Advanced chunking logic to handle paragraphs and lists
      const finalChunks: string[] = [];
      const preliminaryChunks = response.answer.split('\n\n').filter(chunk => chunk.trim() !== '');
      for (const chunk of preliminaryChunks) {
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        const isList = lines.length > 1 && lines.some(line => /^\s*(\*\*|[-*]|\d+\.)/.test(line.trim()));
        if (isList) {
          finalChunks.push(...lines);
        } else {
          finalChunks.push(chunk);
        }
      }
      const answerChunks = finalChunks;
      
      if (answerChunks.length === 0 && response.answer.trim()) {
        answerChunks.push(response.answer.trim());
      }

      if (answerChunks.length === 0) {
        newModelMessages.push({
          id: `model-${Date.now()}`,
          text: "이 질문에 대한 답변을 찾지 못했습니다.",
          sender: MessageSender.MODEL,
          sources: response.sources,
        });
      } else {
        for (let i = 0; i < answerChunks.length; i++) {
          const chunk = answerChunks[i];
          const isLastChunk = i === answerChunks.length - 1;
          
          const chunkMessage: ChatMessage = {
            id: `model-chunk-${Date.now()}-${i}`,
            text: chunk,
            sender: MessageSender.MODEL,
            sources: isLastChunk ? response.sources : undefined,
          };
          
          newModelMessages.push(chunkMessage);

          // Progressively update UI state for streaming effect
          setMessages([...messagesBeforeTurn, userMessage, ...newModelMessages]);
          
          if (!isLastChunk) {
            await sleep(1000);
          }
        }
      }

      if (response.followUpQuestions && response.followUpQuestions.length > 0) {
        await sleep(1000);
        const followUpMessage: ChatMessage = {
          id: `model-followup-${Date.now()}`,
          text: '',
          sender: MessageSender.MODEL,
          followUpQuestions: response.followUpQuestions,
        };
        newModelMessages.push(followUpMessage);
        // Update UI with follow-up questions
        setMessages([...messagesBeforeTurn, userMessage, ...newModelMessages]);
      }
      
      // Persist the final, complete history for this turn
      const finalMessages = [...messagesBeforeTurn, userMessage, ...newModelMessages];
      chatHistoryService.updateChat(activeChatId, { messages: finalMessages });
      setAllChats(chatHistoryService.getAllChats());

    } catch (e: any) {
      const errorMessage: ChatMessage = {
        id: modelPlaceholderId,
        text: `오류: ${e.message || 'AI로부터 응답을 받지 못했습니다.'}`,
        sender: MessageSender.MODEL,
        isLoading: false,
      };
      setMessages(prev => {
        const updated = prev.map(msg => msg.id === modelPlaceholderId ? errorMessage : msg);
        chatHistoryService.updateChat(activeChatId, { messages: updated });
        setAllChats(chatHistoryService.getAllChats());
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const welcomeMessage: ChatMessage = {
      id: 'initial-welcome',
      text: "안녕하세요! 저는 당신의 지식 탐험가입니다. 오늘은 어떤 주제를 탐험해볼까요?",
      sender: MessageSender.MODEL,
    };
    const newChat = chatHistoryService.createNewChat([welcomeMessage]);
    setAllChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };
  
  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
  };
  
  const handleDeleteChat = (id: string) => {
    chatHistoryService.deleteChat(id);
    const remainingChats = allChats.filter(c => c.id !== id);
    setAllChats(remainingChats);
    if (activeChatId === id) {
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  return (
    <div className="flex h-screen max-h-screen antialiased bg-[#F5F1E9] font-sans">
      <ChatHistory 
        chats={allChats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col relative">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-2 left-2 z-20 p-2 rounded-md hover:bg-black/10 transition-colors md:hidden"
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default App;