const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 사용자 생성
const createUser = async (username, email) => {
  try {
    const query = `
      INSERT INTO users (username, email)
      VALUES ($1, $2)
      RETURNING id, username, email, created_at
    `;
    
    const result = await pool.query(query, [username, email]);
    return result.rows[0];
  } catch (error) {
    console.error("Failed to create user:", error);
    throw error;
  }
};

// 사용자 조회 (ID로)
const getUserById = async (userId) => {
  try {
    const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by ID:", error);
    throw error;
  }
};

// 사용자 조회 (이메일로)
const getUserByEmail = async (email) => {
  try {
    const query = 'SELECT id, username, email, created_at FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by email:", error);
    throw error;
  }
};

// 사용자 조회 (사용자명으로)
const getUserByUsername = async (username) => {
  try {
    const query = 'SELECT id, username, email, created_at FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by username:", error);
    throw error;
  }
};

// 사용자 목록 조회
const getAllUsers = async () => {
  try {
    const query = 'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to get all users:", error);
    throw error;
  }
};

// 사용자 삭제
const deleteUser = async (userId) => {
  try {
    const query = 'DELETE FROM users WHERE id = $1';
    await pool.query(query, [userId]);
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
};

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getAllUsers,
  deleteUser
};
