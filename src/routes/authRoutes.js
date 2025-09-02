// ============================================================================
// AUTH ROUTES - Google OAuth 인증 및 사용자 프로필 관리
// ============================================================================

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();
const authService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');

// Google OAuth 설정
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

// OAuth 설정 로깅
console.log('🔐 Google OAuth 설정:', {
  clientId: GOOGLE_CLIENT_ID ? '설정됨' : '기본값 사용',
  clientSecret: GOOGLE_CLIENT_SECRET ? '설정됨' : '기본값 사용',
  callbackUrl: GOOGLE_CALLBACK_URL,
  hasValidConfig: GOOGLE_CLIENT_ID !== 'your-google-client-id' && GOOGLE_CLIENT_SECRET !== 'your-google-client-secret'
});

// 실제 값 확인 (디버깅용)
console.log('🔍 실제 환경 변수 값:', {
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 20)  }...` : '없음',
  GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? `${GOOGLE_CLIENT_SECRET.substring(0, 10)  }...` : '없음'
});

if (GOOGLE_CLIENT_ID === 'your-google-client-id' || GOOGLE_CLIENT_SECRET === 'your-google-client-secret') {
  console.warn('⚠️ Google OAuth 설정이 기본값으로 되어 있습니다!');
  console.warn('📋 Google Console에서 OAuth 클라이언트를 생성하고 환경 변수를 설정해주세요:');
  console.warn('   - GOOGLE_CLIENT_ID=your_actual_client_id');
  console.warn('   - GOOGLE_CLIENT_SECRET=your_actual_client_secret');
}

// Passport Google Strategy 설정
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Google 프로필로 사용자 생성 또는 업데이트
    const user = await authService.createOrUpdateGoogleUser(profile);
    return done(null, user);
  } catch (error) {
    console.error('❌ Google OAuth 처리 실패:', error);
    return done(error, null);
  }
}));

// Passport 직렬화/역직렬화
passport.serializeUser((user, done) => {
          done(null, user.user_id);
});

passport.deserializeUser(async (userId, done) => {
  try {
    const user = await authService.getUserById(userId);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth 로그인 시작
router.get('/google', (req, res, next) => {
  console.log('🔐 Google OAuth 로그인 요청');
  
  // OAuth 설정 확인 - 실제 값이 있는지 확인
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || 
      GOOGLE_CLIENT_ID === 'your-google-client-id' || 
      GOOGLE_CLIENT_SECRET === 'your-google-client-secret') {
    console.error('❌ Google OAuth 설정 없음');
    return res.status(500).json({
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth가 설정되지 않았습니다.',
        details: [
          '1. Google Cloud Console에서 새 프로젝트 생성',
          '2. APIs & Services > Credentials에서 OAuth 2.0 클라이언트 ID 생성',
          '3. 승인된 리디렉션 URI에 http://localhost:3001/api/auth/google/callback 추가 (백엔드)',
          '4. 환경 변수 설정: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET'
        ],
        setupUrl: 'https://console.cloud.google.com/apis/credentials'
      }
    });
  }
  
  console.log('✅ Google OAuth 설정 확인됨, 인증 진행');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google OAuth 콜백 처리
router.get('/google/callback', 
  (req, res, next) => {
    console.log('🔍 Google OAuth 콜백 시작:', req.query);
    
    // HTML 엔티티 디코딩
    if (req.query.code) {
      req.query.code = req.query.code
        .replace(/&#x2F;/g, '/')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
      console.log('🔧 디코딩된 코드:', req.query.code);
    }
    
    next();
  },
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: '/login',
    failureFlash: true
  }),
  async (req, res) => {
    try {
      console.log('✅ Google OAuth 인증 성공:', req.user);
      
      // JWT 토큰 생성
      const token = authService.generateToken(req.user);
      
      // 프론트엔드로 리다이렉트 (토큰 포함)
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/auth/callback?token=${token}`;
      console.log('🔄 리다이렉트 URL:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ OAuth 콜백 처리 실패:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 내부 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 로그아웃
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // 토큰을 블랙리스트에 추가
      await authService.blacklistToken(token);
    }
    
    res.json({
      success: true,
      message: '로그아웃되었습니다.'
    });
  } catch (error) {
    console.error('❌ 로그아웃 실패:', error);
    res.status(500).json({
      error: {
        code: 'LOGOUT_FAILED',
        message: '로그아웃 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  console.log('🔍 /me 엔드포인트 호출됨:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    headers: req.headers,
    user: req.user
  });
  
  try {
    console.log('🔍 사용자 정보 조회 시작:', { userId: req.user.user_id });
    const user = await authService.getUserById(req.user.user_id);
    console.log('🔍 사용자 정보 조회 결과:', { 
      found: !!user, 
      userId: user?.user_id, 
      email: user?.email 
    });
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
          details: '사용자 ID가 유효하지 않습니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 민감한 정보 제외
    const { password, ...userInfo } = user;
    
    console.log('✅ 사용자 정보 조회 성공, 응답 전송:', {
      userId: userInfo.user_id,
      email: userInfo.email,
      name: userInfo.name
    });
    
    res.json({
      success: true,
      data: {
        ...userInfo,
        user_id: userInfo.user_id
      }
    });
    
    console.log('✅ 응답 전송 완료');
  } catch (error) {
    console.error('❌ 사용자 정보 조회 실패:', error);
    console.log('❌ 에러 응답 전송:', {
      status: 500,
      errorCode: 'USER_INFO_FAILED'
    });
    
    res.status(500).json({
      error: {
        code: 'USER_INFO_FAILED',
        message: '사용자 정보 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
    
    console.log('❌ 에러 응답 전송 완료');
  }
});

// 사용자 프로필 업데이트
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, username } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (username !== undefined) updates.username = username;

    const updatedUser = await authService.updateUserProfile(req.user.user_id, updates);
    
    res.json({
      success: true,
      data: updatedUser,
      message: '프로필이 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('❌ 프로필 업데이트 실패:', error);
    res.status(500).json({
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: '프로필 업데이트 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 계정 비활성화
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    await authService.deactivateUser(req.user.user_id);
    
    res.json({
      success: true,
      message: '계정이 성공적으로 비활성화되었습니다.'
    });
  } catch (error) {
    console.error('❌ 계정 비활성화 실패:', error);
    res.status(500).json({
      error: {
        code: 'ACCOUNT_DEACTIVATION_FAILED',
        message: '계정 비활성화 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 토큰 검증
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_MISSING',
          message: '토큰이 필요합니다.',
          details: '검증할 토큰을 제공해주세요.'
        },
        timestamp: new Date().toISOString()
      });
    }

    const decoded = await authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_INVALID',
          message: '유효하지 않은 토큰입니다.',
          details: '토큰이 만료되었거나 형식이 올바르지 않습니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 사용자 정보 조회
    const user = await authService.getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({
        error: {
          code: 'USER_INACTIVE',
          message: '비활성화된 사용자입니다.',
          details: '계정이 비활성화되었습니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
                 user: {
           user_id: user.user_id,
           email: user.email,
           name: user.name,
           googleId: user.google_id,
           profilePicture: user.profile_picture
         }
      }
    });
  } catch (error) {
    console.error('❌ 토큰 검증 실패:', error);
    res.status(500).json({
      error: {
        code: 'TOKEN_VERIFICATION_FAILED',
        message: '토큰 검증 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 고객 ID로 사용자 조회
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const user = await authService.getUserByCustomerId(customerId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '고객 ID에 해당하는 사용자를 찾을 수 없습니다.',
          details: `customerId: ${customerId}`
        }
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting user by customer ID:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 조회 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

// 고객 ID와 구글 ID 연결
router.post('/link-customer', async (req, res) => {
  try {
    const { googleId, customerId } = req.body;
    
    if (!googleId || !customerId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Google ID와 고객 ID는 필수입니다.',
          details: 'googleId and customerId are required'
        }
      });
    }
    
    const linkedUser = await authService.linkGoogleUserToCustomer(googleId, customerId);
    
    if (!linkedUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Google ID에 해당하는 사용자를 찾을 수 없습니다.',
          details: `googleId: ${googleId}`
        }
      });
    }
    
    res.json({
      success: true,
      message: '고객 ID와 구글 ID가 성공적으로 연결되었습니다.',
      user: linkedUser
    });
  } catch (error) {
    console.error('Error linking customer ID:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '고객 ID 연결 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

module.exports = router;
