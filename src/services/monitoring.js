// 📊 Monitoring Service
// 상용화 수준의 모니터링 및 에러 추적

// const Sentry = require('@sentry/node');
// const { ProfilingIntegration } = require('@sentry/profiling-node');
const winston = require('winston');
const pino = require('pino');

/**
 * 🚨 Sentry 에러 모니터링 초기화
 */
class ErrorMonitoring {
  static initialize() {
    console.log('⚠️ Sentry monitoring disabled for development');
  }
  
  /**
   * 사용자 컨텍스트 설정
   */
  static setUserContext(user) {
    console.log('⚠️ Sentry setUserContext disabled');
  }
  
  /**
   * 추가 컨텍스트 설정
   */
  static setContext(key, context) {
    console.log('⚠️ Sentry setContext disabled');
  }
  
  /**
   * 수동 에러 리포팅
   */
  static captureError(error, context = {}) {
    console.log('⚠️ Sentry captureError disabled:', error.message);
  }
  
  /**
   * 성능 추적 시작
   */
  static startTransaction(name, op) {
    console.log('⚠️ Sentry startTransaction disabled');
    return null;
  }
  
  /**
   * Express 미들웨어 반환
   */
  static getRequestHandler() {
    console.log('⚠️ Sentry getRequestHandler disabled');
    return (req, res, next) => next();
  }
  
  static getErrorHandler() {
    console.log('⚠️ Sentry getErrorHandler disabled');
    return (err, req, res, next) => next(err);
  }
}

/**
 * 📝 구조화된 로깅 시스템
 */
class Logger {
  constructor() {
    this.winston = this.createWinstonLogger();
    this.pino = this.createPinoLogger();
  }
  
  createWinstonLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.colorize({ all: true })
    );
    
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: {
        service: 'knowledge-explorer',
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
      },
      transports: [
        // 콘솔 출력
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // 파일 출력 (프로덕션)
        ...(process.env.NODE_ENV === 'production' ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760,
            maxFiles: 10,
          })
        ] : [])
      ],
      
      // 예외 처리
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }
  
  createPinoLogger() {
    return pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined,
      base: {
        service: 'knowledge-explorer',
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
      }
    });
  }
  
  // 로그 메서드들
  info(message, meta = {}) {
    this.winston.info(message, meta);
    this.pino.info(meta, message);
  }
  
  warn(message, meta = {}) {
    this.winston.warn(message, meta);
    this.pino.warn(meta, message);
  }
  
  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      ...meta,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : meta;
    
    this.winston.error(message, errorMeta);
    this.pino.error(errorMeta, message);
    
    // Sentry로도 전송
    if (error) {
      ErrorMonitoring.captureError(error, meta);
    }
  }
  
  debug(message, meta = {}) {
    this.winston.debug(message, meta);
    this.pino.debug(meta, message);
  }
  
  // 성능 로깅
  performance(operation, duration, meta = {}) {
    const performanceMeta = {
      ...meta,
      operation,
      duration,
      type: 'performance'
    };
    
    this.info(`Performance: ${operation} completed in ${duration}ms`, performanceMeta);
  }
  
  // 사용자 활동 로깅
  userActivity(userId, action, details = {}) {
    const activityMeta = {
      userId,
      action,
      details,
      type: 'user_activity',
      timestamp: new Date().toISOString()
    };
    
    this.info(`User Activity: ${action}`, activityMeta);
  }
  
  // 보안 이벤트 로깅
  security(event, details = {}) {
    const securityMeta = {
      ...details,
      type: 'security',
      severity: 'high',
      timestamp: new Date().toISOString()
    };
    
    this.warn(`Security Event: ${event}`, securityMeta);
  }
  
  // 비즈니스 메트릭 로깅
  businessMetric(metric, value, meta = {}) {
    const metricMeta = {
      ...meta,
      metric,
      value,
      type: 'business_metric',
      timestamp: new Date().toISOString()
    };
    
    this.info(`Business Metric: ${metric} = ${value}`, metricMeta);
  }
}

/**
 * 📈 성능 메트릭 수집기
 */
class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
  }
  
  // 타이머 시작
  startTimer(operation) {
    this.startTimes.set(operation, process.hrtime.bigint());
  }
  
  // 타이머 종료 및 메트릭 기록
  endTimer(operation, meta = {}) {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return;
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // ms 변환
    
    this.recordMetric(operation, duration, meta);
    this.startTimes.delete(operation);
    
    return duration;
  }
  
  // 메트릭 기록
  recordMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push(metric);
    
    // 로그로도 기록
    logger.performance(name, value, tags);
  }
  
  // 메트릭 조회
  getMetrics(name) {
    return this.metrics.get(name) || [];
  }
  
  // 모든 메트릭 조회
  getAllMetrics() {
    const result = {};
    for (const [name, metrics] of this.metrics) {
      result[name] = metrics;
    }
    return result;
  }
  
  // 메트릭 통계
  getStats(name) {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value);
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      latest: values[values.length - 1]
    };
  }
  
  // 메트릭 초기화 (메모리 관리)
  clearOldMetrics(maxAge = 3600000) { // 1시간
    const cutoff = Date.now() - maxAge;
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// 싱글톤 인스턴스 생성
const logger = new Logger();
const performanceMetrics = new PerformanceMetrics();

// 모니터링 초기화
ErrorMonitoring.initialize();

// 정기적으로 오래된 메트릭 정리
setInterval(() => {
  performanceMetrics.clearOldMetrics();
}, 300000); // 5분마다

module.exports = {
  ErrorMonitoring,
  Logger,
  PerformanceMetrics,
  logger,
  performanceMetrics
};
