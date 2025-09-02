// ============================================================================
// AUTH MIDDLEWARE - JWT 토큰 검증 및 사용자 인증
// ============================================================================

const { verifyToken, getUserById } = require('../services/authService');

// JWT 토큰 검증 미들웨어 (비동기 처리)
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('🔐 authenticateToken 호출:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token?.length,
    url: req.url,
    method: req.method
  });

  if (!token) {
    console.log('❌ 토큰 없음 - 401 반환');
    return res.status(401).json({
      error: {
        code: 'TOKEN_MISSING',
        message: '인증 토큰이 필요합니다.',
        details: 'Authorization 헤더에 Bearer 토큰을 포함해주세요.'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('🔍 토큰 검증 시작');
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      console.log('❌ 토큰 검증 실패 - 403 반환');
      return res.status(403).json({
        error: {
          code: 'TOKEN_INVALID',
          message: '유효하지 않은 토큰입니다.',
          details: '토큰이 만료되었거나 형식이 올바르지 않습니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ 토큰 검증 성공:', {
      userId: decoded.userId,
      email: decoded.email
    });

    // 사용자 정보를 요청 객체에 추가
    req.user = {
      user_id: decoded.userId, // 데이터베이스의 user_id 컬럼 사용
      email: decoded.email,
      name: decoded.name,
      googleId: decoded.googleId
    };
    next();
  } catch (error) {
    console.error('❌ 토큰 검증 중 오류:', error);
    return res.status(403).json({
      error: {
        code: 'TOKEN_VERIFICATION_FAILED',
        message: '토큰 검증에 실패했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없으면 익명 사용자로 처리)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // 토큰이 없으면 익명 사용자로 처리 (userId: null)
    req.user = null;
    return next();
  }

  try {
    const decoded = await verifyToken(token);
    if (!decoded) {
      // 토큰이 유효하지 않으면 익명 사용자로 처리
      req.user = null;
      return next();
    }

    // 토큰이 유효하면 사용자 정보를 DB에서 가져와서 추가
    const user = await getUserById(decoded.userId);
    if (!user || !user.is_active) {
      req.user = null;
      return next();
    }

        req.user = {
              user_id: user.user_id, // 데이터베이스의 user_id 컬럼 사용
      email: user.email,
      name: user.name,
      googleId: user.google_id,
      profilePicture: user.profile_picture
    };
    next();
  } catch (error) {
    console.error('❌ 선택적 인증 실패:', error);
    // 오류가 발생해도 익명 사용자로 진행
    req.user = null;
    next();
  }
}

// 관리자 권한 확인 미들웨어
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
        details: '로그인이 필요합니다.'
      },
      timestamp: new Date().toISOString()
    });
  }

  // 여기서는 간단히 이메일로 관리자 확인
  // 실제로는 users 테이블에 role 필드를 사용
  const adminEmails = ['admin@example.com']; // 관리자 이메일 목록
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      error: {
        code: 'ADMIN_ACCESS_REQUIRED',
        message: '관리자 권한이 필요합니다.',
        details: '이 기능에 접근할 권한이 없습니다.'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin
};
