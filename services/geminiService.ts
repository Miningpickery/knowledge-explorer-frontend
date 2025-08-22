/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GroundingSource, ChatMessage } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

interface GroundedResponse {
  answer: string;
  followUpQuestions: string[];
  sources: GroundingSource[];
}

export const createChatSession = (history: ChatMessage[] = []): any => {
  // This is now a mock function since we'll use the backend API
  return { history };
};

export const sendMessage = async (prompt: string, chatId: string): Promise<GroundedResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      answer: result.answer,
      followUpQuestions: result.followUpQuestions || [],
      sources: result.sources || [],
    };

  } catch (error) {
    console.error("Error calling backend API:", error);
    let message = "응답을 가져오는 중 알 수 없는 오류가 발생했습니다.";
    if (error instanceof Error) {
        message = `AI로부터 응답을 받지 못했습니다: ${error.message}`;
    }
    return {
        answer: `죄송합니다. 오류가 발생했습니다. ${message}`,
        followUpQuestions: [],
        sources: [],
    };
  }
};