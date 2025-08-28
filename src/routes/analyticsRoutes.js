// 📊 Analytics API Routes
// 사용자 행동 데이터 수집 및 분석 API

const express = require('express');
const rateLimit = require('express-rate-limit');
const { logger, performanceMetrics } = require('../services/monitoring');

const router = express.Router();

// 분석 데이터 전송 Rate Limiting
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 100, // 사용자당 최대 100개 이벤트
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '분석 데이터 전송 한도를 초과했습니다.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 📈 분석 이벤트 수집
 */
router.post('/analytics', analyticsLimiter, async (req, res) => {
  const startTime = process.hrtime.bigint();
  
  try {
    const { session, events, timestamp } = req.body;
    
    // 기본 검증
    if (!session || !events || !Array.isArray(events)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAYLOAD',
          message: '유효하지 않은 분석 데이터 형식입니다.',
        }
      });
    }

    // 세션 정보 로깅
    logger.userActivity(session.userId || 'anonymous', 'analytics_batch', {
      sessionId: session.sessionId,
      eventCount: events.length,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp,
    });

    // 각 이벤트 처리
    for (const event of events) {
      await processAnalyticsEvent(event, session, req);
    }

    // 성능 메트릭 기록
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    performanceMetrics.recordMetric('analytics_processing', duration, {
      eventCount: events.length,
      userId: session.userId,
    });

    res.status(200).json({
      status: 'success',
      processed: events.length,
      sessionId: session.sessionId,
    });

  } catch (error) {
    logger.error('Analytics processing failed', error, {
      body: req.body,
      headers: req.headers,
    });

    res.status(500).json({
      error: {
        code: 'ANALYTICS_PROCESSING_ERROR',
        message: '분석 데이터 처리 중 오류가 발생했습니다.',
      }
    });
  }
});

/**
 * 🎯 개별 이벤트 처리
 */
async function processAnalyticsEvent(event, session, req) {
  const { event: eventName, category, action, properties } = event;
  
  // 이벤트별 특별 처리
  switch (category) {
    case 'chat':
      await processChatEvent(event, session);
      break;
    case 'authentication':
      await processAuthEvent(event, session);
      break;
    case 'ui':
      await processUIEvent(event, session);
      break;
    case 'error':
      await processErrorEvent(event, session, req);
      break;
    case 'performance':
      await processPerformanceEvent(event, session);
      break;
    case 'conversion':
      await processConversionEvent(event, session);
      break;
    case 'ab_test':
      await processABTestEvent(event, session);
      break;
    default:
      await processGeneralEvent(event, session);
  }

  // 모든 이벤트를 일반 로그로도 기록
  logger.info('Analytics Event', {
    type: 'analytics',
    event: eventName,
    category,
    action,
    userId: session.userId,
    sessionId: session.sessionId,
    properties,
    timestamp: event.timestamp,
  });
}

/**
 * 💬 채팅 이벤트 처리
 */
async function processChatEvent(event, session) {
  const { action, properties } = event;
  
  switch (action) {
    case 'message_sent':
      performanceMetrics.recordMetric('chat_messages_sent', 1, {
        userId: session.userId,
        messageLength: properties.messageLength,
      });
      
      logger.businessMetric('daily_messages', 1, {
        userId: session.userId,
        chatId: properties.chatId,
      });
      break;
      
    case 'new_chat_created':
      performanceMetrics.recordMetric('new_chats_created', 1, {
        userId: session.userId,
      });
      
      logger.businessMetric('daily_new_chats', 1, {
        userId: session.userId,
      });
      break;
      
    case 'chat_deleted':
      logger.userActivity(session.userId, 'chat_deleted', {
        chatId: properties.chatId,
      });
      break;
  }
}

/**
 * 🔐 인증 이벤트 처리
 */
async function processAuthEvent(event, session) {
  const { action, properties } = event;
  
  switch (action) {
    case 'login_success':
      logger.security('user_login', {
        userId: session.userId,
        method: properties.method,
        ip: properties.ip,
      });
      
      performanceMetrics.recordMetric('successful_logins', 1);
      break;
      
    case 'login_failed':
      logger.security('login_failed', {
        reason: properties.reason,
        ip: properties.ip,
        attempts: properties.attempts,
      });
      
      performanceMetrics.recordMetric('failed_logins', 1);
      break;
      
    case 'logout':
      logger.userActivity(session.userId, 'logout', {
        sessionDuration: properties.sessionDuration,
      });
      break;
  }
}

/**
 * 🎛️ UI 이벤트 처리
 */
async function processUIEvent(event, session) {
  const { action, properties } = event;
  
  // UI 상호작용 빈도 추적
  performanceMetrics.recordMetric(`ui_${action}`, 1, {
    element: properties.element,
    userId: session.userId,
  });
  
  // 중요한 UI 이벤트 별도 처리
  if (['sidebar_toggle', 'theme_change', 'language_change'].includes(action)) {
    logger.userActivity(session.userId, `ui_${action}`, properties);
  }
}

/**
 * 🚨 에러 이벤트 처리
 */
