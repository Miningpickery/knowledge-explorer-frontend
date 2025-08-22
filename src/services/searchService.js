const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 메시지 내용으로 검색 (전문 검색)
const searchMessages = async (query, limit = 20) => {
  try {
    const searchQuery = `
      SELECT 
        m.id,
        m.text,
        m.sender,
        m.timestamp,
        cs.id as chat_id,
        cs.title as chat_title,
        ts_rank(to_tsvector('english', m.text), plainto_tsquery('english', $1)) as rank
      FROM messages m
      JOIN chat_sessions cs ON m.chat_id = cs.id
      WHERE to_tsvector('english', m.text) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, m.timestamp DESC
      LIMIT $2
    `;
    
    const result = await pool.query(searchQuery, [query, limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to search messages:", error);
    throw error;
  }
};

// 제목으로 채팅 검색
const searchChatsByTitle = async (query, limit = 20) => {
  try {
    const searchQuery = `
      SELECT 
        id,
        title,
        created_at,
        updated_at
      FROM chat_sessions
      WHERE title ILIKE $1
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(searchQuery, [`%${query}%`, limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to search chats by title:", error);
    throw error;
  }
};

// 통합 검색 (메시지 + 제목)
const globalSearch = async (query, limit = 20) => {
  try {
    const searchQuery = `
      SELECT 
        'message' as type,
        m.id::text,
        m.text as content,
        m.sender,
        m.timestamp,
        cs.id as chat_id,
        cs.title as chat_title,
        ts_rank(to_tsvector('english', m.text), plainto_tsquery('english', $1)) as rank
      FROM messages m
      JOIN chat_sessions cs ON m.chat_id = cs.id
      WHERE to_tsvector('english', m.text) @@ plainto_tsquery('english', $1)
      
      UNION ALL
      
      SELECT 
        'chat' as type,
        cs.id::text,
        cs.title as content,
        NULL as sender,
        cs.updated_at as timestamp,
        cs.id as chat_id,
        cs.title as chat_title,
        0.5::float as rank
      FROM chat_sessions cs
      WHERE cs.title ILIKE $1
      
      ORDER BY rank DESC, timestamp DESC
      LIMIT $2
    `;
    
    const result = await pool.query(searchQuery, [query, limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to perform global search:", error);
    throw error;
  }
};

// 최근 대화 검색 (최근 7일)
const searchRecentChats = async (query, days = 7, limit = 20) => {
  try {
    const searchQuery = `
      SELECT 
        m.id,
        m.text,
        m.sender,
        m.timestamp,
        cs.id as chat_id,
        cs.title as chat_title
      FROM messages m
      JOIN chat_sessions cs ON m.chat_id = cs.id
      WHERE m.timestamp >= NOW() - INTERVAL '${days} days'
        AND (m.text ILIKE $1 OR cs.title ILIKE $1)
      ORDER BY m.timestamp DESC
      LIMIT $2
    `;
    
    const result = await pool.query(searchQuery, [`%${query}%`, limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to search recent chats:", error);
    throw error;
  }
};

module.exports = {
  searchMessages,
  searchChatsByTitle,
  globalSearch,
  searchRecentChats
};
