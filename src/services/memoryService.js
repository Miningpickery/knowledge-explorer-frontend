// ============================================================================
// MEMORY SERVICE - 사용자별 장기메모리 관리
// ============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 사용자의 모든 메모리 조회
async function getUserMemories(userId, limit = 50) {
  try {
    const query = `
      SELECT id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
      FROM user_memories
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY importance DESC, created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ 사용자 메모리 조회 실패:', error);
    throw error;
  }
}

// 특정 메모리 조회
async function getMemoryById(memoryId, userId) {
  try {
    const query = `
      SELECT id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
      FROM user_memories
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [memoryId, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ 메모리 조회 실패:', error);
    throw error;
  }
}

// 새 메모리 생성
async function createMemory(userId, memoryData) {
  try {
    const { memory_type, title, content, importance, tags, chat_id } = memoryData;
    
    const query = `
      INSERT INTO user_memories (user_id, memory_type, title, content, importance, tags, chat_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
    `;
    
    const result = await pool.query(query, [
      userId, 
      memory_type || 'conversation', 
      title, 
      content, 
      importance || 1, 
      tags || [], 
      chat_id
    ]);
    
    console.log(`✅ 새 메모리 생성: ${title}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ 메모리 생성 실패:', error);
    throw error;
  }
}

// 메모리 업데이트
async function updateMemory(memoryId, userId, updates) {
  try {
    let query = 'UPDATE user_memories SET updated_at = NOW()';
    const params = [];
    let paramIndex = 1;
    
    if (updates.title) {
      query += `, title = $${paramIndex++}`;
      params.push(updates.title);
    }
    
    if (updates.content) {
      query += `, content = $${paramIndex++}`;
      params.push(updates.content);
    }
    
    if (updates.importance !== undefined) {
      query += `, importance = $${paramIndex++}`;
      params.push(updates.importance);
    }
    
    if (updates.tags) {
      query += `, tags = $${paramIndex++}`;
      params.push(updates.tags);
    }
    
    query += ` WHERE id = $${paramIndex++} AND user_id = $${paramIndex} AND deleted_at IS NULL`;
    params.push(memoryId, userId);
    
    const result = await pool.query(query, params);
    
    if (result.rowCount === 0) {
      throw new Error('Memory not found or access denied');
    }
    
    console.log(`✅ 메모리 업데이트: ${memoryId}`);
    return await getMemoryById(memoryId, userId);
  } catch (error) {
    console.error('❌ 메모리 업데이트 실패:', error);
    throw error;
  }
}

// 메모리 삭제 (소프트 삭제)
async function deleteMemory(memoryId, userId) {
  try {
    const query = `
      UPDATE user_memories 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [memoryId, userId]);
    
    if (result.rowCount === 0) {
      throw new Error('Memory not found or access denied');
    }
    
    console.log(`✅ 메모리 삭제: ${memoryId}`);
    return true;
  } catch (error) {
    console.error('❌ 메모리 삭제 실패:', error);
    throw error;
  }
}

// 채팅 종료 시 핵심 내용 추출하여 메모리 생성
async function extractAndSaveMemory(userId, chatId, conversationContext) {
  try {
    // 간단한 핵심 내용 추출 로직
    // 실제로는 AI를 사용하여 더 정교한 추출이 가능
    const keyPoints = extractKeyPoints(conversationContext);
    
    if (keyPoints.length === 0) {
      console.log('📝 추출할 핵심 내용이 없습니다.');
      return null;
    }
    
    const title = `대화 요약 - ${new Date().toLocaleDateString('ko-KR')}`;
    const content = keyPoints.join('\n\n');
    
    const memoryData = {
      memory_type: 'conversation_summary',
      title,
      content,
      importance: 2, // 기본 중요도
      tags: ['대화요약', '자동생성'],
      chat_id: chatId
    };
    
    const memory = await createMemory(userId, memoryData);
    console.log(`📝 대화 요약 메모리 생성: ${memory.id}`);
    return memory;
  } catch (error) {
    console.error('❌ 메모리 추출 및 저장 실패:', error);
    return null;
  }
}

// 간단한 핵심 내용 추출 함수
function extractKeyPoints(conversationContext) {
  const keyPoints = [];
  
  // conversationContext가 배열인지 확인
  if (!Array.isArray(conversationContext)) {
    console.log('⚠️ conversationContext가 배열이 아닙니다:', typeof conversationContext);
    return [];
  }
  
  // 마지막 3개의 컨텍스트에서 핵심 내용 추출
  const recentContexts = conversationContext.slice(-3);
  
  recentContexts.forEach((context, index) => {
    if (context && typeof context === 'string' && context.length > 10) {
      // 간단한 요약 (실제로는 AI를 사용하여 더 정교하게)
      const summary = context.length > 100 
        ? context.substring(0, 100) + '...'
        : context;
      
      keyPoints.push(`요점 ${index + 1}: ${summary}`);
    }
  });
  
  return keyPoints;
}

// 사용자의 메모리 통계 조회
async function getMemoryStats(userId) {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_memories,
        COUNT(CASE WHEN importance >= 4 THEN 1 END) as high_importance,
        COUNT(CASE WHEN memory_type = 'conversation_summary' THEN 1 END) as conversation_summaries,
        MAX(created_at) as last_memory_created
      FROM user_memories
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ 메모리 통계 조회 실패:', error);
    throw error;
  }
}

// 태그별 메모리 검색
async function searchMemoriesByTags(userId, tags) {
  try {
    const query = `
      SELECT id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
      FROM user_memories
      WHERE user_id = $1 AND deleted_at IS NULL AND tags && $2
      ORDER BY importance DESC, created_at DESC
    `;
    
    const result = await pool.query(query, [userId, tags]);
    return result.rows;
  } catch (error) {
    console.error('❌ 태그별 메모리 검색 실패:', error);
    throw error;
  }
}

module.exports = {
  getUserMemories,
  getMemoryById,
  createMemory,
  updateMemory,
  deleteMemory,
  extractAndSaveMemory,
  getMemoryStats,
  searchMemoriesByTags
};
