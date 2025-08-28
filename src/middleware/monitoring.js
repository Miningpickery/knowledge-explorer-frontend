// 📊 Monitoring Middleware
// 상용화 수준의 자동 성능 및 메트릭 수집 미들웨어

const { logger, performanceMetrics, ErrorMonitoring } = require('../services/monitoring');
const { notificationManager } = require('../services/notifications');
const os = require('os');
const v8 = require('v8');

/**
 * 📊 요청 성능 추적 미들웨어
 */
function performanceTrackingMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  const startCpuUsage = process.cpuUsage();
  
  // 요청 정보 로깅
  logger.info('Request started', {
    type: 'request_start',
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // 응답 완료 시 메트릭 수집
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endCpuUsage = process.cpuUsage(startCpuUsage);
    const duration = Number(endTime - startTime) / 1000000; // ms로 변환
    
    // 성능 메트릭 기록
    performanceMetrics.recordMetric('api_response_time', duration, {
      method: req.method,
      route: req.route?.path || req.url,
      statusCode: res.statusCode,
      userId: req.user?.id,
    });
    
    // HTTP 상태 코드별 메트릭
    performanceMetrics.recordMetric(`http_${res.statusCode}`, 1, {
      method: req.method,
      route: req.route?.path || req.url,
    });
    
    // CPU 사용량 메트릭
    const cpuUsage = endCpuUsage.user + endCpuUsage.system;
    performanceMetrics.recordMetric('cpu_usage_per_request', cpuUsage / 1000, {
      method: req.method,
      route: req.route?.path || req.url,
    });
    
    // 요청 완료 로깅
    logger.info('Request completed', {
      type: 'request_complete',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      contentLength: res.get('content-length'),
      userId: req.user?.id,
    });
    
    // 성능 임계치 알림
    if (duration > 3000) { // 3초 이상
      notificationManager.checkMetricAndAlert('response_time', duration, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

/**
 * 🔄 시스템 리소스 모니터링
 */
function startSystemMonitoring() {
  const monitoringInterval = 30000; // 30초마다
  
  setInterval(() => {
    try {
      // 메모리 사용량
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      
      performanceMetrics.recordMetric('memory_usage_mb', memoryUsage.heapUsed / 1024 / 1024);
      performanceMetrics.recordMetric('memory_usage_percent', memoryUsagePercent);
      
      // CPU 사용률
      const cpuUsage = process.cpuUsage();
      performanceMetrics.recordMetric('cpu_user_time', cpuUsage.user / 1000000); // 마이크로초를 초로
      performanceMetrics.recordMetric('cpu_system_time', cpuUsage.system / 1000000);
      
      // CPU 로드 애버리지
      const loadAverage = os.loadavg();
      performanceMetrics.recordMetric('load_average_1m', loadAverage[0]);
      performanceMetrics.recordMetric('load_average_5m', loadAverage[1]);
      performanceMetrics.recordMetric('load_average_15m', loadAverage[2]);
      
      // V8 힙 통계
      const heapStats = v8.getHeapStatistics();
      performanceMetrics.recordMetric('heap_size_mb', heapStats.used_heap_size / 1024 / 1024);
      performanceMetrics.recordMetric('heap_limit_mb', heapStats.heap_size_limit / 1024 / 1024);
      
      // 이벤트 루프 지연 (대략적)
      const eventLoopStart = process.hrtime.bigint();
      setImmediate(() => {
        const eventLoopDelay = Number(process.hrtime.bigint() - eventLoopStart) / 1000000; // ms
        performanceMetrics.recordMetric('event_loop_delay', eventLoopDelay);
      });
      
      // 업타임
      performanceMetrics.recordMetric('uptime_seconds', process.uptime());
      
      // 시스템 정보 (덜 자주 수집)
      if (Math.random() < 0.1) { // 10% 확률로
        logger.info('System snapshot', {
          type: 'system_metrics',
          memory: {
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
            systemUsage: `${memoryUsagePercent.toFixed(2)}%`,
          },
          cpu: {
            loadAverage: loadAverage.map(l => l.toFixed(2)),
            userTime: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
            systemTime: `${(cpuUsage.system / 1000000).toFixed(2)}s`,
          },
          process: {
            pid: process.pid,
            uptime: `${Math.floor(process.uptime())}s`,
            nodeVersion: process.version,
            platform: os.platform(),
            arch: os.arch(),
          }
        });
      }
      
      // 임계치 알림
      notificationManager.checkMetricAndAlert('memory_usage', memoryUsagePercent);
      notificationManager.checkMetricAndAlert('cpu_load', loadAverage[0]);
      
    } catch (error) {
      logger.error('System monitoring error', error);
    }
  }, monitoringInterval);
  
  logger.info('System monitoring started', {
    interval: `${monitoringInterval / 1000}s`,
    metrics: ['memory', 'cpu', 'load_average', 'heap', 'event_loop', 'uptime']
  });
}

/**
 * 🔍 에러 추적 미들웨어
 */
function errorTrackingMiddleware(err, req, res, next) {
  // Sentry에 에러 컨텍스트 설정
  ErrorMonitoring.setContext('request', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  if (req.user) {
    ErrorMonitoring.setUserContext(req.user);
  }
  
  // 에러 메트릭 기록
  performanceMetrics.recordMetric('api_errors', 1, {
    method: req.method,
    route: req.route?.path || req.url,
    errorType: err.name,
    statusCode: err.statusCode || 500,
  });
  
  // 에러 로깅
  logger.error('API Error', err, {
    type: 'api_error',
    method: req.method,
    url: req.url,
    statusCode: err.statusCode || 500,
    userId: req.user?.id,
    stack: err.stack,
  });
  
  // 치명적 에러 알림
  if (!err.statusCode || err.statusCode >= 500) {
    notificationManager.sendAlert('error', 'API Error', err.message, {
      method: req.method,
      url: req.url,
      statusCode: err.statusCode || 500,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }
  
  next(err);
}

/**
 * 👥 활성 사용자 추적
 */
const activeUsers = new Set();
const userSessions = new Map();

function userActivityTrackingMiddleware(req, res, next) {
  const userId = req.user?.id || req.ip; // 인증된 사용자 또는 IP 기반
  const sessionId = req.sessionID || req.headers['x-session-id'];
  
  // 활성 사용자 추가
  activeUsers.add(userId);
  
  // 세션 정보 업데이트
  if (sessionId) {
    userSessions.set(sessionId, {
      userId,
      lastActivity: Date.now(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }
  
  // 사용자 활동 로깅
  if (req.user) {
    logger.userActivity(req.user.id, `${req.method} ${req.url}`, {
      sessionId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
  
  next();
}

/**
 * 📊 주기적 메트릭 정리 및 보고
 */
function startPeriodicReporting() {
  // 활성 사용자 수 업데이트 (1분마다)
  setInterval(() => {
    performanceMetrics.recordMetric('active_users', activeUsers.size);
    
    // 5분 이상 비활성 사용자 제거
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [sessionId, session] of userSessions) {
      if (session.lastActivity < fiveMinutesAgo) {
        activeUsers.delete(session.userId);
        userSessions.delete(sessionId);
      }
    }
  }, 60000); // 1분마다
  
  // 시간별 보고서 (1시간마다)
  setInterval(() => {
    const metrics = {
      activeUsers: activeUsers.size,
      messagesPerHour: performanceMetrics.getStats('chat_messages_sent')?.count || 0,
      avgResponseTime: performanceMetrics.getStats('api_response_time')?.avg || 0,
      errorRate: calculateErrorRate(),
      memoryUsage: performanceMetrics.getStats('memory_usage_percent')?.latest || 0,
      cpuLoad: performanceMetrics.getStats('load_average_1m')?.latest || 0,
    };
    
    notificationManager.sendPeriodicReport(metrics);
    
    logger.info('Hourly metrics report', {
      type: 'metrics_report',
      period: 'hourly',
      timestamp: new Date().toISOString(),
      metrics,
    });
  }, 3600000); // 1시간마다
  
  // 일일 보고서 (매일 오전 9시)
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      generateDailyReport();
    }
  }, 60000); // 1분마다 체크
}

/**
 * 📈 에러율 계산
 */
function calculateErrorRate() {
  const totalRequests = performanceMetrics.getStats('api_response_time')?.count || 0;
  const errorRequests = performanceMetrics.getStats('api_errors')?.count || 0;
  
  return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
}

/**
 * 📋 일일 보고서 생성
 */
async function generateDailyReport() {
  const report = {
    date: new Date().toDateString(),
    users: {
      active: activeUsers.size,
      peak: performanceMetrics.getStats('active_users')?.max || 0,
      growth: 0, // 실제 구현에서는 전날 대비 계산
    },
    messages: {
      total: performanceMetrics.getStats('chat_messages_sent')?.count || 0,
      peak: performanceMetrics.getStats('chat_messages_sent')?.max || 0,
    },
    performance: {
      avgResponseTime: performanceMetrics.getStats('api_response_time')?.avg || 0,
      maxResponseTime: performanceMetrics.getStats('api_response_time')?.max || 0,
      errorRate: calculateErrorRate(),
    },
    uptime: {
      percentage: calculateUptimePercentage(),
      downtime: 0, // 실제 구현에서 계산
    },
    system: {
      peakMemoryUsage: performanceMetrics.getStats('memory_usage_percent')?.max || 0,
      avgCpuLoad: performanceMetrics.getStats('load_average_1m')?.avg || 0,
    }
  };
  
  logger.businessMetric('daily_report', 1, report);
  
  // 주요 이해관계자에게 보고서 전송
  await notificationManager.emailService.sendWeeklyReport(report);
}

/**
 * ⏱️ 업타임 백분율 계산
 */
function calculateUptimePercentage() {
  const uptimeSeconds = process.uptime();
  const totalSecondsInDay = 24 * 60 * 60;
  
  if (uptimeSeconds >= totalSecondsInDay) {
    return 100;
  }
  
  return (uptimeSeconds / totalSecondsInDay) * 100;
}

/**
 * 🔧 모니터링 시스템 초기화
 */
function initializeMonitoring() {
  logger.info('Initializing monitoring system...');
  
  // 시스템 모니터링 시작
  startSystemMonitoring();
  
  // 주기적 보고 시작
  startPeriodicReporting();
  
  // 프로세스 이벤트 모니터링
  process.on('warning', (warning) => {
    logger.warn('Process warning', {
      type: 'process_warning',
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', reason, {
      type: 'unhandled_rejection',
      promise: promise.toString(),
    });
    
    notificationManager.sendAlert('critical', 'Unhandled Promise Rejection', 
      'An unhandled promise rejection was detected', {
        reason: String(reason),
        stack: reason?.stack,
      }
    );
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error, {
      type: 'uncaught_exception',
      fatal: true,
    });
    
    notificationManager.sendAlert('critical', 'Uncaught Exception', 
      'A fatal uncaught exception occurred', {
        message: error.message,
        stack: error.stack,
      }
    );
    
    // 정상적으로 종료 시도
    process.exit(1);
  });
  
  // Graceful shutdown 처리
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, performing graceful shutdown...');
    
    // 마지막 메트릭 플러시
    performanceMetrics.clearOldMetrics(0); // 모든 메트릭 정리
    
    setTimeout(() => {
      process.exit(0);
    }, 10000); // 10초 후 강제 종료
  });
  
  logger.info('✅ Monitoring system initialized successfully');
}

module.exports = {
  performanceTrackingMiddleware,
  errorTrackingMiddleware,
  userActivityTrackingMiddleware,
  initializeMonitoring,
  activeUsers,
  userSessions,
};