async function processErrorEvent(event, session, req) {
  const { properties } = event;
  
  // 프론트엔드 에러를 백엔드 로깅 시스템으로 전달
  logger.error('Frontend Error', {
    message: properties.error_message,
    stack: properties.error_stack,
    filename: properties.filename,
    lineno: properties.lineno,
    colno: properties.colno,
    userId: session.userId,
    sessionId: session.sessionId,
    userAgent: req.headers['user-agent'],
    url: properties.url,
  });
  
  // 에러 빈도 추적
  performanceMetrics.recordMetric('frontend_errors', 1, {
    errorType: properties.error_name,
    userId: session.userId,
  });
  
  // 치명적인 에러인 경우 알림
  if (properties.error_name === 'ChunkLoadError' || 
      properties.error_message?.includes('Network Error')) {
    await sendCriticalErrorAlert(event, session);
  }
}

/**
 * ⚡ 성능 이벤트 처리
 */
async function processPerformanceEvent(event, session) {
  const { action, value, properties } = event;
  
  performanceMetrics.recordMetric(`frontend_${action}`, value, {
    userId: session.userId,
    ...properties,
  });
  
  // 성능 임계치 모니터링
  const thresholds = {
    page_load_time: 3000, // 3초
    api_response_time: 1000, // 1초
    render_time: 100, // 100ms
  };
  
  if (thresholds[action] && value > thresholds[action]) {
    logger.warn('Performance Threshold Exceeded', {
      metric: action,
      value,
      threshold: thresholds[action],
      userId: session.userId,
      properties,
    });
  }
}

/**
 * 🎯 변환 이벤트 처리
 */
async function processConversionEvent(event, session) {
  const { action, value, properties } = event;
  
  logger.businessMetric(`conversion_${action}`, value || 1, {
    userId: session.userId,
    sessionId: session.sessionId,
    ...properties,
  });
  
  // 중요한 변환 이벤트 알림
  if (['signup', 'first_message', 'feature_adoption'].includes(action)) {
    await sendConversionAlert(event, session);
  }
}

/**
 * 🧪 A/B 테스트 이벤트 처리
 */
async function processABTestEvent(event, session) {
  const { action, properties } = event;
  
  logger.info(`A/B Test ${action}`, {
    type: 'ab_test',
    experiment: properties.experiment,
    variant: properties.variant,
    goal: properties.goal,
    userId: session.userId,
    ...properties,
  });
  
  // A/B 테스트 메트릭 기록
  performanceMetrics.recordMetric(`ab_test_${properties.experiment}_${action}`, 1, {
    variant: properties.variant,
    userId: session.userId,
  });
}

/**
 * 📊 일반 이벤트 처리
 */
async function processGeneralEvent(event, session) {
  // 일반적인 이벤트 메트릭 기록
  performanceMetrics.recordMetric(`event_${event.category}_${event.action}`, 1, {
    userId: session.userId,
  });
}

/**
 * 🚨 치명적 에러 알림
 */
async function sendCriticalErrorAlert(event, session) {
  // 실제 구현에서는 Slack, 이메일, SMS 등으로 알림
  logger.error('CRITICAL FRONTEND ERROR DETECTED', {
    severity: 'critical',
    event,
    session,
    action_required: true,
  });
}

/**
 * 🎉 변환 알림
 */
async function sendConversionAlert(event, session) {
  logger.info('CONVERSION EVENT', {
    type: 'conversion_alert',
    event,
    session,
  });
}

/**
 * 📊 분석 대시보드 데이터
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // 실시간 메트릭 수집
    const metrics = {
      userActivity: {
        activeUsers: performanceMetrics.getStats('active_users'),
        newUsers: performanceMetrics.getStats('new_users'),
        sessionDuration: performanceMetrics.getStats('session_duration'),
      },
      chatActivity: {
        messagesSent: performanceMetrics.getStats('chat_messages_sent'),
        newChats: performanceMetrics.getStats('new_chats_created'),
        averageMessageLength: performanceMetrics.getStats('message_length'),
      },
      performance: {
        responseTime: performanceMetrics.getStats('api_response_time'),
        errorRate: performanceMetrics.getStats('frontend_errors'),
        pageLoadTime: performanceMetrics.getStats('page_load_time'),
      },
      conversion: {
        signups: performanceMetrics.getStats('conversion_signup'),
        retention: performanceMetrics.getStats('user_retention'),
        engagement: performanceMetrics.getStats('user_engagement'),
      }
    };
    
    res.json({
      status: 'success',
      timeRange,
      lastUpdated: new Date().toISOString(),
      metrics,
    });
    
  } catch (error) {
    logger.error('Dashboard data fetch failed', error);
    res.status(500).json({
      error: {
        code: 'DASHBOARD_ERROR',
        message: '대시보드 데이터를 가져오는 중 오류가 발생했습니다.',
      }
    });
  }
});

/**
 * 📈 실시간 메트릭
 */
router.get('/analytics/realtime', async (req, res) => {
  try {
    const realtimeData = {
      activeUsers: performanceMetrics.getStats('active_users')?.latest || 0,
      currentMessages: performanceMetrics.getStats('chat_messages_sent')?.latest || 0,
      systemHealth: {
        responseTime: performanceMetrics.getStats('api_response_time')?.avg || 0,
        errorRate: performanceMetrics.getStats('frontend_errors')?.latest || 0,
        uptime: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(realtimeData);
    
  } catch (error) {
    logger.error('Realtime data fetch failed', error);
    res.status(500).json({
      error: {
        code: 'REALTIME_ERROR',
        message: '실시간 데이터를 가져오는 중 오류가 발생했습니다.',
      }
    });
  }
});

module.exports = router;