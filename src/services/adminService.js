const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 초기 관리자 이메일
const INITIAL_ADMIN_EMAIL = 'miningpickery@gmail.com';

// 관리자 테이블 초기화
const initializeAdminTables = async () => {
  try {
    // admin_users 테이블 생성
    const createAdminUsersTable = `
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
        permissions TEXT[] DEFAULT ARRAY['database_read', 'database_write'],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // admin_permissions 테이블 생성
    const createAdminPermissionsTable = `
      CREATE TABLE IF NOT EXISTS admin_permissions (
        permission_id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admin_users(admin_id) ON DELETE CASCADE,
        permission_name VARCHAR(100) NOT NULL,
        permission_value JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // admin_backups 테이블 생성
    const createAdminBackupsTable = `
      CREATE TABLE IF NOT EXISTS admin_backups (
        backup_id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(255) NOT NULL,
        description TEXT
      );
    `;

    // admin_restores 테이블 생성
    const createAdminRestoresTable = `
      CREATE TABLE IF NOT EXISTS admin_restores (
        restore_id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        restored_at TIMESTAMP DEFAULT NOW(),
        restored_by VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT
      );
    `;

    await pool.query(createAdminUsersTable);
    await pool.query(createAdminPermissionsTable);
    await pool.query(createAdminBackupsTable);
    await pool.query(createAdminRestoresTable);

    // admin_users 테이블 마이그레이션 (기존 id 컬럼을 admin_id로 변경)
    try {
      // 먼저 id 컬럼이 존재하는지 확인
      const checkIdColumn = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'id'
      `);
      
      if (checkIdColumn.rows.length > 0) {
        await pool.query(`ALTER TABLE admin_users RENAME COLUMN id TO admin_id;`);
        console.log('✅ admin_users.id를 admin_id로 변경 완료');
      } else {
        console.log('⚠️ admin_users 테이블은 이미 admin_id 컬럼을 사용 중');
      }
    } catch (error) {
      console.log('⚠️ admin_users 테이블 컬럼 변경 실패:', error.message);
    }

    // admin_permissions 테이블 마이그레이션 (기존 id 컬럼을 permission_id로 변경)
    try {
      // 먼저 id 컬럼이 존재하는지 확인
      const checkIdColumn = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'admin_permissions' AND column_name = 'id'
      `);
      
      if (checkIdColumn.rows.length > 0) {
        await pool.query(`ALTER TABLE admin_permissions RENAME COLUMN id TO permission_id;`);
        console.log('✅ admin_permissions.id를 permission_id로 변경 완료');
      } else {
        console.log('⚠️ admin_permissions 테이블은 이미 permission_id 컬럼을 사용 중');
      }
    } catch (error) {
      console.log('⚠️ admin_permissions 테이블 컬럼 변경 실패:', error.message);
    }

    // 초기 관리자 설정
    await setupInitialAdmin();

    console.log('✅ 관리자 테이블 초기화 완료');
  } catch (error) {
    console.error('❌ 관리자 테이블 초기화 실패:', error);
    throw error;
  }
};

// 초기 관리자 설정
const setupInitialAdmin = async () => {
  try {
    // 기존 사용자 중에서 초기 관리자 이메일 찾기
    const findUserQuery = `
      SELECT user_id, email, name 
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL
    `;
    
    const userResult = await pool.query(findUserQuery, [INITIAL_ADMIN_EMAIL]);
    
    if (userResult.rows.length === 0) {
      console.log('⚠️ 초기 관리자 사용자가 존재하지 않습니다. 사용자가 로그인하면 자동으로 권한이 부여됩니다.');
      return;
    }

    const user = userResult.rows[0];

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
    console.error('❌ 초기 관리자 설정 실패:', error);
    throw error;
  }
};

