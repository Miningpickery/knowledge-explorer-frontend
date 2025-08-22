const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 대화 컨텍스트 저장
const saveConversationContext = async (chatId, context) => {
  try {
    const query = `
      INSERT INTO conversation_contexts (chat_id, context_data, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        context_data = $2,
        updated_at = NOW()
    `;
    
    await pool.query(query, [chatId, JSON.stringify(context)]);
  } catch (error) {
    console.error("Failed to save conversation context:", error);
    throw error;
  }
};

// 대화 컨텍스트 조회
const getConversationContext = async (chatId) => {
  try {
    const query = `
      SELECT context_data, created_at, updated_at
      FROM conversation_contexts
      WHERE chat_id = $1
    `;
    
    const result = await pool.query(query, [chatId]);
    return result.rows[0] ? JSON.parse(result.rows[0].context_data) : null;
  } catch (error) {
    console.error("Failed to get conversation context:", error);
    throw error;
  }
};

// 대화 컨텍스트 업데이트
const updateConversationContext = async (chatId, newContext) => {
  try {
    const existingContext = await getConversationContext(chatId);
    const mergedContext = {
      ...existingContext,
      ...newContext,
      lastUpdated: new Date().toISOString()
    };
    
    await saveConversationContext(chatId, mergedContext);
    return mergedContext;
  } catch (error) {
    console.error("Failed to update conversation context:", error);
    throw error;
  }
};

// 대화 컨텍스트 삭제
const deleteConversationContext = async (chatId) => {
  try {
    const query = 'DELETE FROM conversation_contexts WHERE chat_id = $1';
    await pool.query(query, [chatId]);
  } catch (error) {
    console.error("Failed to delete conversation context:", error);
    throw error;
  }
};

module.exports = {
  saveConversationContext,
  getConversationContext,
  updateConversationContext,
  deleteConversationContext
};
