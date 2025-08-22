const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 태그 생성
const createTag = async (name, color = '#3B82F6') => {
  try {
    const query = `
      INSERT INTO tags (name, color)
      VALUES ($1, $2)
      RETURNING id, name, color
    `;
    
    const result = await pool.query(query, [name, color]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to create tag:", error);
    throw error;
  }
};

// 모든 태그 조회
const getAllTags = async () => {
  try {
    const query = 'SELECT id, name, color FROM tags ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get all tags:", error);
    throw error;
  }
};

// 태그 ID로 조회
const getTagById = async (tagId) => {
  try {
    const query = 'SELECT id, name, color FROM tags WHERE id = $1';
    const result = await pool.query(query, [tagId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get tag by ID:", error);
    throw error;
  }
};

// 채팅에 태그 추가
const addTagToChat = async (chatId, tagId) => {
  try {
    const query = `
      INSERT INTO chat_tags (chat_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (chat_id, tag_id) DO NOTHING
    `;
    
    await pool.query(query, [chatId, tagId]);
  } catch (error) {
    console.error("Failed to add tag to chat:", error);
    throw error;
  }
};

// 채팅에서 태그 제거
const removeTagFromChat = async (chatId, tagId) => {
  try {
    const query = 'DELETE FROM chat_tags WHERE chat_id = $1 AND tag_id = $2';
    await pool.query(query, [chatId, tagId]);
  } catch (error) {
    console.error("Failed to remove tag from chat:", error);
    throw error;
  }
};

// 채팅의 모든 태그 조회
const getChatTags = async (chatId) => {
  try {
    const query = `
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN chat_tags ct ON t.id = ct.tag_id
      WHERE ct.chat_id = $1
      ORDER BY t.name
    `;
    
    const result = await pool.query(query, [chatId]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get chat tags:", error);
    throw error;
  }
};

// 태그로 채팅 검색
const getChatsByTag = async (tagId) => {
  try {
    const query = `
      SELECT cs.id, cs.title, cs.created_at, cs.updated_at
      FROM chat_sessions cs
      JOIN chat_tags ct ON cs.id = ct.chat_id
      WHERE ct.tag_id = $1
      ORDER BY cs.updated_at DESC
    `;
    
    const result = await pool.query(query, [tagId]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get chats by tag:", error);
    throw error;
  }
};

// 태그 삭제
const deleteTag = async (tagId) => {
  try {
    const query = 'DELETE FROM tags WHERE id = $1';
    await pool.query(query, [tagId]);
  } catch (error) {
    console.error("Failed to delete tag:", error);
    throw error;
  }
};

module.exports = {
  createTag,
  getAllTags,
  getTagById,
  addTagToChat,
  removeTagFromChat,
  getChatTags,
  getChatsByTag,
  deleteTag
};
