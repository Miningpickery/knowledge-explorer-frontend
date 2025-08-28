const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MessageSender, createGroundedResponse, createGroundingSource } = require('../types');
const { generatePrompt, validatePromptStructure } = require('../prompts/chatPrompt');

// Gemini API 키 설정 및 검증
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === 'your_gemini_api_key_here' || API_KEY === 'placeholder_gemini_api_key') {
  if (process.env.NODE_ENV === 'production') {
    console.error("❌ GEMINI_API_KEY가 설정되지 않았습니다. 프로덕션에서는 필수입니다.");
    throw new Error('GEMINI_API_KEY is required in production');
  } else {
    console.warn("⚠️ GEMINI_API_KEY가 설정되지 않았습니다. API 호출이 제한될 수 있습니다.");
    console.warn("📝 .env 파일에 실제 Gemini API 키를 설정해주세요.");
  }
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = "gemini-2.5-flash";

// ========================================
// 🔄 대화 히스토리 처리
// ========================================

// 기존 프론트엔드와 정확히 동일한 mapMessagesToContent 함수
const mapMessagesToContent = (messages) => {
  const history = [];
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

// ========================================
// 🤖 채팅 세션 생성
// ========================================

// 기존 프론트엔드와 정확히 동일한 createChatSession 함수
const createChatSession = (history = []) => {
  const chat = genAI.getGenerativeModel({ model }).startChat({
    history: mapMessagesToContent(history),
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
    tools: [{ googleSearch: {} }],
  });
  
  return chat;
};

// ========================================
// 📤 메시지 전송 및 응답 처리
// ========================================

// 기존 프론트엔드와 정확히 동일한 sendMessage 함수
const sendMessage = async (chat, prompt) => {
  const startTime = Date.now();
  try {
    console.log(`🤖 Processing message: "${prompt.substring(0, 50)}..."`);
    
    // 통합된 프롬프트 생성
    const integratedPrompt = generatePrompt(prompt);
    
    // 프롬프트 구조 검증
    validatePromptStructure(integratedPrompt);
    
    const result = await chat.sendMessageStream(integratedPrompt);
    let rawText = '';
    
    // 스트리밍으로 응답 수집
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      rawText += chunkText;
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Response generated in ${processingTime}ms`);
    
    let answer = rawText;
    let followUpQuestions = [];

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

    // 답변을 문단 단위로 분할
    const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 0);
    
    // 맥락에 따라 추천 질문이 적절한지 판단
    if (followUpQuestions.length === 0) {
      console.log("No follow-up questions provided by model - this may be appropriate for the context.");
    } else if (followUpQuestions.length < 2) {
      console.warn("Model provided only one follow-up question. This may be sufficient for the context.");
    }
    
    // 추천 질문도 별도 메시지로 분리
    const followUpMessage = followUpQuestions.length > 0 
      ? `추천 질문:\n${followUpQuestions.map(q => `• ${q}`).join('\n')}`
      : '';

    // 맥락 기반 추천 질문 개선
    if (followUpQuestions.length > 0) {
      // 이전 대화에서 언급된 키워드나 주제를 기반으로 질문 개선
      const recentMessages = chat?.history?.slice(-3) || []; // 최근 3개 메시지
      const mentionedTopics = recentMessages
        .map(msg => msg.parts?.[0]?.text || '')
        .join(' ')
        .toLowerCase()
        .match(/\b(법률|채권|회수|소송|사무소|서비스|비용|절차|강제집행|화해|합의|기술|ESG|소액|전문성|추심|민사집행)\b/g) || [];

      if (mentionedTopics.length > 0) {
        const topicBasedQuestions = mentionedTopics.slice(0, 2).map(topic => {
          const topicMap = {
            '법률': '이 법률 서비스의 구체적인 절차는 어떻게 되나요?',
            '채권': '채권 회수 과정에서 주의해야 할 점은 무엇인가요?',
            '회수': '채권 회수 성공률은 어느 정도인가요?',
            '소송': '소송 전 화해가 가능한 경우는 언제인가요?',
            '사무소': '이 사무소의 다른 전문 분야는 무엇인가요?',
            '서비스': '서비스 이용 비용은 어떻게 계산되나요?',
            '비용': '소액 채권자도 부담할 수 있는 비용인가요?',
            '절차': '전체 절차는 얼마나 걸리나요?',
            '강제집행': '강제집행은 언제 가능한가요?',
            '화해': '화해 과정에서 중재 역할을 하나요?',
            '합의': '합의 조건은 어떻게 정해지나요?',
            '기술': '어떤 기술을 활용하고 있나요?',
            'ESG': 'ESG 철학이 어떻게 반영되나요?',
            '소액': '소액 채권자도 도움을 받을 수 있나요?',
            '전문성': '어떤 분야에서 전문성을 가지고 있나요?',
            '추심': '추심 과정의 어려움은 무엇인가요?',
            '민사집행': '민사집행과 형사처벌의 차이점은 무엇인가요?'
          };
          return topicMap[topic] || `이 ${topic}에 대해 더 자세히 알고 싶으신가요?`;
        });

        // 기존 질문과 맥락 기반 질문을 조합
        const combined = [...followUpQuestions, ...topicBasedQuestions];
        followUpQuestions = Array.from(new Set(combined)).slice(0, 3);
      }
    }

    // 기존 프론트엔드와 동일한 sources 처리
    const groundingChunks = result.response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks
      ?.map((chunk) => createGroundingSource(
        chunk.web?.uri || '',
        chunk.web?.title || 'Untitled'
      ))
      .filter(source => source.uri) ?? [];
    
    const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
      
    return {
      paragraphs: paragraphs,
      followUpMessage: followUpMessage,
      followUpQuestions: followUpQuestions,
      sources: uniqueSources
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    let message = "응답을 가져오는 중 알 수 없는 오류가 발생했습니다.";
    if (error instanceof Error) {
      message = `AI로부터 응답을 받지 못했습니다: ${error.message}`;
    }
    return {
      paragraphs: [`죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. ${message}`],
      followUpMessage: "추천 질문:\n• 다시 시도해보시겠어요?\n• 다른 질문을 해보시겠어요?\n• 도움이 필요하시면 언제든 말씀해 주세요.",
      followUpQuestions: ["다시 시도해보시겠어요?", "다른 질문을 해보시겠어요?", "도움이 필요하시면 언제든 말씀해 주세요."],
      sources: []
    };
  }
};

module.exports = {
  createChatSession,
  sendMessage,
  mapMessagesToContent
};
