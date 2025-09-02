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
      
      // 필요한 컬럼들 추가 (Google OAuth 지원)
      const requiredColumns = [
        { name: 'name', type: 'VARCHAR(100) NOT NULL DEFAULT \'기본 사용자\'' },
        { name: 'company', type: 'VARCHAR(100)' },
        { name: 'role', type: 'VARCHAR(50)' },
        { name: 'google_id', type: 'VARCHAR(255) UNIQUE' },
        { name: 'profile_picture', type: 'VARCHAR(500)' },
        { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
        { name: 'last_login', type: 'TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
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
      // 새로 테이블 생성 (Google OAuth 지원)
      console.log('🏗️  Creating new users table...');
      await pool.query(`
        CREATE TABLE users (
          user_id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          company VARCHAR(100),
          role VARCHAR(50),
          google_id VARCHAR(255) UNIQUE,
          customer_id VARCHAR(100) UNIQUE,
          profile_picture VARCHAR(500),
          is_active BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMP,
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
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE
      `);
      console.log('✅ Added user_id column to chat_sessions');
    } catch (error) {
      console.log('ℹ️  user_id column might already exist');
    }

    // messages 테이블의 user_id 외래키 제약조건을 CASCADE로 변경
    try {
      // 기존 제약조건 확인
      const constraintQuery = `
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'messages' 
        AND constraint_type = 'FOREIGN KEY' 
        AND constraint_name LIKE '%user_id%'
      `;
      const constraintResult = await pool.query(constraintQuery);
      
      if (constraintResult.rows.length > 0) {
        // 기존 제약조건 삭제
        for (const row of constraintResult.rows) {
          await pool.query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS ${row.constraint_name}`);
          console.log(`✅ Dropped existing constraint: ${row.constraint_name}`);
        }
      }
      
      // 새로운 CASCADE 제약조건 추가
      await pool.query(`
        ALTER TABLE messages 
        ADD CONSTRAINT fk_messages_user_id 
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      `);
      console.log('✅ Added CASCADE constraint for messages.user_id');
    } catch (error) {
      console.log('⚠️  Could not update messages.user_id constraint:', error.message);
    }

    // user_memories 테이블이 있다면 user_id 외래키 제약조건 확인
    try {
      const memoriesTableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_memories'
        )
      `);
      
      if (memoriesTableExists.rows[0].exists) {
        // user_memories 테이블의 user_id 외래키 제약조건을 CASCADE로 변경
        const constraintQuery = `
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_name = 'user_memories' 
          AND constraint_type = 'FOREIGN KEY' 
          AND constraint_name LIKE '%user_id%'
        `;
        const constraintResult = await pool.query(constraintQuery);
        
        if (constraintResult.rows.length > 0) {
          // 기존 제약조건 삭제
          for (const row of constraintResult.rows) {
            await pool.query(`ALTER TABLE user_memories DROP CONSTRAINT IF EXISTS ${row.constraint_name}`);
            console.log(`✅ Dropped existing constraint: ${row.constraint_name}`);
          }
        }
        
        // 새로운 CASCADE 제약조건 추가
        await pool.query(`
          ALTER TABLE user_memories 
          ADD CONSTRAINT fk_user_memories_user_id 
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        `);
        console.log('✅ Added CASCADE constraint for user_memories.user_id');
      }
    } catch (error) {
      console.log('⚠️  Could not update user_memories.user_id constraint:', error.message);
    }
    
    // 기본 사용자 생성 (기존 데이터를 위한)
    const defaultUserResult = await pool.query(`
      INSERT INTO users (email, name, company, role, username)
      VALUES ('default@example.com', '기본 사용자', '기본 회사', 'user', 'default_user')
      ON CONFLICT (email) DO NOTHING
      RETURNING user_id
    `);
    
    let defaultUserId;
    if (defaultUserResult.rows.length > 0) {
      defaultUserId = defaultUserResult.rows[0].user_id;
      console.log(`✅ Created default user with ID: ${defaultUserId}`);
    } else {
      const existingUser = await pool.query(`
        SELECT user_id FROM users WHERE email = 'default@example.com'
      `);
      defaultUserId = existingUser.rows[0].user_id;
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
    
    // 💬 채팅 세션 테이블 생성
    console.log('💬 Creating chat_sessions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        chat_id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT '새 대화',
        context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    
    // 채팅 세션 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC)
    `);
    
    console.log('✅ Chat sessions table and indexes created');
    
    // 💭 메시지 테이블 생성
    console.log('💭 Creating messages table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id SERIAL PRIMARY KEY,
        chat_id VARCHAR(50) REFERENCES chat_sessions(chat_id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'model')),
        sources JSONB DEFAULT '[]',
        follow_up_questions JSONB DEFAULT '[]',
        context TEXT,
        status VARCHAR(20) DEFAULT 'sent',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 메시지 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp ASC)
    `);
    
    console.log('✅ Messages table and indexes created');
    
    // 🧠 사용자 장기 메모리 테이블 생성
    console.log('🧠 Creating user_memories table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memories (
        memory_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        memory_type VARCHAR(50) NOT NULL DEFAULT 'conversation',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
        tags TEXT[],
        chat_id VARCHAR(50) REFERENCES chat_sessions(chat_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    
    // 사용자 메모리 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_memory_type ON user_memories(memory_type)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_tags ON user_memories USING GIN(tags)
    `);
    
    console.log('✅ User memories table and indexes created');
    
    // 🔐 사용자 세션 테이블 생성
    console.log('🔐 Creating user_sessions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    
    // 사용자 세션 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)
    `);
    
    console.log('✅ User sessions table and indexes created');
    
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
