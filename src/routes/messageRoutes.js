const express = require('express');
const router = express.Router();
const { MessageSender, createChatMessage } = require('../types');
const { createChatSession, sendMessage } = require('../services/geminiService');
const { getChatById, saveMessage, updateChat } = require('../services/chatHistoryService');

// POST /api/chats/:chatId/messages - 메시지 전송 및 AI 응답
router.post('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    // 요청 검증
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '메시지가 올바르지 않습니다.',
          details: 'message 필드는 비어있지 않은 문자열이어야 합니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 1. 기존 대화 세션 조회 (대화 맥락 유지를 위해)
    const chatSession = await getChatById(chatId);
    
    // 2. 사용자 메시지를 데이터베이스에 저장
    const userMessage = createChatMessage(
      `msg-${Date.now()}-user`,
      message.trim(),
      MessageSender.USER
    );
    
    await saveMessage(chatId, userMessage);
    
    // 3. 기존 프론트엔드와 동일한 방식으로 Gemini API 호출
    // 전체 대화 히스토리를 포함하여 대화 맥락 유지
    const chat = createChatSession(chatSession.messages);
    const response = await sendMessage(chat, message.trim());
    
    // 4. AI 응답을 데이터베이스에 저장
    const aiMessage = createChatMessage(
      `msg-${Date.now()}-model`,
      response.answer,
      MessageSender.MODEL,
      {
        sources: response.sources,
        followUpQuestions: response.followUpQuestions
      }
    );
    
    await saveMessage(chatId, aiMessage);
    
    // 5. 대화 세션 업데이트 (제목 자동 생성 등)
    const updatedMessages = [...chatSession.messages, userMessage, aiMessage];
    await updateChat(chatId, { messages: updatedMessages });
    
    // 6. 기존 프론트엔드와 동일한 응답 형식 반환
    res.json({
      answer: response.answer,
      sources: response.sources,
      followUpQuestions: response.followUpQuestions
    });

  } catch (error) {
    console.error('Error sending message:', error);
    
    // 에러 타입에 따른 적절한 응답
    if (error.message === 'Chat session not found') {
      res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화 세션을 찾을 수 없습니다.',
          details: `chatId: ${req.params.chatId}`
        },
        timestamp: new Date().toISOString()
      });
    } else if (error.message.includes('Gemini API')) {
      res.status(500).json({
        error: {
          code: 'GEMINI_API_ERROR',
          message: 'AI 서비스에 연결할 수 없습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '메시지 전송 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});

module.exports = router;