// 관리자 권한 확인
const checkAdminPermission = async (email, requiredPermissions = []) => {
  try {
    const query = `
      SELECT au.admin_id, au.role, au.permissions, u.name
      FROM admin_users au
      JOIN users u ON au.user_id = u.user_id
      WHERE au.email = $1 AND u.deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return { isAdmin: false, permissions: [], role: null };
    }

    const admin = result.rows[0];
    const isSuperAdmin = admin.role === 'super_admin';
    
    // super_admin은 모든 권한을 가짐
    if (isSuperAdmin) {
      return {
        isAdmin: true,
        permissions: ['all'],
        role: admin.role,
        name: admin.name
      };
    }

    // 일반 관리자는 지정된 권한만 확인
    const hasRequiredPermissions = requiredPermissions.every(permission => 
      admin.permissions.includes(permission) || admin.permissions.includes('all')
    );

    return {
      isAdmin: hasRequiredPermissions,
      permissions: admin.permissions,
      role: admin.role,
      name: admin.name
    };
  } catch (error) {
    console.error('❌ 관리자 권한 확인 실패:', error);
    return { isAdmin: false, permissions: [], role: null };
  }
};

// 관리자 목록 조회
const getAdminUsers = async () => {
  try {
    const query = `
      SELECT au.admin_id, au.email, au.role, au.permissions, au.created_at, au.updated_at,
             u.name, u.company, u.role as user_role
      FROM admin_users au
      JOIN users u ON au.user_id = u.user_id
      WHERE u.deleted_at IS NULL
      ORDER BY au.created_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('❌ 관리자 목록 조회 실패:', error);
    throw error;
  }
};

// 관리자 권한 부여
const grantAdminPermission = async (targetEmail, permissions = ['database_read'], grantedBy = null) => {
  try {
    // 대상 사용자 찾기
    const findUserQuery = `
      SELECT user_id, email, name 
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL
    `;
    
    const userResult = await pool.query(findUserQuery, [targetEmail]);
    
    if (userResult.rows.length === 0) {
      throw new Error(`사용자를 찾을 수 없습니다: ${targetEmail}`);
    }

    const user = userResult.rows[0];

    // 이미 관리자인지 확인
    const checkAdminQuery = `
      SELECT admin_id FROM admin_users WHERE user_id = $1
    `;
    
    const adminResult = await pool.query(checkAdminQuery, [user.user_id]);
    
    if (adminResult.rows.length > 0) {
      // 기존 권한 업데이트
      const updateQuery = `
        UPDATE admin_users 
        SET permissions = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING admin_id, email, role, permissions
      `;
      
      const result = await pool.query(updateQuery, [permissions, user.user_id]);
      console.log(`✅ 기존 관리자 권한 업데이트: ${targetEmail}`);
      return result.rows[0];
    } else {
      // 새로운 관리자 추가
      const insertQuery = `
        INSERT INTO admin_users (user_id, email, role, permissions)
        VALUES ($1, $2, 'admin', $3)
        RETURNING admin_id, email, role, permissions
      `;
      
      const result = await pool.query(insertQuery, [user.user_id, targetEmail, permissions]);
      console.log(`✅ 새로운 관리자 권한 부여: ${targetEmail}`);
      return result.rows[0];
    }
  } catch (error) {
    console.error('❌ 관리자 권한 부여 실패:', error);
    throw error;
  }
};

