const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCurrentSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 현재 데이터베이스 스키마 확인 중...');
    
    // users 테이블 구조 확인
    const usersResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 users 테이블 컬럼:', usersResult.rows.map(r => r.column_name));
    
    // chat_sessions 테이블 구조 확인
    const chatsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_sessions' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 chat_sessions 테이블 컬럼:', chatsResult.rows.map(r => r.column_name));
    
    // messages 테이블 구조 확인
    const messagesResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      ORDER BY ordinal_position;
    `);
    console.log('📋 messages 테이블 컬럼:', messagesResult.rows.map(r => r.column_name));
    
    // 기존 데이터 확인
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const chatCount = await client.query('SELECT COUNT(*) FROM chat_sessions');
    const messageCount = await client.query('SELECT COUNT(*) FROM messages');
    
    console.log('📊 기존 데이터 수:');
    console.log(`  - 사용자: ${userCount.rows[0].count}명`);
    console.log(`  - 채팅: ${chatCount.rows[0].count}개`);
    console.log(`  - 메시지: ${messageCount.rows[0].count}개`);
    
    return {
      users: usersResult.rows,
      chats: chatsResult.rows,
      messages: messagesResult.rows,
      counts: {
        users: parseInt(userCount.rows[0].count),
        chats: parseInt(chatCount.rows[0].count),
        messages: parseInt(messageCount.rows[0].count)
      }
    };
    
  } catch (error) {
    console.error('❌ 스키마 확인 실패:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrateDatabaseSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 데이터베이스 스키마 마이그레이션 시작...');
    
    // 먼저 현재 스키마 확인
    const currentSchema = await checkCurrentSchema();
    
    await client.query('BEGIN');
    
    // 1. users 테이블 - user_id 컬럼이 없으면 추가
    console.log('📝 users 테이블 확인 중...');
    const hasUserId = currentSchema.users.some(col => col.column_name === 'user_id');
    const hasId = currentSchema.users.some(col => col.column_name === 'id');
    
    if (!hasUserId && hasId) {
      console.log('🔄 users.id를 user_id로 변경 중...');
      await client.query(`ALTER TABLE users RENAME COLUMN id TO user_id;`);
      console.log('✅ users 테이블 컬럼명 변경 완료');
    } else if (hasUserId) {
      console.log('⚠️ users 테이블은 이미 user_id 컬럼을 사용 중');
    } else {
      console.log('❌ users 테이블에 id 또는 user_id 컬럼이 없음');
    }
    
    // 2. chat_sessions 테이블 - chat_id 컬럼이 없으면 추가
    console.log('📝 chat_sessions 테이블 확인 중...');
    const hasChatId = currentSchema.chats.some(col => col.column_name === 'chat_id');
    const hasChatIdOld = currentSchema.chats.some(col => col.column_name === 'id');
    
    if (!hasChatId && hasChatIdOld) {
      console.log('🔄 chat_sessions.id를 chat_id로 변경 중...');
      await client.query(`ALTER TABLE chat_sessions RENAME COLUMN id TO chat_id;`);
      console.log('✅ chat_sessions 테이블 컬럼명 변경 완료');
    } else if (hasChatId) {
      console.log('⚠️ chat_sessions 테이블은 이미 chat_id 컬럼을 사용 중');
    } else {
      console.log('❌ chat_sessions 테이블에 id 또는 chat_id 컬럼이 없음');
    }
    
    // 3. messages 테이블 - message_id 컬럼이 없으면 추가
    console.log('📝 messages 테이블 확인 중...');
    const hasMessageId = currentSchema.messages.some(col => col.column_name === 'message_id');
    const hasMessageIdOld = currentSchema.messages.some(col => col.column_name === 'id');
    
    if (!hasMessageId && hasMessageIdOld) {
      console.log('🔄 messages.id를 message_id로 변경 중...');
      await client.query(`ALTER TABLE messages RENAME COLUMN id TO message_id;`);
      console.log('✅ messages 테이블 컬럼명 변경 완료');
    } else if (hasMessageId) {
      console.log('⚠️ messages 테이블은 이미 message_id 컬럼을 사용 중');
    } else {
      console.log('❌ messages 테이블에 id 또는 message_id 컬럼이 없음');
    }
    
    // 4. 인덱스 생성 (성능 최적화)
    console.log('📊 인덱스 생성 중...');
    
    // chat_sessions 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
      ON chat_sessions(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
      ON chat_sessions(updated_at DESC);
    `);
    
    // messages 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id 
      ON messages(chat_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_user_id 
      ON messages(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
      ON messages(timestamp ASC);
    `);
    
    console.log('✅ 인덱스 생성 완료');
    
    await client.query('COMMIT');
    console.log('✅ 데이터베이스 스키마 마이그레이션 완료!');
    
    // 마이그레이션 후 스키마 재확인
    console.log('🔍 마이그레이션 후 스키마 확인...');
    await checkCurrentSchema();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 데이터베이스 스키마 마이그레이션 실패:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 마이그레이션 실행 함수
async function runMigration() {
  try {
    await migrateDatabaseSchema();
    console.log('🎉 모든 마이그레이션이 성공적으로 완료되었습니다!');
  } catch (error) {
    console.error('💥 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

module.exports = {
  checkCurrentSchema,
  migrateDatabaseSchema,
  runMigration
};

// 직접 실행 시
if (require.main === module) {
  runMigration();
}
