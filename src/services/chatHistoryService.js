const { Pool } = require('pg');
const { MessageSender, createChatSession, createChatMessage } = require('../types');

// PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 제목 생성 함수 (첫 질문 기반, 10자 내외)
const getTitleFromMessages = (messages) => {
  if (!messages || messages.length === 0) {
    return "새 대화";
  }
  
  // 첫 번째 사용자 메시지를 기반으로 제목 생성
  const firstUserMessage = messages.find(msg => msg.sender === 'user');
  if (!firstUserMessage || !firstUserMessage.text) {
    return "새 대화";
  }
  
  // 10자 내외로 제목 생성
  let title = firstUserMessage.text.trim();
  
  // 특수문자 제거 및 정리
  title = title.replace(/[^\w\s가-힣]/g, '').trim();
  
  if (title.length > 12) {
    title = title.substring(0, 12) + '...';
  }
  
  return title || "새 대화";
};

// 사용자 생성
const createUser = async (email, name, company = null, role = null) => {
  try {
    console.log(`Creating user - email: ${email}, name: ${name}`);
    
    const query = `
      INSERT INTO users (email, name, company, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, email, name, company, role, created_at, updated_at
    `;
    
    const result = await pool.query(query, [email, name, company, role]);
    const newUser = result.rows[0];
    
    console.log(`User created successfully - id: ${newUser.id}`);
    return newUser;
  } catch (error) {
    console.error("Failed to create user:", error);
    throw error;
  }
};

// 사용자 ID로 조회
const getUserById = async (userId) => {
  try {
    const query = `
      SELECT id, email, name, company, role, created_at, updated_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by ID:", error);
    throw error;
  }
};

// 이메일로 사용자 조회
const getUserByEmail = async (email) => {
  try {
    const query = `
      SELECT id, email, name, company, role, created_at, updated_at
      FROM users
      WHERE email = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by email:", error);
    throw error;
  }
};

// 채팅 ID로 메시지 목록 조회
const getMessagesByChatId = async (chatId) => {
  try {
    const query = `
      SELECT id, text, sender, context, timestamp
      FROM messages
      WHERE chat_id = $1
      ORDER BY timestamp ASC
    `;
    
    const result = await pool.query(query, [chatId]);
    return result.rows;
  } catch (error) {
    console.error('Failed to get messages by chat ID:', error);
    throw error;
  }
};

// 사용자 정보 업데이트
const updateUser = async (userId, updates) => {
  try {
    console.log(`Updating user ${userId}:`, updates);
    
    let query = 'UPDATE users SET updated_at = NOW()';
    const params = [];
    let paramIndex = 1;
    
    if (updates.name) {
      query += `, name = $${paramIndex++}`;
      params.push(updates.name);
    }
    
    if (updates.company !== undefined) {
      query += `, company = $${paramIndex++}`;
      params.push(updates.company);
    }
    
    if (updates.role !== undefined) {
      query += `, role = $${paramIndex++}`;
      params.push(updates.role);
    }
    
    query += ` WHERE id = $${paramIndex} AND deleted_at IS NULL`;
    params.push(userId);
    
    const result = await pool.query(query, params);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    console.log(`User ${userId} updated successfully`);
    return await getUserById(userId);
  } catch (error) {
    console.error("Failed to update user:", error);
    throw error;
  }
};

