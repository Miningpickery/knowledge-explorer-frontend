const { Pool } = require('pg');
const { MessageSender, createChatSession, createChatMessage } = require('../types');

// PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 채팅 ID 형식 정의
const CHAT_ID_FORMATS = {
  ANONYMOUS: 'temp_', // 익명 사용자: temp_로 시작
  AUTHENTICATED: 'chat-' // 인증 사용자: chat-로 시작
};

// IP 기반 익명 사용자 ID 생성 함수
const generateAnonymousUserId = (ip) => {
  if (!ip) return null;
  
  // IP 주소를 해시하여 일관된 익명 사용자 ID 생성
  const hash = require('crypto').createHash('md5').update(ip).digest('hex');
  // 정수형 ID로 변환 (해시의 앞 8자리를 16진수로 해석)
  const numericId = parseInt(hash.substring(0, 8), 16);
  // PostgreSQL INTEGER 범위 내에서 음수로 변환 (익명 사용자 구분)
  const maxInt = 2147483647; // PostgreSQL INTEGER 최대값
  const negativeId = -(numericId % maxInt);
  return negativeId; // 음수 ID 반환 (익명 사용자 구분)
};

// 채팅 ID 생성 함수
const generateChatId = (userId) => {
  const timestamp = Date.now();
  
  // 익명 사용자 ID는 음수로 구분 (기존 사용자 ID는 양수)
  if (userId && userId > 0) {
    // 인증 사용자: chat-{timestamp}
    return `${CHAT_ID_FORMATS.AUTHENTICATED}${timestamp}`;
  } else {
    // 익명 사용자: temp_{timestamp} (프론트엔드와 일치)
    return `${CHAT_ID_FORMATS.ANONYMOUS}${timestamp}`;
  }
};

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
    title = `${title.substring(0, 12)  }...`;
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
      RETURNING user_id, email, name, company, role, created_at, updated_at
    `;
    
    const result = await pool.query(query, [email, name, company, role]);
    const newUser = result.rows[0];
    
    console.log(`User created successfully - user_id: ${newUser.user_id}`);
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
      SELECT user_id, email, name, company, role, created_at, updated_at
      FROM users
      WHERE user_id = $1 AND deleted_at IS NULL
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
      SELECT user_id, email, name, company, role, created_at, updated_at
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
      SELECT message_id, text, sender, sources, follow_up_questions, context, timestamp
      FROM messages
      WHERE chat_id = $1
      ORDER BY timestamp ASC
    `;
    
    const result = await pool.query(query, [chatId]);
    
    // 메시지 객체를 올바른 형식으로 변환
    const messages = result.rows.map(row => {
      // 🚨 원래 데이터베이스 구조 그대로 반환
      return {
        message_id: row.message_id.toString(),     // message_id 그대로 사용
        text: row.text,
        sender: row.sender,
        timestamp: row.timestamp,                  // timestamp 추가
        sources: row.sources || [],
        followUpQuestions: row.follow_up_questions || []
      };
    });
    
    return messages;
  } catch (error) {
    console.error('Failed to get messages by chat ID:', error);
    throw error;
  }
};

