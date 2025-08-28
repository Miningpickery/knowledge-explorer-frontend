// 환경 변수를 가장 먼저 로드
const path = require('path');
const dotenv = require('dotenv');

// .env 파일 경로 설정
const envPath = path.join(__dirname, '..', '.env');
console.log('📁 .env 파일 경로:', envPath);
console.log('📁 현재 디렉토리:', __dirname);

// dotenv 로드
console.log('🔧 dotenv 로드 시작...');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ .env 파일 로드 실패:', result.error);
} else {
  console.log('✅ .env 파일 로드 성공');
  console.log('📄 로드된 환경 변수:', Object.keys(result.parsed || {}));
}

// 환경 변수 확인 및 기본값 설정
if (!process.env.GOOGLE_CLIENT_ID) {
  console.log('⚠️ 중요한 환경 변수들이 설정되지 않았습니다.');
  console.log('📝 .env 파일을 생성하고 필요한 환경 변수들을 설정해주세요.');
  
  // 개발 환경에서만 기본값 설정
  if (process.env.NODE_ENV !== 'production') {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/knowledge_explorer';
    process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8000';
    console.log('🔧 개발 환경 기본값 설정 완료');
  }
}

// 환경 변수 디버깅
console.log('🔍 환경 변수 디버깅:', {
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '설정됨' : '없음',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '없음',
  JWT_SECRET: process.env.JWT_SECRET ? '설정됨' : '없음',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '설정됨' : '없음'
});

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const { 
  apiLimiter, 
  loginLimiter, 
  chatLimiter, 
  securityHeaders, 
  corsOptions, 
  sanitizeLogs, 
  sqlInjectionProtection,
  xssProtection
} = require('./middleware/security');

const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');
const exportRoutes = require('./routes/exportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const customerRoutes = require('./routes/customerRoutes');
const securityRoutes = require('./routes/securityRoutes');
const authRoutes = require('./routes/authRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const healthRoutes = require('./routes/healthRoutes');

// 📊 모니터링 시스템
const { ErrorMonitoring, logger } = require('./services/monitoring');
const { notificationManager } = require('./services/notifications');
const { 
  performanceTrackingMiddleware,
  errorTrackingMiddleware,
  userActivityTrackingMiddleware,
  initializeMonitoring 
} = require('./middleware/monitoring');

const app = express();
const PORT = process.env.PORT || 3001;

// 📊 Sentry 요청 추적 (최우선)
app.use(ErrorMonitoring.getRequestHandler());

// 📈 성능 추적 미들웨어
app.use(performanceTrackingMiddleware);

// 👥 사용자 활동 추적
app.use(userActivityTrackingMiddleware);

// 보안 미들웨어 적용
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(sanitizeLogs);
app.use(sqlInjectionProtection);
app.use(xssProtection);

// Rate Limiting 적용
app.use('/api/auth', loginLimiter); // 로그인 관련 엄격한 제한
app.use('/api/chats', chatLimiter); // 채팅 메시지 제한
app.use('/api', apiLimiter); // 일반 API 제한

// 한국어 인코딩을 위한 설정
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100000
}));

// 한국어 인코딩을 위한 헤더 설정
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Passport 초기화
app.use(passport.initialize());

// 🏥 Health check routes (최우선)
app.use('/', healthRoutes);

// 🔗 API Routes
app.use('/api/chats', chatRoutes);
app.use('/api/chats', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/memories', memoryRoutes);

// 📊 Sentry 에러 핸들러 (라우트 후, 에러 핸들러 전)
app.use(ErrorMonitoring.getErrorHandler());

// 🚨 모니터링 에러 추적 미들웨어
app.use(errorTrackingMiddleware);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled API Error', err, {
    method: req.method,
    url: req.url,
    statusCode: err.statusCode || 500,
    userId: req.user?.id,
  });

  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? '서버 내부 오류가 발생했습니다.' 
        : err.message,
      details: process.env.NODE_ENV === 'production' 
        ? undefined 
        : err.stack
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: '요청한 엔드포인트를 찾을 수 없습니다.',
      details: `${req.method} ${req.originalUrl}`
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  // 📊 모니터링 시스템 초기화
  initializeMonitoring();
  
  // 🚀 서버 시작 로깅
  logger.info('Knowledge Explorer Backend started successfully', {
    type: 'server_start',
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
  
  console.log(`🚀 Knowledge Explorer Backend running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/health`);
  console.log(`📊 Monitoring Dashboard: http://localhost:${PORT}/health/comprehensive`);
  
  // 🔔 시작 알림 전송
  notificationManager.sendAlert('info', 'Server Started', 
    `Knowledge Explorer Backend has started successfully on port ${PORT}`, {
      environment: process.env.NODE_ENV,
      port: PORT,
      nodeVersion: process.version,
    }
  );
});
