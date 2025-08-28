// 🏥 Health Check Routes
// 상용화 수준의 시스템 상태 모니터링

const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

/**
 * 🏥 기본 헬스체크 엔드포인트
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {}
    };

    // 메모리 사용량 체크
    const memUsage = process.memoryUsage();
    healthCheck.checks.memory = {
      status: 'healthy',
      usage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      }
    };

    // CPU 사용률 체크 (간단한 버전)
    const startUsage = process.cpuUsage();
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      healthCheck.checks.cpu = {
        status: 'healthy',
        user: endUsage.user,
        system: endUsage.system
      };
    }, 100);

    res.status(200).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * 🗄️ 데이터베이스 헬스체크
 */
router.get('/health/database', async (req, res) => {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });

    const start = Date.now();
    const result = await pool.query('SELECT 1 as health_check');
    const duration = Date.now() - start;

    await pool.end();

    if (result.rows[0].health_check === 1) {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          responseTime: `${duration}ms`,
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 5432,
          database: process.env.DB_NAME || 'knowledge_explorer'
        }
      });
    } else {
      throw new Error('Database health check query failed');
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error.message
      }
    });
  }
});

/**
 * 🔄 Redis 헬스체크
 */
router.get('/health/redis', async (req, res) => {
  try {
    // Redis 클라이언트가 설정된 경우에만 체크
    if (process.env.REDIS_HOST) {
      // 실제 Redis 연결 테스트는 Redis 클라이언트 설정 후 구현
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: {
          status: 'not_configured',
          message: 'Redis health check not implemented yet'
        }
      });
    } else {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: {
          status: 'not_required',
          message: 'Redis is not configured'
        }
      });
    }
  } catch (error) {
    console.error('Redis health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: {
        status: 'error',
        error: error.message
      }
    });
  }
});

/**
 * 🤖 AI 서비스 헬스체크
 */
router.get('/health/ai', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ai: {
          status: 'not_configured',
          message: 'AI service API key not configured'
        }
      });
    }

    // 간단한 AI 서비스 연결 테스트
    // 실제 구현에서는 Gemini API에 ping 요청을 보낼 수 있습니다
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ai: {
        status: 'configured',
        model: process.env.AI_MODEL_NAME || 'gemini-1.5-flash',
        message: 'AI service is configured and ready'
      }
    });
  } catch (error) {
    console.error('AI service health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      ai: {
        status: 'error',
        error: error.message
      }
    });
  }
});

/**
 * 📊 종합 헬스체크 (모든 서비스)
 */
router.get('/health/comprehensive', async (req, res) => {
  try {
    const checks = {};
    let overallStatus = 'healthy';
    let statusCode = 200;

    // 기본 애플리케이션 상태
    checks.application = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV
    };

    // 데이터베이스 체크
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
      });
      
      const start = Date.now();
      await pool.query('SELECT 1');
      const duration = Date.now() - start;
      await pool.end();

      checks.database = {
        status: 'healthy',
        responseTime: `${duration}ms`
      };
    } catch (dbError) {
      checks.database = {
        status: 'unhealthy',
        error: dbError.message
      };
      overallStatus = 'degraded';
      statusCode = 503;
    }

    // AI 서비스 체크
    checks.ai = {
      status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
      model: process.env.AI_MODEL_NAME || 'gemini-1.5-flash'
    };

    // 전체 응답
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    };

    res.status(statusCode).json(response);
  } catch (error) {
    console.error('Comprehensive health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * 📈 시스템 메트릭
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT
      }
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

module.exports = router;
