const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 피드백 저장
const saveFeedback = async (chatId, messageId, rating, feedbackText, feedbackType = 'general') => {
  try {
    const query = `
      INSERT INTO feedback (chat_id, message_id, rating, feedback_text, feedback_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, rating, feedback_text, feedback_type, created_at
    `;
    
    const result = await pool.query(query, [chatId, messageId, rating, feedbackText, feedbackType]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to save feedback:", error);
    throw error;
  }
};

// 채팅별 피드백 조회
const getFeedbackByChat = async (chatId) => {
  try {
    const query = `
      SELECT f.*, m.text as message_text, m.sender
      FROM feedback f
      JOIN messages m ON f.message_id = m.id
      WHERE f.chat_id = $1
      ORDER BY f.created_at DESC
    `;
    
    const result = await pool.query(query, [chatId]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get feedback by chat:", error);
    throw error;
  }
};

// 전체 피드백 통계
const getFeedbackStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_feedback,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_feedback,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_feedback,
        feedback_type,
        COUNT(*) as type_count
      FROM feedback
      GROUP BY feedback_type
      ORDER BY type_count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get feedback stats:", error);
    throw error;
  }
};

// 최근 피드백 조회
const getRecentFeedback = async (limit = 20) => {
  try {
    const query = `
      SELECT f.*, m.text as message_text, m.sender, cs.title as chat_title
      FROM feedback f
      JOIN messages m ON f.message_id = m.id
      JOIN chat_sessions cs ON f.chat_id = cs.id
      ORDER BY f.created_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get recent feedback:", error);
    throw error;
  }
};

// 피드백 삭제
const deleteFeedback = async (feedbackId) => {
  try {
    const query = 'DELETE FROM feedback WHERE id = $1';
    await pool.query(query, [feedbackId]);
  } catch (error) {
    console.error("Failed to delete feedback:", error);
    throw error;
  }
};

module.exports = {
  saveFeedback,
  getFeedbackByChat,
  getFeedbackStats,
  getRecentFeedback,
  deleteFeedback
};