// 관리자 권한 해제
const revokeAdminPermission = async (targetEmail, revokedBy = null) => {
  try {
    // 대상 사용자 찾기
    const findUserQuery = `
      SELECT user_id, email, name 
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL
    `;
    
    const userResult = await pool.query(findUserQuery, [targetEmail]);
    
    if (userResult.rows.length === 0) {
      throw new Error(`사용자를 찾을 수 없습니다: ${targetEmail}`);
    }

    const user = userResult.rows[0];

    // 관리자 권한 삭제
    const deleteQuery = `
      DELETE FROM admin_users 
      WHERE user_id = $1 AND email != $2
      RETURNING admin_id, email, role
    `;
    
    const result = await pool.query(deleteQuery, [user.user_id, INITIAL_ADMIN_EMAIL]);
    
    if (result.rows.length === 0) {
      throw new Error('관리자 권한이 없거나 초기 관리자는 삭제할 수 없습니다.');
    }

    console.log(`✅ 관리자 권한 해제: ${targetEmail}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ 관리자 권한 해제 실패:', error);
    throw error;
  }
};

// 시스템 상태 조회
const getSystemHealth = async () => {
  try {
    // 데이터베이스 상태
    const dbQuery = 'SELECT NOW() as current_time, version() as db_version';
    const dbResult = await pool.query(dbQuery);
    
    // 테이블별 레코드 수
    const tables = ['users', 'chat_sessions', 'messages', 'user_memories', 'security_threats', 'user_sessions'];
    const recordCounts = {};
    
    for (const table of tables) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table}`;
        const countResult = await pool.query(countQuery);
        recordCounts[table] = parseInt(countResult.rows[0].count);
      } catch (error) {
        recordCounts[table] = 0;
      }
    }

    return {
      database: {
        status: 'connected',
        timestamp: dbResult.rows[0].current_time,
        version: dbResult.rows[0].db_version.split('\n')[0],
        recordCounts
      },
      api: {
        status: 'running',
        responseTime: Date.now(),
        uptime: process.uptime()
      },
      frontend: {
        status: 'connected',
        version: process.env.npm_package_version || '1.0.0'
      }
    };
  } catch (error) {
    console.error('❌ 시스템 상태 조회 실패:', error);
    throw error;
  }
};

// 데이터베이스 테이블 조회
const getDatabaseTables = async () => {
  try {
    // 모든 테이블 목록 조회
    const tablesQuery = `
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.table_name);
    
    const tableList = [];
    
    for (const tableName of tables) {
      try {
        // 레코드 수 조회
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countResult = await pool.query(countQuery);
        
        // 테이블 구조 조회 (컬럼명만)
        const columnsQuery = `
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await pool.query(columnsQuery, [tableName]);
        const columns = columnsResult.rows.map(row => row.column_name);
        
        tableList.push({
          tableName,
          recordCount: parseInt(countResult.rows[0].count),
          columns
        });
      } catch (error) {
        console.error(`❌ 테이블 ${tableName} 조회 실패:`, error);
        tableList.push({
          tableName,
          recordCount: 0,
          columns: [],
          error: error.message
        });
      }
    }
    
    return tableList;
  } catch (error) {
    console.error('❌ 데이터베이스 테이블 조회 실패:', error);
    throw error;
  }
};

// 특정 테이블 데이터 조회
const getTableData = async (tableName, limit = 50, offset = 0) => {
  try {
    // 테이블 존재 확인
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    
    const tableExistsResult = await pool.query(tableExistsQuery, [tableName]);
    
    if (!tableExistsResult.rows[0].exists) {
      throw new Error(`테이블이 존재하지 않습니다: ${tableName}`);
    }
    
    // 테이블 구조 조회
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery, [tableName]);
    
    // 테이블 데이터 조회
    const dataQuery = `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`;
    const dataResult = await pool.query(dataQuery, [limit, offset]);
    
    // 전체 레코드 수 조회
    const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countResult = await pool.query(countQuery);
    
    return {
      tableName,
      columns: columnsResult.rows,
      data: dataResult.rows,
      totalCount: parseInt(countResult.rows[0].count),
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      limit,
      offset
    };
  } catch (error) {
    console.error(`❌ 테이블 ${tableName} 데이터 조회 실패:`, error);
    throw error;
  }
};

module.exports = {
  initializeAdminTables,
  checkAdminPermission,
  getAdminUsers,
  grantAdminPermission,
  revokeAdminPermission,
  getSystemHealth,
  getDatabaseTables,
  getTableData,
  setupInitialAdmin
};
