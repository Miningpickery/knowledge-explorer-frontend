// 🌍 Environment Configuration Manager
// 상용화 수준의 환경 설정 관리

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경별 .env 파일 로드
const NODE_ENV = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '../../', `.env.${NODE_ENV}`);
const defaultEnvPath = path.resolve(__dirname, '../../', '.env');

// 환경별 파일 우선 로드, 없으면 기본 .env 파일 로드
try {
  dotenv.config({ path: envPath });
  console.log(`🌍 Environment loaded: ${NODE_ENV} (${envPath})`);
} catch (error) {
  console.log(`⚠️ No environment file found: ${envPath}, falling back to default`);
  dotenv.config({ path: defaultEnvPath });
}

/**
 * 🔧 Environment Configuration Class
 */
class EnvironmentConfig {
  constructor() {
    this.NODE_ENV = process.env.NODE_ENV || 'development';
    this.validateRequiredEnvVars();
  }

  // 필수 환경 변수 검증
  validateRequiredEnvVars() {
    const required = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'JWT_SECRET',
      'DATABASE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      if (this.NODE_ENV === 'production') {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      } else {
        console.warn('⚠️ Development mode: continuing with missing env vars');
      }
    } else {
      console.log('✅ All required environment variables are set');
    }
  }

  // 🔐 보안 설정
  get security() {
    return {
      jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key-for-development',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
      sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
      corsOrigin: this.NODE_ENV === 'production' 
        ? process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com']
        : ['http://localhost:8000', 'http://localhost:3000'],
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15분
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    };
  }

  // 🗄️ 데이터베이스 설정
  get database() {
    return {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/knowledge_explorer',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      name: process.env.DB_NAME || 'knowledge_explorer',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: this.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    };
  }

  // 🔑 OAuth 설정
  get oauth() {
    return {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
      },
    };
  }

  // 🤖 AI 설정
  get ai() {
    return {
      geminiApiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.AI_MODEL_NAME || 'gemini-1.5-flash',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2048,
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      topP: parseFloat(process.env.AI_TOP_P) || 0.8,
      topK: parseInt(process.env.AI_TOP_K) || 40,
    };
  }

  // 🌐 서버 설정
  get server() {
    return {
      port: parseInt(process.env.PORT) || 3001,
      host: process.env.HOST || '0.0.0.0',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8000',
      apiPrefix: process.env.API_PREFIX || '/api',
      staticPath: process.env.STATIC_PATH || 'public',
      uploadPath: process.env.UPLOAD_PATH || 'uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    };
  }

  // 📧 이메일 설정
  get email() {
    return {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT) || 587,
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      fromEmail: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      fromName: process.env.FROM_NAME || 'Knowledge Explorer',
    };
  }

  // 📊 모니터링 설정
  get monitoring() {
    return {
      sentryDsn: process.env.SENTRY_DSN,
      logLevel: process.env.LOG_LEVEL || (this.NODE_ENV === 'production' ? 'info' : 'debug'),
      metricsEnabled: process.env.METRICS_ENABLED === 'true',
      healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
    };
  }

  // 🗂️ Redis 설정 (캐싱/세션)
  get redis() {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      ttl: parseInt(process.env.REDIS_TTL) || 3600, // 1시간
    };
  }

  // 🌍 환경 확인 메서드
  isDevelopment() {
    return this.NODE_ENV === 'development';
  }

  isProduction() {
    return this.NODE_ENV === 'production';
  }

  isTest() {
    return this.NODE_ENV === 'test';
  }

  // 📋 설정 요약 출력
  logConfiguration() {
    console.log('\n🔧 Configuration Summary:');
    console.log(`   Environment: ${this.NODE_ENV}`);
    console.log(`   Server: ${this.server.host}:${this.server.port}`);
    console.log(`   Database: ${this.database.host}:${this.database.port}/${this.database.name}`);
    console.log(`   Frontend: ${this.server.frontendUrl}`);
    console.log(`   AI Model: ${this.ai.modelName}`);
    console.log(`   CORS Origins: ${this.security.corsOrigin.join(', ')}`);
    console.log(`   Log Level: ${this.monitoring.logLevel}`);
    
    if (this.isDevelopment()) {
      console.log('🔓 Development mode: Enhanced logging & error details enabled');
    }
    
    if (this.isProduction()) {
      console.log('🔒 Production mode: Security hardened, performance optimized');
    }
    
    console.log('');
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const config = new EnvironmentConfig();

export default config;
export { EnvironmentConfig };