// 사용자 정보 업데이트 (데이터 검증 포함)
const updateUser = async (userId, updates) => {
  try {
    // 업데이트 가능한 필드들 검증
    const allowedFields = ['name', 'company', 'role', 'profile_picture'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const setClause = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [userId, ...Object.values(validUpdates)];
    
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE user_id = $1 AND deleted_at IS NULL
      RETURNING user_id, email, name, company, role, profile_picture, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    console.log(`✅ 사용자 업데이트 완료: ${userId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ 사용자 업데이트 실패:', error);
    throw error;
  }
};

// 사용자 삭제 (소프트 삭제 + 연관 데이터 정리)
const deleteUser = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 사용자 관련 채팅 세션들을 소프트 삭제
    await client.query(`
      UPDATE chat_sessions 
      SET deleted_at = NOW() 
      WHERE user_id = $1 AND deleted_at IS NULL
    `, [userId]);
    
    // 2. 사용자 관련 메모리들을 소프트 삭제
    await client.query(`
      UPDATE user_memories 
      SET deleted_at = NOW() 
      WHERE user_id = $1 AND deleted_at IS NULL
    `, [userId]);
    
    // 3. 사용자 세션 토큰들을 비활성화
    await client.query(`
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE user_id = $1 AND is_active = TRUE
    `, [userId]);
    
    // 4. 사용자를 소프트 삭제
    const result = await client.query(`
      UPDATE users 
      SET deleted_at = NOW(), is_active = FALSE 
      WHERE user_id = $1 AND deleted_at IS NULL
      RETURNING user_id
    `, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    await client.query('COMMIT');
    console.log(`✅ 사용자 삭제 완료: ${userId}`);
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 사용자 삭제 실패:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 모든 대화 세션 조회 (사용자별, 삭제되지 않은 것만)
const getAllChats = async (userId) => {
  try {
    let query;
    let params;
    
    if (userId && userId < 0) {
      // 익명 사용자: temp_ 접두사로 시작하는 채팅들 조회
      query = `
        SELECT chat_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE chat_id LIKE 'temp_%' AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
      params = []; // No user_id param needed for LIKE query
    } else if (userId) {
      // 인증 사용자: 일반 사용자 ID로 조회
      query = `
        SELECT chat_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
      params = [userId];
    } else {
      // userId가 null인 경우 (기존 호환성 유지)
      query = `
        SELECT chat_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE user_id IS NULL AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      chat_id: row.chat_id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

// 기존 프론트엔드 createNewChat과 동일한 기능 (사용자별)
const createNewChat = async (userId, initialMessages = []) => {
  try {
    let chatId;
    let actualUserId;
    
    if (userId && userId > 0) {
      // 인증 사용자: 일반 채팅 ID 생성
      chatId = generateChatId(userId);
      actualUserId = userId;
    } else if (userId && userId < 0) {
      // 익명 사용자: temp_ 접두사로 채팅 ID 생성
      chatId = `temp_${Date.now()}`;
      actualUserId = null; // 익명 사용자는 user_id를 NULL로 설정
    } else {
      // userId가 null인 경우 (기존 호환성 유지)
      chatId = generateChatId(null);
      actualUserId = null;
    }
    
    const title = getTitleFromMessages(initialMessages) || "새 대화";
    
    const query = `
      INSERT INTO chat_sessions (chat_id, user_id, title, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING chat_id, title, created_at, updated_at
    `;
    
    const result = await pool.query(query, [chatId, actualUserId, title]);
    const newChat = result.rows[0];
    
    // 초기 메시지가 있다면 저장
    if (initialMessages.length > 0) {
      for (const message of initialMessages) {
        await saveMessage(chatId, message.sender, message.text, message.context, actualUserId);
      }
    }
    
    return {
      chat_id: newChat.chat_id,
      title: newChat.title,
      created_at: newChat.created_at,
      updated_at: newChat.updated_at,
      messages: initialMessages
    };
  } catch (error) {
    console.error("Failed to create new chat:", error);
    throw error;
  }
};

// 채팅 세션 업데이트 (데이터 검증 포함)
const updateChat = async (chatId, updates) => {
  try {
    // 업데이트 가능한 필드들 검증
    const allowedFields = ['title', 'context'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const setClause = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [chatId, ...Object.values(validUpdates)];
    
    const query = `
      UPDATE chat_sessions 
      SET ${setClause}, updated_at = NOW()
      WHERE chat_id = $1 AND deleted_at IS NULL
      RETURNING chat_id, user_id, title, context, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    console.log(`✅ 채팅 업데이트 완료: ${chatId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ 채팅 업데이트 실패:', error);
    throw error;
  }
};

// 채팅 세션 삭제 (소프트 삭제 + 연관 데이터 정리)
const deleteChat = async (chatId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 채팅 세션을 소프트 삭제
    const chatResult = await client.query(`
      UPDATE chat_sessions 
      SET deleted_at = NOW() 
      WHERE chat_id = $1 AND deleted_at IS NULL
      RETURNING chat_id
    `, [chatId]);
    
    if (chatResult.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    // 2. 관련 메시지들을 삭제 (채팅 삭제 시 메시지도 함께 삭제)
    const messageResult = await client.query(`
      DELETE FROM messages 
      WHERE chat_id = $1
    `, [chatId]);
    
    // 3. 관련 메모리들을 조회하여 정리
    await client.query(`
      UPDATE user_memories 
      SET chat_id = NULL, updated_at = NOW()
      WHERE chat_id = $1
    `, [chatId]);
    
    await client.query('COMMIT');
    console.log(`✅ 채팅 삭제 완료: ${chatId} (메시지 ${messageResult.rowCount}개 삭제)`);
    return { success: true, message: 'Chat deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 채팅 삭제 실패:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 특정 대화 조회 (사용자별 권한 확인)
const getChatById = async (id, userId) => {
  try {
    // 익명 사용자 지원: temp_ 접두사 채팅방 또는 일반 사용자 ID
    let sessionQuery;
    let queryParams;
    
    if (id.startsWith('temp_')) {
      // 익명 사용자 채팅: temp_ 접두사로 식별하고 user_id IS NULL 조건 추가
      sessionQuery = `
        SELECT * FROM chat_sessions 
        WHERE chat_id = $1 AND user_id IS NULL AND deleted_at IS NULL
      `;
      queryParams = [id];
    } else if (userId && userId < 0) {
      // 익명 사용자: 음수 ID를 null로 처리하여 조회
      sessionQuery = `
        SELECT * FROM chat_sessions 
        WHERE chat_id = $1 AND user_id IS NULL AND deleted_at IS NULL
      `;
      queryParams = [id];
    } else if (userId) {
      // 인증 사용자: 일반 사용자 ID로 조회
      sessionQuery = `
        SELECT * FROM chat_sessions 
        WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL
      `;
      queryParams = [id, userId];
    } else {
      // userId가 null인 경우 (기존 호환성 유지)
      sessionQuery = `
        SELECT * FROM chat_sessions 
        WHERE chat_id = $1 AND user_id IS NULL AND deleted_at IS NULL
      `;
      queryParams = [id];
    }
    
    const sessionResult = await pool.query(sessionQuery, queryParams);
    
    if (sessionResult.rows.length === 0) {
      throw new Error('Chat session not found or access denied');
    }
    
    const chatSession = sessionResult.rows[0];
    
    // 메시지 조회
    const messagesQuery = `
      SELECT message_id, text, sender, sources, follow_up_questions, timestamp
      FROM messages 
      WHERE chat_id = $1 
      ORDER BY timestamp ASC
    `;
    const messagesResult = await pool.query(messagesQuery, [id]);
    
    const messages = messagesResult.rows.map(row => {
      try {
        return createChatMessage(
          row.message_id.toString(),
          row.text,
          row.sender,
          {
            sources: row.sources || [],
            followUpQuestions: row.follow_up_questions || []
          }
        );
      } catch (error) {
        console.error('❌ createChatMessage 오류:', error);
        // 기본 메시지 객체 반환
        return {
          message_id: row.message_id.toString(),
          text: row.text,
          sender: row.sender,
          sources: row.sources || [],
          followUpQuestions: row.follow_up_questions || []
        };
      }
    });
    
    return {
      chat_id: chatSession.chat_id,
      user_id: chatSession.user_id,
      title: chatSession.title,
      context: chatSession.context,
      created_at: chatSession.created_at,
      updated_at: chatSession.updated_at,
      messages
    };
  } catch (error) {
    console.error("Failed to get chat:", error);
    throw error;
  }
};

// 메시지 저장 (맥락 정보 포함)
const saveMessage = async (chatId, sender, text, context = null, userId = null) => {
  try {
    console.log(`Saving message - chatId: ${chatId}, sender: ${sender}, userId: ${userId}, text: ${text ? `${text.substring(0, 50)  }...` : 'null'}, context: ${context}`);
    
    if (!text || typeof text !== 'string') {
      throw new Error(`Invalid text: ${text}`);
    }
    
    // 익명 사용자 처리: 음수 ID는 null로 변환
    let actualUserId = userId;
    if (userId && userId < 0) {
      console.log(`🔄 익명 사용자 ID ${userId}를 null로 변환`);
      actualUserId = null;
    }
    
    // 익명 사용자 채팅인지 확인 (temp_ 접두사)
    if (!actualUserId && !chatId.startsWith('temp_')) {
      // 인증 사용자 채팅인 경우에만 chat_sessions에서 user_id 가져오기
      const chatQuery = `SELECT user_id FROM chat_sessions WHERE chat_id = $1`;
      const chatResult = await pool.query(chatQuery, [chatId]);
      if (chatResult.rows.length > 0) {
        actualUserId = chatResult.rows[0].user_id;
      }
    }
    // 익명 사용자 채팅(temp_ 접두사)인 경우 actualUserId는 null로 유지
    
    const insertQuery = `
      INSERT INTO messages (chat_id, user_id, text, sender, sources, follow_up_questions, context, status, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING message_id, text, sender, context, timestamp
    `;

    const params = [
      chatId,
      actualUserId,
      text,
      sender,
      JSON.stringify([]),
      JSON.stringify([]),
      context,
      'sent'
    ];
    
    // 23505 (unique_violation) 발생 시 재시도: 동일 텍스트가 이미 저장된 경우 기존 레코드 반환
    try {
      const result = await pool.query(insertQuery, params);
      const savedMessage = result.rows[0];
      console.log(`Message saved successfully - message_id: ${savedMessage.message_id}`);
      return {
        message_id: savedMessage.message_id.toString(),
        text: savedMessage.text,
        sender: savedMessage.sender,
        context: savedMessage.context,
        timestamp: savedMessage.timestamp
      };
    } catch (err) {
      if (err && err.code === '23505') {
        console.warn('⚠️ Unique violation on messages. Falling back to fetch existing or retry.');
        // 1) 동일 레코드가 이미 존재하는지 조회 (가장 최근 것 반환)
        const selectExisting = `
          SELECT message_id, text, sender, context, timestamp
          FROM messages
          WHERE chat_id = $1 AND text = $2 AND sender = $3
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        const existingResult = await pool.query(selectExisting, [chatId, text, sender]);
        if (existingResult.rows.length > 0) {
          const row = existingResult.rows[0];
          return {
            message_id: row.message_id.toString(),
            text: row.text,
            sender: row.sender,
            context: row.context,
            timestamp: row.timestamp
          };
        }

        // 2) 존재하지 않으면 약간의 지연 후 한 번 더 시도
        await new Promise(r => setTimeout(r, 50));
        const retry = await pool.query(insertQuery, params);
        const saved = retry.rows[0];
        return {
          message_id: saved.message_id.toString(),
          text: saved.text,
          sender: saved.sender,
          context: saved.context,
          timestamp: saved.timestamp
        };
      }
      throw err;
    }
  } catch (error) {
    console.error('Failed to save message:', error);
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
      WHERE chat_id = $2
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
    console.log('🔄 데이터베이스 스키마 마이그레이션 시작...');
    
    // 사용자/고객 테이블 생성 (OAuth 지원)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
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
    
    // 대화 세션 테이블 생성 (사용자 ID 추가)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        chat_id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
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
        message_id SERIAL PRIMARY KEY,
        chat_id VARCHAR(50) REFERENCES chat_sessions(chat_id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
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
        threat_id SERIAL PRIMARY KEY,
        threat_type VARCHAR(50) NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
        user_question TEXT NOT NULL,
        detected_patterns TEXT[],
        user_ip VARCHAR(45),
        user_agent TEXT,
        chat_id VARCHAR(50) REFERENCES chat_sessions(chat_id) ON DELETE SET NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        handled BOOLEAN DEFAULT FALSE,
        response_type VARCHAR(50) DEFAULT 'security_response'
      )
    `);
    
    // 장기메모리 테이블 생성
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
    
    // 사용자 세션 토큰 테이블 생성
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
    
    // 기존 테이블 마이그레이션 (컬럼명 변경)
    console.log('🔄 기존 테이블 마이그레이션 시작...');
    
    // 1. users 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE users RENAME COLUMN id TO user_id;`);
      console.log('✅ users.id를 user_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ users 테이블은 이미 user_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ users 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 2. chat_sessions 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE chat_sessions RENAME COLUMN id TO chat_id;`);
      console.log('✅ chat_sessions.id를 chat_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ chat_sessions 테이블은 이미 chat_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ chat_sessions 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 3. messages 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE messages RENAME COLUMN id TO message_id;`);
      console.log('✅ messages.id를 message_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ messages 테이블은 이미 message_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ messages 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 4. security_threats 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE security_threats RENAME COLUMN id TO threat_id;`);
      console.log('✅ security_threats.id를 threat_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ security_threats 테이블은 이미 threat_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ security_threats 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 5. user_memories 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE user_memories RENAME COLUMN id TO memory_id;`);
      console.log('✅ user_memories.id를 memory_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ user_memories 테이블은 이미 memory_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ user_memories 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 6. user_sessions 테이블 컬럼명 변경
    try {
      await pool.query(`ALTER TABLE user_sessions RENAME COLUMN id TO session_id;`);
      console.log('✅ user_sessions.id를 session_id로 변경 완료');
    } catch (error) {
      if (error.code === '42701' || error.code === '42703') {
        console.log('⚠️ user_sessions 테이블은 이미 session_id 컬럼을 사용 중');
      } else {
        console.log('⚠️ user_sessions 테이블 컬럼 변경 실패:', error.message);
      }
    }
    
    // 7. messages 테이블에 user_id 컬럼 추가 (기존 테이블 마이그레이션)
    try {
      await pool.query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE
      `);
      console.log('✅ messages 테이블에 user_id 컬럼 추가 완료');
    } catch (error) {
      console.log('ℹ️ user_id 컬럼이 이미 존재하거나 추가 실패:', error.message);
    }
    
    // 8. 기존 메시지들의 user_id를 chat_sessions의 user_id로 업데이트
    try {
      await pool.query(`
        UPDATE messages 
        SET user_id = cs.user_id 
        FROM chat_sessions cs 
        WHERE messages.chat_id = cs.chat_id 
        AND messages.user_id IS NULL
      `);
      console.log('✅ 기존 메시지들의 user_id 업데이트 완료');
    } catch (error) {
      console.log('ℹ️ 기존 메시지 user_id 업데이트 실패:', error.message);
    }
    
    console.log('✅ Database initialized successfully with user management and security monitoring');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};

// 데이터베이스 연결 상태 확인
const checkDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    
    console.log('✅ 데이터베이스 연결 성공');
    console.log('📅 현재 시간:', result.rows[0].current_time);
    console.log('🗄️ 데이터베이스 버전:', result.rows[0].db_version.split('\n')[0]);
    
    return {
      status: 'connected',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].db_version.split('\n')[0]
    };
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
};

// 테이블 존재 여부 확인
const checkTableExists = async (tableName) => {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists;
    `;
    
    const result = await pool.query(query, [tableName]);
    const exists = result.rows[0].exists;
    
    console.log(`📋 테이블 ${tableName}: ${exists ? '존재함' : '존재하지 않음'}`);
    return exists;
  } catch (error) {
    console.error(`❌ 테이블 확인 실패 (${tableName}):`, error);
    return false;
  }
};

// 테이블 데이터 개수 확인
const getTableRecordCount = async (tableName) => {
  try {
    const query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const result = await pool.query(query);
    const count = parseInt(result.rows[0].count);
    
    console.log(`📊 테이블 ${tableName} 레코드 수: ${count}개`);
    return count;
  } catch (error) {
    console.error(`❌ 테이블 데이터 개수 확인 실패 (${tableName}):`, error);
    return 0;
  }
};

// 사용자 테이블 샘플 데이터 확인
const getSampleUsers = async (limit = 5) => {
  try {
    const query = `
      SELECT user_id, email, name, company, role, created_at, updated_at
      FROM users 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    console.log(`👥 사용자 샘플 데이터 (${result.rows.length}개):`);
    result.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.user_id}, 이메일: ${user.email}, 이름: ${user.name}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ 사용자 샘플 데이터 조회 실패:', error);
    return [];
  }
};

// 채팅 세션 샘플 데이터 확인
const getSampleChatSessions = async (limit = 5) => {
  try {
    const query = `
      SELECT cs.chat_id, cs.title, cs.user_id, u.name as user_name, cs.created_at, cs.updated_at
      FROM chat_sessions cs
      LEFT JOIN users u ON cs.user_id = u.user_id
      WHERE cs.deleted_at IS NULL 
      ORDER BY cs.updated_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    console.log(`💬 채팅 세션 샘플 데이터 (${result.rows.length}개):`);
    result.rows.forEach((chat, index) => {
      console.log(`  ${index + 1}. ID: ${chat.chat_id}, 제목: ${chat.title}, 사용자: ${chat.user_name || '익명'}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ 채팅 세션 샘플 데이터 조회 실패:', error);
    return [];
  }
};

// 메시지 샘플 데이터 확인
const getSampleMessages = async (limit = 5) => {
  try {
    const query = `
      SELECT m.message_id, m.chat_id, m.text, m.sender, m.timestamp,
             cs.title as chat_title
      FROM messages m
      LEFT JOIN chat_sessions cs ON m.chat_id = cs.chat_id
      ORDER BY m.timestamp DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    console.log(`💭 메시지 샘플 데이터 (${result.rows.length}개):`);
    result.rows.forEach((message, index) => {
      const textPreview = message.text.length > 50 ? `${message.text.substring(0, 50)  }...` : message.text;
      console.log(`  ${index + 1}. 채팅: ${message.chat_title || message.chat_id}, 발신자: ${message.sender}, 내용: ${textPreview}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ 메시지 샘플 데이터 조회 실패:', error);
    return [];
  }
};

// 메모리 샘플 데이터 확인
const getSampleMemories = async (limit = 5) => {
  try {
    const query = `
      SELECT um.memory_id, um.title, um.content, um.importance, um.memory_type, um.created_at,
             u.name as user_name
      FROM user_memories um
      LEFT JOIN users u ON um.user_id = u.user_id
      WHERE um.deleted_at IS NULL 
      ORDER BY um.created_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    console.log(`🧠 메모리 샘플 데이터 (${result.rows.length}개):`);
    result.rows.forEach((memory, index) => {
      const contentPreview = memory.content.length > 50 ? `${memory.content.substring(0, 50)  }...` : memory.content;
      console.log(`  ${index + 1}. 제목: ${memory.title}, 중요도: ${memory.importance}, 사용자: ${memory.user_name}, 내용: ${contentPreview}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ 메모리 샘플 데이터 조회 실패:', error);
    return [];
  }
};

// 전체 사용자 조회 (페이지네이션 지원)
const getAllUsers = async (options = {}) => {
  try {
    const { page = 1, limit = 50, offset = 0, search, role, company } = options;
    
    // 파라미터를 정수로 변환
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    let query = `
      SELECT user_id, email, name, company, role, created_at, updated_at
      FROM users
      WHERE deleted_at IS NULL
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // 필터링 조건 추가
    if (search) {
      query += ` AND (name ILIKE $${paramIndex++} OR email ILIKE $${paramIndex++} OR company ILIKE $${paramIndex++})`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (role) {
      query += ` AND role = $${paramIndex++}`;
      queryParams.push(role);
    }
    
    if (company) {
      query += ` AND company = $${paramIndex++}`;
      queryParams.push(company);
    }
    
    // 정렬 및 페이지네이션
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limitNum, offsetNum);
    
    const result = await pool.query(query, queryParams);
    return result.rows;
    
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

// 전체 메시지 조회 (페이지네이션 지원)
const getAllMessages = async (options = {}) => {
  try {
    const { page = 1, limit = 50, offset = 0, chatId, sender, search } = options;
    
    // 파라미터를 정수로 변환
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    let query = `
      SELECT m.message_id, m.text, m.sender, m.timestamp, m.context, m.chat_id,
             cs.title as chat_title, u.name as user_name
      FROM messages m
      LEFT JOIN chat_sessions cs ON m.chat_id = cs.chat_id
      LEFT JOIN users u ON m.user_id = u.user_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // 필터링 조건 추가
    if (chatId) {
      query += ` AND m.chat_id = $${paramIndex++}`;
      queryParams.push(chatId);
    }
    
    if (sender) {
      query += ` AND m.sender = $${paramIndex++}`;
      queryParams.push(sender);
    }
    
    if (search) {
      query += ` AND (m.text ILIKE $${paramIndex++} OR cs.title ILIKE $${paramIndex++})`;
      queryParams.push(`%${search}%`);
      queryParams.push(`%${search}%`);
    }
    
    // 정렬 및 페이지네이션
    query += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limitNum, offsetNum);
    
    const result = await pool.query(query, queryParams);
    return result.rows;
    
  } catch (error) {
    console.error('Error fetching all messages:', error);
    throw error;
  }
};

// 전체 데이터베이스 상태 점검
const checkDatabaseStatus = async () => {
  console.log('🔍 데이터베이스 상태 점검 시작...');
  
  // 1. 연결 상태 확인
  const connectionStatus = await checkDatabaseConnection();
  console.log('📡 연결 상태:', connectionStatus);
  
  // 2. 테이블 존재 여부 확인
  const tables = ['users', 'chat_sessions', 'messages', 'user_memories', 'security_threats', 'user_sessions'];
  const tableStatus = {};
  
  for (const table of tables) {
    tableStatus[table] = await checkTableExists(table);
  }
  
  console.log('📋 테이블 상태:', tableStatus);
  
  // 3. 테이블별 레코드 수 확인
  const recordCounts = {};
  for (const table of tables) {
    if (tableStatus[table]) {
      recordCounts[table] = await getTableRecordCount(table);
    }
  }
  
  console.log('📊 레코드 수:', recordCounts);
  
  // 4. 샘플 데이터 확인
  console.log('\n📝 샘플 데이터 확인:');
  await getSampleUsers(3);
  await getSampleChatSessions(3);
  await getSampleMessages(3);
  await getSampleMemories(3);
  
  return {
    connection: connectionStatus,
    tables: tableStatus,
    recordCounts
  };
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
  getAllMessages,
  getAllUsers,
  initializeDatabase,
  getTitleFromMessages,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  generateAnonymousUserId,
  checkDatabaseConnection,
  checkTableExists,
  getTableRecordCount,
  getSampleUsers,
  getSampleChatSessions,
  getSampleMessages,
  getSampleMemories,
  checkDatabaseStatus
};
