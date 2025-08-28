// ============================================================================
// MEMORY ROUTES - 사용자별 장기메모리 관리
// ============================================================================

const express = require('express');
const router = express.Router();
const memoryService = require('../services/memoryService');
const { authenticateToken } = require('../middleware/auth');

// 사용자의 모든 메모리 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const memories = await memoryService.getUserMemories(req.user.userId, parseInt(limit));
    
    res.json({
      success: true,
      data: memories
    });
  } catch (error) {
    console.error('❌ 메모리 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_FETCH_FAILED',
        message: '메모리 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 특정 메모리 조회
router.get('/:memoryId', authenticateToken, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const memory = await memoryService.getMemoryById(memoryId, req.user.userId);
    
    if (!memory) {
      return res.status(404).json({
        error: {
          code: 'MEMORY_NOT_FOUND',
          message: '메모리를 찾을 수 없습니다.',
          details: '메모리 ID가 유효하지 않거나 접근 권한이 없습니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: memory
    });
  } catch (error) {
    console.error('❌ 메모리 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_FETCH_FAILED',
        message: '메모리 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 새 메모리 생성
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memory_type, title, content, importance, tags, chat_id } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        error: {
          code: 'INVALID_MEMORY_DATA',
          message: '메모리 데이터가 유효하지 않습니다.',
          details: '제목과 내용은 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const memoryData = {
      memory_type: memory_type || 'conversation',
      title,
      content,
      importance: importance || 1,
      tags: tags || [],
      chat_id
    };
    
    const memory = await memoryService.createMemory(req.user.userId, memoryData);
    
    res.status(201).json({
      success: true,
      data: memory,
      message: '메모리가 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('❌ 메모리 생성 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_CREATION_FAILED',
        message: '메모리 생성 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 메모리 업데이트
router.put('/:memoryId', authenticateToken, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { title, content, importance, tags } = req.body;
    
    const updates = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (importance !== undefined) updates.importance = importance;
    if (tags) updates.tags = tags;
    
    const memory = await memoryService.updateMemory(memoryId, req.user.userId, updates);
    
    res.json({
      success: true,
      data: memory,
      message: '메모리가 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('❌ 메모리 업데이트 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_UPDATE_FAILED',
        message: '메모리 업데이트 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 메모리 삭제
router.delete('/:memoryId', authenticateToken, async (req, res) => {
  try {
    const { memoryId } = req.params;
    await memoryService.deleteMemory(memoryId, req.user.userId);
    
    res.json({
      success: true,
      message: '메모리가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('❌ 메모리 삭제 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_DELETION_FAILED',
        message: '메모리 삭제 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 메모리 통계 조회
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await memoryService.getMemoryStats(req.user.userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ 메모리 통계 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_STATS_FAILED',
        message: '메모리 통계 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 태그별 메모리 검색
router.get('/search/tags', authenticateToken, async (req, res) => {
  try {
    const { tags } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        error: {
          code: 'TAGS_MISSING',
          message: '검색할 태그가 필요합니다.',
          details: 'tags 쿼리 파라미터를 제공해주세요.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const memories = await memoryService.searchMemoriesByTags(req.user.userId, tagArray);
    
    res.json({
      success: true,
      data: memories
    });
  } catch (error) {
    console.error('❌ 태그별 메모리 검색 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_SEARCH_FAILED',
        message: '메모리 검색 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 채팅 종료 시 자동 메모리 생성
router.post('/extract/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { conversationContext } = req.body;
    
    if (!conversationContext || !Array.isArray(conversationContext)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CONTEXT',
          message: '대화 컨텍스트가 유효하지 않습니다.',
          details: 'conversationContext는 배열 형태여야 합니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const memory = await memoryService.extractAndSaveMemory(
      req.user.userId, 
      chatId, 
      conversationContext
    );
    
    res.json({
      success: true,
      data: memory,
      message: memory ? '대화 요약 메모리가 생성되었습니다.' : '추출할 핵심 내용이 없습니다.'
    });
  } catch (error) {
    console.error('❌ 메모리 추출 실패:', error);
    res.status(500).json({
      error: {
        code: 'MEMORY_EXTRACTION_FAILED',
        message: '메모리 추출 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