// 사용자 삭제 (소프트 삭제)
const deleteUser = async (userId) => {
  try {
    console.log(`Deleting user ${userId}`);
    
    const query = `
      UPDATE users 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    console.log(`User ${userId} deleted successfully`);
    return true;
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
};

// 모든 대화 세션 조회 (사용자별, 삭제되지 않은 것만)
const getAllChats = async (userId) => {
  try {
    const query = `
      SELECT id, title, created_at, updated_at
      FROM chat_sessions
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

// 기존 프론트엔드 createNewChat과 동일한 기능 (사용자별)
const createNewChat = async (userId, initialMessages = []) => {
  try {
    const chatId = `chat-${Date.now()}`;
    const title = getTitleFromMessages(initialMessages) || "새 대화";
    
    const query = `
      INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, title, created_at, updated_at
    `;
    
    const result = await pool.query(query, [chatId, userId, title]);
    const newChat = result.rows[0];
    
    // 초기 메시지가 있다면 저장
    if (initialMessages.length > 0) {
      for (const message of initialMessages) {
        await saveMessage(chatId, message);
      }
    }
    
    return {
      ...newChat,
      messages: initialMessages
    };
  } catch (error) {
    console.error("Failed to create new chat:", error);
    throw error;
  }
};

// 기존 프론트엔드 updateChat과 동일한 기능 (메시지 추가 시 자동 호출)
const updateChat = async (id, updates) => {
  try {
    let query = 'UPDATE chat_sessions SET updated_at = NOW()';
    const params = [];
    
    // 제목 업데이트가 필요한 경우
    if (updates.messages && updates.messages.length > 0) {
      const title = getTitleFromMessages(updates.messages);
      if (title !== "새 대화") {
        query += ', title = $1';
        params.push(title);
      }
    }
    
    query += ' WHERE id = $' + (params.length + 1);
    params.push(id);
    
    await pool.query(query, params);
  } catch (error) {
    console.error("Failed to update chat:", error);
    throw error;
  }
};

// 소프트 삭제 (deleted_at 필드 설정)
const deleteChat = async (id) => {
  try {
    const query = 'UPDATE chat_sessions SET deleted_at = NOW() WHERE id = $1';
    await pool.query(query, [id]);
  } catch (error) {
    console.error("Failed to delete chat:", error);
    throw error;
  }
};

// 특정 대화 조회 (사용자별 권한 확인)
const getChatById = async (id, userId) => {
  try {
    // 대화 세션 정보 조회 (사용자별, 삭제되지 않은 것만)
    const sessionQuery = `
      SELECT * FROM chat_sessions 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    const sessionResult = await pool.query(sessionQuery, [id, userId]);
    
    if (sessionResult.rows.length === 0) {
      throw new Error('Chat session not found or access denied');
    }
    
    const chatSession = sessionResult.rows[0];
    
    // 메시지 조회
    const messagesQuery = `
      SELECT id, text, sender, sources, follow_up_questions, timestamp
      FROM messages 
      WHERE chat_id = $1 
      ORDER BY timestamp ASC
    `;
    const messagesResult = await pool.query(messagesQuery, [id]);
    
    const messages = messagesResult.rows.map(row => createChatMessage(
      row.id.toString(),
      row.text,
      row.sender,
      {
        sources: row.sources || [],
        followUpQuestions: row.follow_up_questions || []
      }
    ));
    
    return {
      ...chatSession,
      messages
    };
  } catch (error) {
    console.error("Failed to get chat:", error);
    throw error;
  }
};

// 메시지 저장 (맥락 정보 포함)
const saveMessage = async (chatId, sender, text, context = null) => {
  try {
    console.log(`Saving message - chatId: ${chatId}, sender: ${sender}, text: ${text ? text.substring(0, 50) + '...' : 'null'}, context: ${context}`);
    
    if (!text || typeof text !== 'string') {
      throw new Error(`Invalid text: ${text}`);
    }
    
    const query = `
      INSERT INTO messages (chat_id, text, sender, sources, follow_up_questions, context, status, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, text, sender, context, timestamp
    `;
    
    const result = await pool.query(query, [
      chatId,
      text,
      sender,
      JSON.stringify([]),
      JSON.stringify([]),
      context,
      'sent'
    ]);
    
    const savedMessage = result.rows[0];
    console.log(`Message saved successfully - id: ${savedMessage.id}`);
    
    return {
      id: savedMessage.id.toString(),
      text: savedMessage.text,
      sender: savedMessage.sender,
      context: savedMessage.context,
      timestamp: savedMessage.timestamp
    };
  } catch (error) {
    console.error("Failed to save message:", error);
    throw error;
  }
};

// 맥락 정보 저장 (채팅 세션별)
const saveContext = async (chatId, context) => {
  try {
    console.log(`Saving context for chat ${chatId}: ${context}`);
    
    const query = `
      UPDATE chat_sessions 
      SET context = $1, updated_at = NOW() 
      WHERE id = $2
    `;
    
    await pool.query(query, [context, chatId]);
    console.log(`Context saved successfully for chat ${chatId}`);
  } catch (error) {
    console.error("Failed to save context:", error);
    throw error;
  }
};

// 누적 맥락 조회 (이전 대화들의 맥락을 순서대로)
const getConversationContext = async (chatId) => {
  try {
    const query = `
      SELECT context 
      FROM messages 
      WHERE chat_id = $1 AND context IS NOT NULL AND context != ''
      ORDER BY timestamp ASC
    `;
    
    const result = await pool.query(query, [chatId]);
    const contexts = result.rows.map(row => row.context).filter(Boolean);
    
    console.log(`Retrieved ${contexts.length} contexts for chat ${chatId}:`, contexts);
    return contexts;
  } catch (error) {
    console.error("Failed to get conversation context:", error);
    return [];
  }
};

// 데이터베이스 초기화 (테이블 생성)
const initializeDatabase = async () => {
  try {
    // 사용자/고객 테이블 생성 (OAuth 지원)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
    
    // 대화 세션 테이블 생성 (사용자 ID 추가)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    
    // 메시지 테이블 생성 (맥락 필드 추가)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(50) REFERENCES chat_sessions(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'model')),
        sources JSONB,
        follow_up_questions JSONB,
        context TEXT,
        status VARCHAR(20) DEFAULT 'sent',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 보안 위협 로깅 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_threats (
        id SERIAL PRIMARY KEY,
        threat_type VARCHAR(50) NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
        user_question TEXT NOT NULL,
        detected_patterns TEXT[],
        user_ip VARCHAR(45),
        user_agent TEXT,
        chat_id VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        handled BOOLEAN DEFAULT FALSE,
        response_type VARCHAR(50) DEFAULT 'security_response'
      )
    `);
    
    // 장기메모리 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        memory_type VARCHAR(50) NOT NULL DEFAULT 'conversation',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
        tags TEXT[],
        chat_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    
    // 사용자 세션 토큰 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    
    // 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    
    // 보안 테이블 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_threats_timestamp 
      ON security_threats(timestamp DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_threats_type 
      ON security_threats(threat_type, threat_level)
    `);
    
    // 장기메모리 테이블 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_user_id 
      ON user_memories(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_importance 
      ON user_memories(importance DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_memories_created_at 
      ON user_memories(created_at DESC)
    `);
    
    // 사용자 세션 테이블 인덱스
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash 
      ON user_sessions(token_hash)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at 
      ON user_sessions(expires_at)
    `);
    
    console.log('✅ Database initialized successfully with user management and security monitoring');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};

module.exports = {
  getAllChats,
  createNewChat,
  updateChat,
  deleteChat,
  getChatById,
  saveMessage,
  saveContext,
  getConversationContext,
  getMessagesByChatId,
  initializeDatabase,
  getTitleFromMessages,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser
};
