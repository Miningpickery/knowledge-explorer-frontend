const express = require('express');
const router = express.Router();
const { 
  getOverallStats, 
  getDailyStats, 
  getLongestChats, 
  getActiveHours, 
  getUserStats, 
  getPopularKeywords 
} = require('../services/analyticsService');

// GET /api/analytics/overall - 전체 통계
router.get('/overall', async (req, res) => {
  try {
    const stats = await getOverallStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting overall stats:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '전체 통계를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/daily - 일별 통계
router.get('/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await getDailyStats(parseInt(days));
    res.json(stats);
  } catch (error) {
    console.error('Error getting daily stats:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '일별 통계를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/longest-chats - 가장 긴 대화
router.get('/longest-chats', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const chats = await getLongestChats(parseInt(limit));
    res.json(chats);
  } catch (error) {
    console.error('Error getting longest chats:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '가장 긴 대화 목록을 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/active-hours - 활발한 시간대
router.get('/active-hours', async (req, res) => {
  try {
    const hours = await getActiveHours();
    res.json(hours);
  } catch (error) {
    console.error('Error getting active hours:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '활발한 시간대 통계를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/users/:userId - 사용자별 통계
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '사용자 통계를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/keywords - 인기 키워드
router.get('/keywords', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const keywords = await getPopularKeywords(parseInt(limit));
    res.json(keywords);
  } catch (error) {
    console.error('Error getting popular keywords:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: '인기 키워드를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
