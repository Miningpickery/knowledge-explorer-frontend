// ============================================================================
// SECURITY MIDDLEWARE - Rate Limiting, CORS, Security Headers
// ============================================================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// 일반 API 요청 Rate Limiting (개발 환경용)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 2000, // IP당 최대 2000개 요청으로 증가 (개발 환경)
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: 'Rate limit exceeded'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// 로그인 요청 Rate Limiting (개발 환경에서는 비활성화)
const loginLimiter = (req, res, next) => {
  // 개발 환경에서는 Rate Limit 비활성화
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // 프로덕션 환경에서만 Rate Limit 적용
  return next(); // 임시로 비활성화
};

// 채팅 메시지 Rate Limiting (개발 환경용)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 200, // IP당 최대 200개 메시지로 증가 (개발 환경)
  message: {
    error: {
      code: 'CHAT_RATE_LIMIT_EXCEEDED',
      message: '메시지 전송이 너무 빠릅니다. 잠시 후 다시 시도해주세요.',
      details: 'Chat rate limit exceeded'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// 보안 헤더 설정
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "http://192.168.0.55:3001", "https://*.trycloudflare.com", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// CORS 설정 강화
const corsOptions = {
  origin (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8000',
      'http://localhost:8001',
      'http://localhost:3000',
      'http://192.168.0.55:8000',  // 로컬 네트워크 IP 주소 추가
      'http://192.168.0.55:3001',  // 백엔드 IP 주소 추가
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // 개발 환경에서는 origin이 없는 요청도 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚫 CORS 차단된 origin:', origin);
      callback(new Error('CORS 정책에 의해 차단되었습니다'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24시간
};

// 민감한 정보 로깅 방지
const sanitizeLogs = (req, res, next) => {
  // 원본 요청 로깅
  const originalLog = console.log;
  
  // 민감한 정보가 포함된 로그 필터링
  console.log = function(...args) {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        // 비밀번호, 토큰 등 민감한 정보 마스킹
        return arg
          .replace(/password["\s]*[:=]["\s]*[^"\s,}]+/gi, 'password: ***')
          .replace(/token["\s]*[:=]["\s]*[^"\s,}]+/gi, 'token: ***')
          .replace(/authorization["\s]*[:=]["\s]*[^"\s,}]+/gi, 'authorization: ***')
          .replace(/jwt["\s]*[:=]["\s]*[^"\s,}]+/gi, 'jwt: ***');
      }
      return arg;
    });
    originalLog.apply(console, sanitizedArgs);
  };
  
  next();
};

// SQL Injection 방지 (기본적인 검증)
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b.*\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  // 요청 본문, 쿼리, 파라미터 검사
  const body = req.body || {};
  const query = req.query || {};
  const params = req.params || {};
  
  const allValues = { ...body, ...query, ...params };
  
  for (const [key, value] of Object.entries(allValues)) {
    if (checkValue(value)) {
      return res.status(400).json({
        error: {
          code: 'SECURITY_VIOLATION',
          message: '잘못된 요청이 감지되었습니다.',
          details: 'Potential SQL injection detected'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

// XSS 방지 미들웨어
const xssProtection = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = sanitizeValue(value);
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  apiLimiter,
  loginLimiter,
  chatLimiter,
  securityHeaders,
  corsOptions,
  sanitizeLogs,
  sqlInjectionProtection,
  xssProtection
};
