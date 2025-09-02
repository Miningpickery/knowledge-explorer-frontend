/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  message_id: string;  // 백엔드 Key와 통일
  text: string;
  sender: MessageSender;
  isLoading?: boolean;
  isStreaming?: boolean;
  sources?: GroundingSource[];
  followUpQuestions?: string[];
  timestamp?: string;
}

export interface ChatSession {
  chat_id: string;  // 백엔드 Key와 통일
  title: string;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}
