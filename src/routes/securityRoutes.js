// ============================================================================
// SECURITY ROUTES - 보안 위협 모니터링 API
// ============================================================================

const express = require('express');
const router = express.Router();
const securityService = require('../services/securityService');

// GET /api/security - 전체 보안 위협 조회 (페이지네이션 지원)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, threatType, severity, status } = req.query;
    const offset = (page - 1) * limit;
    
    // 보안 위협 조회 서비스 호출
    const threats = await securityService.getAllThreats({
      page: parseInt(page),
      limit: parseInt(limit),
      offset,
      threatType,
      severity,
      status
    });
    
    res.json({
      success: true,
      data: threats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: threats.length,
        hasMore: threats.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching security threats:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '보안 위협 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 보안 대시보드 데이터 조회
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await securityService.getSecurityDashboard();
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('❌ 보안 대시보드 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '보안 대시보드 조회 중 오류가 발생했습니다.'
    });
  }
});

// 최근 보안 위협 조회
router.get('/threats', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const threats = await securityService.getRecentThreats(limit);
    
    res.json({
      success: true,
      data: threats
    });
  } catch (error) {
    console.error('❌ 보안 위협 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '보안 위협 조회 중 오류가 발생했습니다.'
    });
  }
});

// 보안 통계 조회
router.get('/stats', async (req, res) => {
  try {
    const stats = await securityService.getSecurityStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ 보안 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '보안 통계 조회 중 오류가 발생했습니다.'
    });
  }
});

// IP 기반 위협 분석
router.get('/analyze/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const timeWindow = req.query.timeWindow || '1 hour';
    
    const analysis = await securityService.analyzeIpThreats(ip, timeWindow);
    
    res.json({
      success: true,
      data: {
        ip,
        timeWindow,
        analysis
      }
    });
  } catch (error) {
    console.error('❌ IP 위협 분석 실패:', error);
    res.status(500).json({
      success: false,
      error: 'IP 위협 분석 중 오류가 발생했습니다.'
    });
  }
});

// 보안 위협 처리 완료 표시
router.put('/threats/:id/handle', async (req, res) => {
  try {
    const { id } = req.params;
    await securityService.markThreatHandled(id);
    
    res.json({
      success: true,
      message: '보안 위협이 처리 완료로 표시되었습니다.'
    });
  } catch (error) {
    console.error('❌ 보안 위협 처리 표시 실패:', error);
    res.status(500).json({
      success: false,
      error: '보안 위협 처리 표시 중 오류가 발생했습니다.'
    });
  }
});

// 보안 위협 상세 정보 조회
router.get('/threats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 보안 위협 상세 정보 조회 (securityService에 추가 필요)
    const query = `
      SELECT * FROM security_threats WHERE threat_id = $1
    `;
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '보안 위협을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ 보안 위협 상세 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '보안 위협 상세 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
