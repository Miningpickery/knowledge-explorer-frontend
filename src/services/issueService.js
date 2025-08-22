const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 이슈 생성
const createIssue = async (chatId, issueType, priority, description, assignedTo = null) => {
  try {
    const query = `
      INSERT INTO customer_issues (chat_id, issue_type, priority, description, assigned_to)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, issue_type, priority, status, description, assigned_to, created_at
    `;
    
    const result = await pool.query(query, [chatId, issueType, priority, description, assignedTo]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to create issue:", error);
    throw error;
  }
};

// 이슈 상태 업데이트
const updateIssueStatus = async (issueId, status, assignedTo = null) => {
  try {
    const query = `
      UPDATE customer_issues 
      SET status = $2, assigned_to = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [issueId, status, assignedTo]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to update issue status:", error);
    throw error;
  }
};

// 이슈 조회 (상태별)
const getIssuesByStatus = async (status = null) => {
  try {
    let query = `
      SELECT ci.*, cs.title as chat_title, cs.created_at as chat_created
      FROM customer_issues ci
      JOIN chat_sessions cs ON ci.chat_id = cs.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE ci.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY ci.priority DESC, ci.created_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Failed to get issues by status:", error);
    throw error;
  }
};

// 긴급 이슈 조회
const getUrgentIssues = async () => {
  try {
    const query = `
      SELECT ci.*, cs.title as chat_title
      FROM customer_issues ci
      JOIN chat_sessions cs ON ci.chat_id = cs.id
      WHERE ci.priority = 'urgent' AND ci.status != 'closed'
      ORDER BY ci.created_at ASC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get urgent issues:", error);
    throw error;
  }
};

// 이슈 통계
const getIssueStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_issues,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_issues,
        issue_type,
        COUNT(*) as type_count
      FROM customer_issues
      GROUP BY issue_type
      ORDER BY type_count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get issue stats:", error);
    throw error;
  }
};

// 이슈 삭제
const deleteIssue = async (issueId) => {
  try {
    const query = 'DELETE FROM customer_issues WHERE id = $1';
    await pool.query(query, [issueId]);
  } catch (error) {
    console.error("Failed to delete issue:", error);
    throw error;
  }
};

module.exports = {
  createIssue,
  updateIssueStatus,
  getIssuesByStatus,
  getUrgentIssues,
  getIssueStats,
  deleteIssue
};
