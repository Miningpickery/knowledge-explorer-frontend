const express = require('express');
const router = express.Router();
const { 
  exportChatAsJSON, 
  exportChatAsText, 
  exportChatAsMarkdown, 
  exportAllChatsAsJSON 
} = require('../services/exportService');

// GET /api/export/chats/:chatId/json - 채팅을 JSON으로 내보내기
router.get('/chats/:chatId/json', async (req, res) => {
  try {
    const { chatId } = req.params;
    const data = await exportChatAsJSON(chatId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}.json"`);
    res.json(data);
  } catch (error) {
    console.error('Error exporting chat as JSON:', error);
    
    if (error.message === 'Chat not found') {
      res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화를 찾을 수 없습니다.',
          details: `chatId: ${req.params.chatId}`
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: {
          code: 'EXPORT_ERROR',
          message: '내보내기 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});

// GET /api/export/chats/:chatId/text - 채팅을 텍스트로 내보내기
router.get('/chats/:chatId/text', async (req, res) => {
  try {
    const { chatId } = req.params;
    const data = await exportChatAsText(chatId);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}.txt"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting chat as text:', error);
    
    if (error.message === 'Chat not found') {
      res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화를 찾을 수 없습니다.',
          details: `chatId: ${req.params.chatId}`
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: {
          code: 'EXPORT_ERROR',
          message: '내보내기 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});

// GET /api/export/chats/:chatId/markdown - 채팅을 마크다운으로 내보내기
router.get('/chats/:chatId/markdown', async (req, res) => {
  try {
    const { chatId } = req.params;
    const data = await exportChatAsMarkdown(chatId);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}.md"`);
    res.send(data);
  } catch (error) {
    console.error('Error exporting chat as markdown:', error);
    
    if (error.message === 'Chat not found') {
      res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화를 찾을 수 없습니다.',
          details: `chatId: ${req.params.chatId}`
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: {
          code: 'EXPORT_ERROR',
          message: '내보내기 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});

// GET /api/export/chats/all/json - 모든 채팅을 JSON으로 내보내기
router.get('/chats/all/json', async (req, res) => {
  try {
    const data = await exportAllChatsAsJSON();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="all-chats-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(data);
  } catch (error) {
    console.error('Error exporting all chats as JSON:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: '모든 대화 내보내기 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
