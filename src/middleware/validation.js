// ============================================================================
// VALIDATION MIDDLEWARE - 환경 변수 및 요청 검증
// ============================================================================

// 환경 변수 검증
const validateEnvironment = () => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'GEMINI_API_KEY', 
    'JWT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('⚠️ 필수 환경 변수가 누락되었습니다:', missingVars);
    
    // 프로덕션 환경에서는 오류로 처리
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ 프로덕션 환경에서는 모든 환경 변수가 필수입니다.');
      console.error('📝 .env 파일을 생성하고 필요한 환경 변수들을 설정해주세요.');
      process.exit(1);
    }
    
    console.log('🔧 개발 환경에서 기본값을 사용합니다.');
    
    // 개발 환경에서만 기본값 설정
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'development_jwt_secret_key_change_in_production_make_it_32_chars_plus';
    }
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/knowledge_explorer';
    }
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ GEMINI_API_KEY가 설정되지 않았습니다. API 호출이 실패할 수 있습니다.');
      process.env.GEMINI_API_KEY = 'placeholder_gemini_api_key';
    }
  }

  // JWT 시크릿 키 강도 검증
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ 프로덕션에서 JWT_SECRET은 최소 32자 이상이어야 합니다.');
      process.exit(1);
    } else {
      console.log('⚠️ JWT_SECRET이 32자 미만입니다. 프로덕션에서는 더 긴 키를 사용하세요.');
    }
  }

  // 환경에 따른 메시지
  const envStatus = process.env.NODE_ENV === 'production' ? '프로덕션' : '개발';
  console.log(`✅ 환경 변수 검증 완료 (${envStatus} 모드)`);
};

// 요청 본문 검증
const validateRequestBody = (schema) => {
  return (req, res, next) => {
    try {
      if (!req.body) {
        return res.status(400).json({
          error: {
            code: 'MISSING_BODY',
            message: '요청 본문이 필요합니다.',
            details: 'Request body is required'
          },
          timestamp: new Date().toISOString()
        });
      }

      // 스키마 검증 (간단한 구현)
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        
        if (rules.required && !value) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `필수 필드가 누락되었습니다: ${field}`,
              details: `Required field missing: ${field}`
            },
            timestamp: new Date().toISOString()
          });
        }

        if (value && rules.type && typeof value !== rules.type) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `잘못된 데이터 타입입니다: ${field}`,
              details: `Invalid data type for: ${field}`
            },
            timestamp: new Date().toISOString()
          });
        }

        if (value && rules.minLength && value.length < rules.minLength) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `최소 길이를 만족하지 않습니다: ${field}`,
              details: `Minimum length not met for: ${field}`
            },
            timestamp: new Date().toISOString()
          });
        }

        if (value && rules.maxLength && value.length > rules.maxLength) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: `최대 길이를 초과했습니다: ${field}`,
              details: `Maximum length exceeded for: ${field}`
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      next();
    } catch (error) {
      console.error('❌ 요청 검증 실패:', error);
      return res.status(500).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '요청 검증 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

// 채팅 메시지 검증 스키마
const chatMessageSchema = {
  message: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 10000
  }
};

// 테이블별 Key 검증 함수
const validateTableKey = (tableName, keyValue) => {
  const validKeys = {
    'users': /^\d+$/,                    // user_id는 숫자
    'chat_sessions': /^[a-zA-Z0-9_-]+$/, // chat_id는 문자열 (알파벳, 숫자, 언더스코어, 하이픈) - temp_ 포함
    'messages': /^\d+$/,                 // message_id는 숫자
    'user_memories': /^\d+$/,            // memory_id는 숫자
    'user_sessions': /^\d+$/,            // session_id는 숫자
    'admin_users': /^\d+$/               // admin_id는 숫자
  };
  
  return validKeys[tableName]?.test(keyValue) || false;
};

// Key 검증 미들웨어
const validateKey = (paramName, tableName) => {
  return (req, res, next) => {
    const keyValue = req.params[paramName];
    
    if (!keyValue) {
      return res.status(400).json({
        error: {
          code: 'MISSING_KEY',
          message: `필수 매개변수가 누락되었습니다: ${paramName}`,
          details: `Required parameter missing: ${paramName}`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!validateTableKey(tableName, keyValue)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_KEY',
          message: `잘못된 ${paramName} 형식입니다.`,
          details: `Invalid ${paramName} format for table: ${tableName}`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// 사용자 프로필 업데이트 스키마
const profileUpdateSchema = {
  name: {
    required: false,
    type: 'string',
    maxLength: 100
  },
  company: {
    required: false,
    type: 'string',
    maxLength: 100
  },
  role: {
    required: false,
    type: 'string',
    maxLength: 50
  }
};

module.exports = {
  validateEnvironment,
  validateRequestBody,
  validateKey,
  validateTableKey,
  chatMessageSchema,
  profileUpdateSchema
};
