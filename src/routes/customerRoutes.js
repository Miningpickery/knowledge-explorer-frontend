const express = require('express');
const router = express.Router();
const { 
  saveConversationContext, 
  getConversationContext, 
  updateConversationContext, 
  deleteConversationContext 
} = require('../services/contextService');

const { 
  saveFeedback, 
  getFeedbackByChat, 
  getFeedbackStats, 
  getRecentFeedback, 
  deleteFeedback 
} = require('../services/feedbackService');

const { 
  createIssue, 
  updateIssueStatus, 
  getIssuesByStatus, 
  getUrgentIssues, 
  getIssueStats, 
  deleteIssue 
} = require('../services/issueService');

const { 
  generateConversationSummary, 
  analyzeCustomerSatisfaction, 
  analyzeCustomerBehavior, 
  analyzeIssueTrends 
} = require('../services/insightService');

// ===== 대화 컨텍스트 관리 =====

// POST /api/customer/context/:chatId - 대화 컨텍스트 저장
router.post('/context/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { context } = req.body;
    
    if (!context) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '컨텍스트 데이터가 필요합니다.',
          details: 'context 필드는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await saveConversationContext(chatId, context);
    res.status(201).json({ message: '대화 컨텍스트가 저장되었습니다.' });
  } catch (error) {
    console.error('Error saving conversation context:', error);
    res.status(500).json({
      error: {
        code: 'CONTEXT_ERROR',
        message: '대화 컨텍스트 저장 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/context/:chatId - 대화 컨텍스트 조회
router.get('/context/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const context = await getConversationContext(chatId);
    res.json(context);
  } catch (error) {
    console.error('Error getting conversation context:', error);
    res.status(500).json({
      error: {
        code: 'CONTEXT_ERROR',
        message: '대화 컨텍스트 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/customer/context/:chatId - 대화 컨텍스트 업데이트
router.put('/context/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { context } = req.body;
    
    if (!context) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '업데이트할 컨텍스트 데이터가 필요합니다.',
          details: 'context 필드는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const updatedContext = await updateConversationContext(chatId, context);
    res.json(updatedContext);
  } catch (error) {
    console.error('Error updating conversation context:', error);
    res.status(500).json({
      error: {
        code: 'CONTEXT_ERROR',
        message: '대화 컨텍스트 업데이트 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 고객 피드백 관리 =====

// POST /api/customer/feedback - 피드백 저장
router.post('/feedback', async (req, res) => {
  try {
    const { chatId, messageId, rating, feedbackText, feedbackType = 'general' } = req.body;
    
    if (!chatId || !messageId || !rating) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '필수 필드가 누락되었습니다.',
          details: 'chatId, messageId, rating은 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const feedback = await saveFeedback(chatId, messageId, rating, feedbackText, feedbackType);
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({
      error: {
        code: 'FEEDBACK_ERROR',
        message: '피드백 저장 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/feedback/chat/:chatId - 채팅별 피드백 조회
router.get('/feedback/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const feedback = await getFeedbackByChat(chatId);
    res.json(feedback);
  } catch (error) {
    console.error('Error getting feedback by chat:', error);
    res.status(500).json({
      error: {
        code: 'FEEDBACK_ERROR',
        message: '피드백 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/feedback/stats - 피드백 통계
router.get('/feedback/stats', async (req, res) => {
  try {
    const stats = await getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({
      error: {
        code: 'FEEDBACK_ERROR',
        message: '피드백 통계 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 고객 이슈 관리 =====

// POST /api/customer/issues - 이슈 생성
router.post('/issues', async (req, res) => {
  try {
    const { chatId, issueType, priority, description, assignedTo } = req.body;
    
    if (!chatId || !issueType || !priority || !description) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '필수 필드가 누락되었습니다.',
          details: 'chatId, issueType, priority, description은 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const issue = await createIssue(chatId, issueType, priority, description, assignedTo);
    res.status(201).json(issue);
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({
      error: {
        code: 'ISSUE_ERROR',
        message: '이슈 생성 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/customer/issues/:issueId - 이슈 상태 업데이트
router.put('/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status, assignedTo } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '상태 정보가 필요합니다.',
          details: 'status 필드는 필수입니다.'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const issue = await updateIssueStatus(issueId, status, assignedTo);
    res.json(issue);
  } catch (error) {
    console.error('Error updating issue status:', error);
    res.status(500).json({
      error: {
        code: 'ISSUE_ERROR',
        message: '이슈 상태 업데이트 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/issues - 이슈 목록 조회
router.get('/issues', async (req, res) => {
  try {
    const { status } = req.query;
    const issues = await getIssuesByStatus(status);
    res.json(issues);
  } catch (error) {
    console.error('Error getting issues:', error);
    res.status(500).json({
      error: {
        code: 'ISSUE_ERROR',
        message: '이슈 목록 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/issues/urgent - 긴급 이슈 조회
router.get('/issues/urgent', async (req, res) => {
  try {
    const issues = await getUrgentIssues();
    res.json(issues);
  } catch (error) {
    console.error('Error getting urgent issues:', error);
    res.status(500).json({
      error: {
        code: 'ISSUE_ERROR',
        message: '긴급 이슈 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===== 고객 인사이트 및 분석 =====

// GET /api/customer/insights/summary/:chatId - 대화 요약
router.get('/insights/summary/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const summary = await generateConversationSummary(chatId);
    res.json(summary);
  } catch (error) {
    console.error('Error generating conversation summary:', error);
    res.status(500).json({
      error: {
        code: 'INSIGHT_ERROR',
        message: '대화 요약 생성 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/insights/satisfaction/:chatId - 고객 만족도 분석
router.get('/insights/satisfaction/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const satisfaction = await analyzeCustomerSatisfaction(chatId);
    res.json(satisfaction);
  } catch (error) {
    console.error('Error analyzing customer satisfaction:', error);
    res.status(500).json({
      error: {
        code: 'INSIGHT_ERROR',
        message: '고객 만족도 분석 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/insights/behavior - 고객 행동 패턴 분석
router.get('/insights/behavior', async (req, res) => {
  try {
    const { userId } = req.query;
    const behavior = await analyzeCustomerBehavior(userId);
    res.json(behavior);
  } catch (error) {
    console.error('Error analyzing customer behavior:', error);
    res.status(500).json({
      error: {
        code: 'INSIGHT_ERROR',
        message: '고객 행동 패턴 분석 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/customer/insights/trends - 이슈 트렌드 분석
router.get('/insights/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await analyzeIssueTrends(parseInt(days));
    res.json(trends);
  } catch (error) {
    console.error('Error analyzing issue trends:', error);
    res.status(500).json({
      error: {
        code: 'INSIGHT_ERROR',
        message: '이슈 트렌드 분석 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
