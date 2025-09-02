/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ChatSession, ChatMessage, MessageSender } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

// Helper to get the initial title from the first user message
const getTitleFromMessages = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(m => m.sender === MessageSender.USER);
  if (firstUserMessage) {
    return firstUserMessage.text.substring(0, 30);
  }
  return "새 대화";
};

export const getAllChats = async (): Promise<ChatSession[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const chats = await response.json();
    return chats;
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

export const createNewChat = async (initialMessages: ChatMessage[] = []): Promise<ChatSession> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const newChat = await response.json();
    return newChat;
  } catch (error) {
    console.error("Failed to create new chat:", error);
    // Fallback to localStorage if API fails
    const fallbackChat: ChatSession = {
      chat_id: `chat-${Date.now()}`,
      title: getTitleFromMessages(initialMessages) || "새 대화",
      messages: initialMessages,
    };
    return fallbackChat;
  }
};

export const updateChat = async (chatId: string, updates: Partial<ChatSession>): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to update chat:", error);
    // Fallback to localStorage if API fails
    const CHAT_HISTORY_KEY = 'gemini_chat_history';
    try {
      const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
      if (historyJson) {
        const allChats = JSON.parse(historyJson) as ChatSession[];
        const chatIndex = allChats.findIndex(c => c.chat_id === chatId);
        
        if (chatIndex > -1) {
          const chatToUpdate = allChats[chatIndex];
          const shouldUpdateTitle = chatToUpdate.title === "새 대화" && updates.messages;
          
          const updatedChat: ChatSession = {
            ...chatToUpdate,
            ...updates,
            title: shouldUpdateTitle ? getTitleFromMessages(updates.messages!) : chatToUpdate.title,
          };
          
          allChats[chatIndex] = updatedChat;
          localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(allChats));
        }
      }
    } catch (localError) {
      console.error("Fallback localStorage update failed:", localError);
    }
  }
};

export const deleteChat = async (chatId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete chat:", error);
    // Fallback to localStorage if API fails
    const CHAT_HISTORY_KEY = 'gemini_chat_history';
    try {
      const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
      if (historyJson) {
        const allChats = JSON.parse(historyJson) as ChatSession[];
        const filteredChats = allChats.filter(c => c.chat_id !== chatId);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(filteredChats));
      }
    } catch (localError) {
      console.error("Fallback localStorage delete failed:", localError);
    }
  }
};
