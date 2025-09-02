// ============================================================================
// AUTH SERVICE - Google OAuth 인증 및 JWT 토큰 관리
// ============================================================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// JWT 시크릿 키 (환경변수에서 가져오거나 안전한 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'knowledge-explorer-secret-key-2024-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7일

// JWT 설정 로깅 (개발 환경에서만)
console.log('🔐 JWT 설정:', {
  secret: process.env.JWT_SECRET ? '환경변수에서 설정됨' : '기본값 사용',
  expiresIn: JWT_EXPIRES_IN,
  env: process.env.NODE_ENV || 'development'
});

// Google OAuth 사용자 정보로 사용자 생성 또는 업데이트
async function createOrUpdateGoogleUser(googleProfile) {
  try {
    const { id: googleId, displayName, emails, photos } = googleProfile;
    const email = emails[0].value;
    const profilePicture = photos[0]?.value;
    
    // username 생성 (email에서 @ 앞부분 사용)
    const username = `${email.split('@')[0]  }_${  googleId.slice(-6)}`;

    // 기존 사용자 확인
    let user = await getUserByGoogleId(googleId);
    
    if (!user) {
      // 새 사용자 생성
      const query = `
        INSERT INTO users (google_id, email, name, username, profile_picture, last_login)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING user_id, email, name, username, company, role, google_id, profile_picture, is_active, last_login, created_at, updated_at
      `;
      
      const result = await pool.query(query, [googleId, email, displayName, username, profilePicture]);
      user = result.rows[0];
      console.log(`✅ 새 Google 사용자 생성: ${email} (username: ${username})`);
      
      // 초기 관리자 권한 부여 (miningpickery@gmail.com인 경우)
      if (email === 'miningpickery@gmail.com') {
        await grantInitialAdminPermission(user);
      }
    } else {
      // 기존 사용자 정보 업데이트
      const query = `
        UPDATE users 
        SET name = $1, profile_picture = $2, last_login = NOW(), updated_at = NOW()
        WHERE google_id = $3
        RETURNING user_id, email, name, username, company, role, google_id, profile_picture, is_active, last_login, created_at, updated_at
      `;
      
      const result = await pool.query(query, [displayName, profilePicture, googleId]);
      user = result.rows[0];
      console.log(`✅ 기존 Google 사용자 업데이트: ${email}`);
      
      // 기존 사용자도 관리자 권한 확인
      if (email === 'miningpickery@gmail.com') {
        await grantInitialAdminPermission(user);
      }
    }

    return user;
  } catch (error) {
    console.error('❌ Google 사용자 생성/업데이트 실패:', error);
    throw error;
  }
}

// 초기 관리자 권한 부여
async function grantInitialAdminPermission(user) {
  try {
    // admin_users 테이블이 존재하는지 확인
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      ) as exists;
    `;
    
    const tableResult = await pool.query(checkTableQuery);
    if (!tableResult.rows[0].exists) {
      console.log('⚠️ admin_users 테이블이 존재하지 않습니다. 관리자 권한 부여를 건너뜁니다.');
      return;
    }

    // 이미 관리자인지 확인
    const checkAdminQuery = `
      SELECT admin_id FROM admin_users WHERE user_id = $1
    `;
    
    const adminResult = await pool.query(checkAdminQuery, [user.user_id]);
    
    if (adminResult.rows.length === 0) {
      // 관리자 권한 부여
      const insertAdminQuery = `
        INSERT INTO admin_users (user_id, email, role, permissions)
        VALUES ($1, $2, 'super_admin', ARRAY['database_read', 'database_write', 'user_management', 'system_admin'])
        ON CONFLICT (email) DO NOTHING
      `;
      
      await pool.query(insertAdminQuery, [user.user_id, user.email]);
      console.log(`✅ 초기 관리자 권한 부여 완료: ${user.email}`);
    } else {
      console.log(`✅ 초기 관리자 이미 존재: ${user.email}`);
    }
  } catch (error) {
    console.error('❌ 초기 관리자 권한 부여 실패:', error);
    // 권한 부여 실패해도 로그인은 계속 진행
  }
}

// Google ID로 사용자 조회
async function getUserByGoogleId(googleId) {
  try {
    const query = `
      SELECT user_id, email, name, username, company, role, google_id, profile_picture, is_active, last_login, created_at, updated_at
      FROM users
      WHERE google_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [googleId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Google ID로 사용자 조회 실패:', error);
    throw error;
  }
}

