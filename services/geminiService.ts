/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Chat, Content, Type } from "@google/genai";
import { GroundingSource, ChatMessage, MessageSender } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("Gemini API Key not configured. Set process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

interface GroundedResponse {
  answer: string;
  followUpQuestions: string[];
  sources: GroundingSource[];
}

const systemInstruction = `당신은 '지식 탐험가'라는 이름의 도움이 되고 친절한 AI 어시스턴트입니다. 당신의 목표는 실시간 Google 검색 결과를 바탕으로 명확하고 정확한 답변을 제공하는 것입니다. 당신은 대화의 맥락을 기억하고 후속 질문에 답변할 수 있습니다.

규칙:
1. 사용자의 질문을 신중하게 분석합니다.
2. 질문에 대한 포괄적인 답변을 마크다운 형식으로 제공합니다. 답변을 여러 개의 짧은 문단으로 나누어 주세요. 각 문단은 두 개의 줄 바꿈 문자(\\n\\n)로 구분해야 합니다.
3. 답변이 끝난 후, 반드시 다음 형식에 맞춰 후속 질문을 제공해야 합니다. 이는 **필수** 규칙입니다.
   - 먼저, 하이픈 세 개로 구성된 구분선(---)을 새 줄에 삽입합니다.
   - 구분선 다음에는, 사용자가 흥미를 가질 만한 관련 후속 질문을 **정확히 2개 이상** 제안해야 합니다.
   - 각 질문은 "추천 질문:" 이라는 접두사로 시작하고, 각 질문은 새 줄에 작성해야 합니다.

예시:
[답변 내용]
---
추천 질문: [첫 번째 질문]
추천 질문: [두 번째 질문]`;

const mapMessagesToContent = (messages: ChatMessage[]): Content[] => {
  const history: Content[] = [];
  const filteredMessages = messages.filter(
    msg => (msg.sender === MessageSender.USER || msg.sender === MessageSender.MODEL) &&
           msg.id !== 'initial-welcome' &&
           !msg.isLoading &&
           msg.text.trim() !== ''
  );

  for (const msg of filteredMessages) {
    const lastContent = history[history.length - 1];
    
    // If the last message was also from the model, merge the parts.
    // This handles the case where we split a single model response into multiple ChatMessage objects.
    if (lastContent && lastContent.role === 'model' && msg.sender === MessageSender.MODEL) {
      lastContent.parts.push({ text: msg.text });
    } else {
      // Otherwise, create a new content entry.
      history.push({
        role: msg.sender,
        parts: [{ text: msg.text }],
      });
    }
  }

  return history;
};

export const createChatSession = (history: ChatMessage[] = []): Chat => {
  const chat = ai.chats.create({
    model: model,
    history: mapMessagesToContent(history),
    config: {
      systemInstruction: systemInstruction,
      tools: [{ googleSearch: {} }],
    },
  });
  return chat;
};


export const sendMessage = async (chat: Chat, prompt: string): Promise<GroundedResponse> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });

    const rawText = response.text;
    
    let answer = rawText;
    let followUpQuestions: string[] = [];

    const parts = rawText.split('\n---\n');
    if (parts.length > 1) {
      answer = parts[0].trim();
      followUpQuestions = parts[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('추천 질문:'))
        .map(line => line.replace('추천 질문:', '').trim())
        .filter(q => q); // Ensure not empty
    }

    // Fallback if the model fails to provide at least 2 questions
    if (followUpQuestions.length < 2) {
      console.warn("Model did not provide enough follow-up questions. Generating them with a fallback.");

      const fallbackPrompt = `사용자의 질문과 AI의 답변을 바탕으로 관련 후속 질문 2개를 생성해주세요.
질문: "${prompt}"
답변: "${answer}"`;

      try {
        const fallbackResponse = await ai.models.generateContent({
            model: model,
            contents: fallbackPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "사용자가 궁금해할 만한 후속 질문 목록",
                },
            },
        });

        const jsonText = fallbackResponse.text.trim();
        const parsedQuestions = JSON.parse(jsonText);

        if (Array.isArray(parsedQuestions) && parsedQuestions.every(q => typeof q === 'string')) {
            const combined = [...followUpQuestions, ...parsedQuestions];
            followUpQuestions = Array.from(new Set(combined));
        }
      } catch (e) {
          console.error("Fallback for follow-up questions failed:", e);
          // If the robust fallback fails, do nothing and proceed with what we have.
      }
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSource[] = groundingChunks
      ?.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || 'Untitled',
      }))
      .filter(source => source.uri) ?? [];
    
    const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
      
    return { answer, followUpQuestions, sources: uniqueSources };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
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