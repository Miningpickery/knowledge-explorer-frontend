/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ChatSession, ChatMessage, MessageSender } from '../types';

const CHAT_HISTORY_KEY = 'gemini_chat_history';

// Helper to get the initial title from the first user message
const getTitleFromMessages = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(m => m.sender === MessageSender.USER);
  if (firstUserMessage) {
    return firstUserMessage.text.substring(0, 30);
  }
  return "새 대화";
};

export const getAllChats = (): ChatSession[] => {
  try {
    const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!historyJson) return [];
    const chats = JSON.parse(historyJson) as ChatSession[];
    // Sort by the timestamp in the ID, descending (newest first)
    return chats.sort((a, b) => {
        const timeA = parseInt(a.id.split('-')[1]);
        const timeB = parseInt(b.id.split('-')[1]);
        return timeB - timeA;
    });
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

export const saveAllChats = (chats: ChatSession[]): void => {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
};

export const createNewChat = (initialMessages: ChatMessage[] = []): ChatSession => {
  const newChat: ChatSession = {
    id: `chat-${Date.now()}`,
    title: getTitleFromMessages(initialMessages) || "새 대화",
    messages: initialMessages,
  };

  const allChats = getAllChats();
  saveAllChats([newChat, ...allChats]);
  return newChat;
};

export const updateChat = (id: string, updates: Partial<ChatSession>): void => {
  let allChats = getAllChats();
  const chatIndex = allChats.findIndex(c => c.id === id);

  if (chatIndex > -1) {
    const chatToUpdate = allChats[chatIndex];
    
    // Check if the title needs to be updated (only if it's still the default)
    const shouldUpdateTitle = chatToUpdate.title === "새 대화" && updates.messages;
    
    const updatedChat: ChatSession = {
      ...chatToUpdate,
      ...updates,
      title: shouldUpdateTitle ? getTitleFromMessages(updates.messages!) : chatToUpdate.title,
    };
    
    allChats[chatIndex] = updatedChat;
    saveAllChats(allChats);
  }
};

export const deleteChat = (id: string): void => {
  const allChats = getAllChats();
  const filteredChats = allChats.filter(c => c.id !== id);
  saveAllChats(filteredChats);
};
