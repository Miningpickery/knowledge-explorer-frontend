const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupAdmin() {
  try {
    console.log('🔍 관리자 설정 시작...');
    
    // 1. 사용자 확인
    const userResult = await pool.query(
      'SELECT user_id, email, name FROM users WHERE email = $1',
      ['miningpickery@gmail.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('⚠️ 사용자를 찾을 수 없습니다: miningpickery@gmail.com');
      console.log('📝 먼저 해당 이메일로 로그인해주세요.');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ 사용자 발견:', user);
    
    // 2. 관리자 권한 부여
    const adminResult = await pool.query(
      `INSERT INTO admin_users (user_id, email, role, permissions) 
       VALUES ($1, $2, 'super_admin', ARRAY['database_read', 'database_write', 'user_management', 'system_admin']) 
       ON CONFLICT (email) DO NOTHING 
       RETURNING *`,
      [user.user_id || user.id, user.email]
    );
    
    if (adminResult.rows.length > 0) {
      console.log('✅ 관리자 권한 부여 완료:', adminResult.rows[0]);
    } else {
      console.log('ℹ️ 이미 관리자 권한이 있습니다.');
    }
    
    // 3. 관리자 목록 확인
    const adminUsers = await pool.query(`
      SELECT au.admin_id, au.email, au.role, au.permissions, u.name
      FROM admin_users au
      JOIN users u ON au.user_id = u.user_id
      WHERE au.email = $1
    `, [email]);
    
    console.log('📋 현재 관리자 목록:');
    adminList.rows.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.name}) - ${admin.role}`);
    });
    
  } catch (error) {
    console.error('❌ 관리자 설정 실패:', error);
  } finally {
    await pool.end();
  }
}

setupAdmin();
