const express = require('express');
const router = express.Router();
const { 
  searchMessages, 
  searchChatsByTitle, 
  globalSearch, 
  searchRecentChats 
} = require('../services/searchService');

// GET /api/search - 통합 검색
router.get('/', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '검색어를 입력해주세요.',
          details: 'q 파라미터는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const results = await globalSearch(query.trim(), parseInt(limit));
    res.json({
      query: query.trim(),
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: '검색 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/search/messages - 메시지 검색
router.get('/messages', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '검색어를 입력해주세요.',
          details: 'q 파라미터는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const results = await searchMessages(query.trim(), parseInt(limit));
    res.json({
      query: query.trim(),
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: '메시지 검색 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/search/chats - 채팅 제목 검색
router.get('/chats', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '검색어를 입력해주세요.',
          details: 'q 파라미터는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const results = await searchChatsByTitle(query.trim(), parseInt(limit));
    res.json({
      query: query.trim(),
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching chats:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: '채팅 검색 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/search/recent - 최근 대화 검색
router.get('/recent', async (req, res) => {
  try {
    const { q: query, days = 7, limit = 20 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '검색어를 입력해주세요.',
          details: 'q 파라미터는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const results = await searchRecentChats(query.trim(), parseInt(days), parseInt(limit));
    res.json({
      query: query.trim(),
      days: parseInt(days),
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching recent chats:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: '최근 대화 검색 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
