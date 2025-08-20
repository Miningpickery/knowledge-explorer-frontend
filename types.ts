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
  id: string;
  text: string;
  sender: MessageSender;
  isLoading?: boolean;
  sources?: GroundingSource[];
  followUpQuestions?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}
