const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...');
    
    // 1. 기존 테이블 구조 확인
    console.log('📋 Checking existing table structure...');
    
    // users 테이블이 존재하는지 확인
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('ℹ️  Users table already exists, checking structure...');
      
      // 기존 컬럼 확인
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      
      console.log('Current columns:', columns.rows.map(col => col.column_name));
      
      // 필요한 컬럼들 추가
      const requiredColumns = [
        { name: 'name', type: 'VARCHAR(100) NOT NULL DEFAULT \'기본 사용자\'' },
        { name: 'company', type: 'VARCHAR(100)' },
        { name: 'role', type: 'VARCHAR(50)' },
        { name: 'deleted_at', type: 'TIMESTAMP NULL' }
      ];
      
      for (const column of requiredColumns) {
        const columnExists = columns.rows.some(col => col.column_name === column.name);
        if (!columnExists) {
          try {
            await pool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
            console.log(`✅ Added column: ${column.name}`);
          } catch (error) {
            console.log(`⚠️  Could not add column ${column.name}:`, error.message);
          }
        } else {
          console.log(`ℹ️  Column ${column.name} already exists`);
        }
      }
    } else {
      // 새로 테이블 생성
      console.log('🏗️  Creating new users table...');
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          company VARCHAR(100),
          role VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        )
      `);
      console.log('✅ Users table created');
    }
    
    // chat_sessions 테이블에 user_id 컬럼 추가
    try {
      await pool.query(`
        ALTER TABLE chat_sessions 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✅ Added user_id column to chat_sessions');
    } catch (error) {
      console.log('ℹ️  user_id column might already exist');
    }
    
    // 기본 사용자 생성 (기존 데이터를 위한)
    const defaultUserResult = await pool.query(`
      INSERT INTO users (email, name, company, role, username)
      VALUES ('default@example.com', '기본 사용자', '기본 회사', 'user', 'default_user')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `);
    
    let defaultUserId;
    if (defaultUserResult.rows.length > 0) {
      defaultUserId = defaultUserResult.rows[0].id;
      console.log(`✅ Created default user with ID: ${defaultUserId}`);
    } else {
      const existingUser = await pool.query(`
        SELECT id FROM users WHERE email = 'default@example.com'
      `);
      defaultUserId = existingUser.rows[0].id;
      console.log(`✅ Using existing default user with ID: ${defaultUserId}`);
    }
    
    // 기존 chat_sessions의 user_id를 기본 사용자로 설정
    await pool.query(`
      UPDATE chat_sessions 
      SET user_id = $1 
      WHERE user_id IS NULL
    `, [defaultUserId]);
    console.log('✅ Updated existing chat sessions with default user');
    
    // 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    
    console.log('✅ Indexes created/updated');
    
    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 마이그레이션 실행
migrateDatabase().catch(console.error);
