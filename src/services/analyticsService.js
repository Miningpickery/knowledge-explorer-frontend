const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 전체 통계
const getOverallStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT cs.id) as total_chats,
        COUNT(m.id) as total_messages,
        COUNT(CASE WHEN m.sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.sender = 'model' THEN 1 END) as ai_messages,
        AVG(LENGTH(m.text)) as avg_message_length,
        MIN(cs.created_at) as first_chat_date,
        MAX(cs.updated_at) as last_chat_date
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
    `;
    
    const result = await pool.query(query);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to get overall stats:", error);
    throw error;
  }
};

// 일별 통계 (최근 30일)
const getDailyStats = async (days = 30) => {
  try {
    const query = `
      SELECT 
        DATE(cs.created_at) as date,
        COUNT(DISTINCT cs.id) as new_chats,
        COUNT(m.id) as total_messages,
        COUNT(CASE WHEN m.sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.sender = 'model' THEN 1 END) as ai_messages
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(cs.created_at)
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get daily stats:", error);
    throw error;
  }
};

// 가장 긴 대화
const getLongestChats = async (limit = 10) => {
  try {
    const query = `
      SELECT 
        cs.id,
        cs.title,
        cs.created_at,
        cs.updated_at,
        COUNT(m.id) as message_count,
        AVG(LENGTH(m.text)) as avg_message_length
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      GROUP BY cs.id, cs.title, cs.created_at, cs.updated_at
      HAVING COUNT(m.id) > 0
      ORDER BY message_count DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get longest chats:", error);
    throw error;
  }
};

// 가장 활발한 시간대
const getActiveHours = async () => {
  try {
    const query = `
      SELECT 
        EXTRACT(HOUR FROM m.timestamp) as hour,
        COUNT(*) as message_count
      FROM messages m
      GROUP BY EXTRACT(HOUR FROM m.timestamp)
      ORDER BY message_count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get active hours:", error);
    throw error;
  }
};

// 사용자별 통계
const getUserStats = async (userId) => {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT cs.id) as total_chats,
        COUNT(m.id) as total_messages,
        COUNT(CASE WHEN m.sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.sender = 'model' THEN 1 END) as ai_messages,
        AVG(LENGTH(m.text)) as avg_message_length,
        MIN(cs.created_at) as first_chat_date,
        MAX(cs.updated_at) as last_chat_date
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to get user stats:", error);
    throw error;
  }
};

// 인기 키워드 (가장 많이 언급된 단어들)
const getPopularKeywords = async (limit = 20) => {
  try {
    const query = `
      SELECT 
        word,
        COUNT(*) as frequency
      FROM (
        SELECT unnest(regexp_split_to_array(lower(m.text), '\s+')) as word
        FROM messages m
        WHERE m.sender = 'user'
          AND LENGTH(word) > 2
      ) words
      WHERE word NOT IN ('the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs')
      GROUP BY word
      ORDER BY frequency DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get popular keywords:", error);
    throw error;
  }
};

module.exports = {
  getOverallStats,
  getDailyStats,
  getLongestChats,
  getActiveHours,
  getUserStats,
  getPopularKeywords
};
