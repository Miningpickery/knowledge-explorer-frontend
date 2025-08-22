// 기존 프론트엔드 types.ts와 정확히 동일한 구조
const MessageSender = {
  USER: 'user',
  MODEL: 'model'
};

// GroundingSource 인터페이스와 동일
const createGroundingSource = (uri, title) => ({
  uri,
  title
});

// ChatMessage 인터페이스와 동일
const createChatMessage = (id, text, sender, options = {}) => ({
  id,
  text,
  sender,
  isLoading: options.isLoading || false,
  sources: options.sources || [],
  followUpQuestions: options.followUpQuestions || []
});

// ChatSession 인터페이스와 동일
const createChatSession = (id, title, messages = []) => ({
  id,
  title,
  messages
});

// GroundedResponse 인터페이스 (geminiService.ts에서 사용)
const createGroundedResponse = (answer, followUpQuestions = [], sources = []) => ({
  answer,
  followUpQuestions,
  sources
});

module.exports = {
  MessageSender,
  createGroundingSource,
  createChatMessage,
  createChatSession,
  createGroundedResponse
};
