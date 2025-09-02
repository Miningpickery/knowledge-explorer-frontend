// 🔄 React Query Hooks
// 상용화 수준의 서버 상태 관리

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../services/httpClient';
import type { ChatSession, ChatMessage } from '../types';

/**
 * 📋 Chat Queries
 */
export function useChatsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await httpClient.get<ChatSession[]>('/api/chats');
      return response.data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    retry: 2,
  });
}

export function useChatMessagesQuery(chatId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];
      const response = await httpClient.get<{ messages: ChatMessage[] }>(`/api/chats/${chatId}`);
      return response.data?.messages || [];
    },
    enabled: enabled && !!chatId,
    staleTime: 2 * 60 * 1000, // 2분
    retry: 1,
  });
}

/**
 * 🔄 Chat Mutations
 */
export function useCreateChatMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await httpClient.post<ChatSession>('/api/chats');
      return response.data!;
    },
    onSuccess: (newChat) => {
      queryClient.setQueryData(['chats'], (old: ChatSession[] = []) => [newChat, ...old]);
    },
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ chatId, message }: { chatId: string; message: string }) => {
      const response = await httpClient.post(`/api/chats/${chatId}/messages`, { message });
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      // 메시지 목록 무효화하여 새로고침
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
    },
  });
}

export function useDeleteChatMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chatId: string) => {
      await httpClient.delete(`/api/chats/${chatId}`);
      return chatId;
    },
    onSuccess: (deletedChatId) => {
      queryClient.setQueryData(['chats'], (old: ChatSession[] = []) => 
        old.filter(chat => chat.chat_id !== deletedChatId)
      );
      queryClient.removeQueries({ queryKey: ['chat-messages', deletedChatId] });
    },
  });
}