// JWT 토큰 생성 (보안 강화)
function generateToken(user) {
  const payload = {
    userId: user.user_id,
    email: user.email,
    name: user.name,
    googleId: user.google_id,
    iat: Math.floor(Date.now() / 1000), // 발급 시간
    jti: crypto.randomBytes(16).toString('hex') // 고유 토큰 ID
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'knowledge-explorer',
    audience: 'knowledge-explorer-users'
  });
};

// JWT 토큰 검증 (블랙리스트 확인 포함)
async function verifyToken(token) {
  try {
    // 토큰 블랙리스트 확인
    const isBlacklisted = await checkTokenBlacklist(token);
    if (isBlacklisted) {
      console.log('❌ 블랙리스트된 토큰 사용 시도');
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'knowledge-explorer',
      audience: 'knowledge-explorer-users'
    });

    return decoded;
  } catch (error) {
    console.error('❌ JWT 토큰 검증 실패:', error.message);
    return null;
  }
}

// 토큰 블랙리스트 확인
async function checkTokenBlacklist(token) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const query = `
      SELECT session_id FROM user_sessions 
      WHERE token_hash = $1 AND is_active = FALSE
    `;
    const result = await pool.query(query, [tokenHash]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ 토큰 블랙리스트 확인 실패:', error);
    return false;
  }
}

// 토큰 블랙리스트에 추가 (로그아웃 시)
async function blacklistToken(token) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE token_hash = $1
    `;
    await pool.query(query, [tokenHash]);
    console.log('✅ 토큰이 블랙리스트에 추가되었습니다');
  } catch (error) {
    console.error('❌ 토큰 블랙리스트 추가 실패:', error);
    throw error;
  }
}

// 사용자 ID로 사용자 조회
async function getUserById(userId) {
  try {
    const query = `
      SELECT user_id, email, name, username, company, role, google_id, profile_picture, is_active, last_login, created_at, updated_at
      FROM users
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    const user = result.rows[0] || null;
    
    if (user) {
      console.log(`✅ 사용자 조회 성공: ${user.email} (name: ${user.name}, username: ${user.username})`);
    }
    
    return user;
  } catch (error) {
    console.error('❌ 사용자 ID로 조회 실패:', error);
    throw error;
  }
}

// 사용자 프로필 업데이트
async function updateUserProfile(userId, updates) {
  try {
    let query = 'UPDATE users SET updated_at = NOW()';
    const params = [];
    let paramIndex = 1;
    
    if (updates.name) {
      query += `, name = $${paramIndex++}`;
      params.push(updates.name);
    }
    
    if (updates.username !== undefined) {
      query += `, username = $${paramIndex++}`;
      params.push(updates.username);
    }
    
    query += ` WHERE user_id = $${paramIndex} AND deleted_at IS NULL`;
    params.push(userId);
    
    const result = await pool.query(query, params);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    return await getUserById(userId);
  } catch (error) {
    console.error('❌ 사용자 프로필 업데이트 실패:', error);
    throw error;
  }
}

// 사용자 비활성화 (소프트 삭제)
async function deactivateUser(userId) {
  try {
    const query = `
      UPDATE users 
      SET is_active = FALSE, deleted_at = NOW(), updated_at = NOW() 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    console.log(`✅ 사용자 비활성화 완료: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ 사용자 비활성화 실패:', error);
    throw error;
  }
}

// 고객 ID로 사용자 조회
async function getUserByCustomerId(customerId) {
  try {
    const query = `
      SELECT user_id, email, name, username, company, role, google_id, customer_id, profile_picture, is_active, last_login, created_at, updated_at
      FROM users
      WHERE customer_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [customerId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Failed to get user by customer ID:', error);
    throw error;
  }
}

// 고객 ID 업데이트
async function updateCustomerId(userId, customerId) {
  try {
    const query = `
      UPDATE users 
      SET customer_id = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, email, name, customer_id
    `;
    
    const result = await pool.query(query, [customerId, userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to update customer ID:', error);
    throw error;
  }
}

// 고객 ID로 구글 사용자 연결
async function linkGoogleUserToCustomer(googleId, customerId) {
  try {
    const query = `
      UPDATE users 
      SET customer_id = $1, updated_at = NOW()
      WHERE google_id = $2
      RETURNING user_id, email, name, google_id, customer_id
    `;
    
    const result = await pool.query(query, [customerId, googleId]);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to link Google user to customer:', error);
    throw error;
  }
}

module.exports = {
  createOrUpdateGoogleUser,
  getUserByGoogleId,
  generateToken,
  verifyToken,
  getUserById,
  updateUserProfile,
  deactivateUser,
  blacklistToken,
  checkTokenBlacklist,
  getUserByCustomerId,
  updateCustomerId,
  linkGoogleUserToCustomer
};
