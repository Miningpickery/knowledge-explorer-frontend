const express = require('express');
const router = express.Router();
const { 
  createUser, 
  getUserById, 
  getUserByEmail, 
  updateUser, 
  deleteUser,
  getAllUsers
} = require('../services/chatHistoryService');

// GET /api/users - 전체 사용자 조회 (페이지네이션 지원)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, company } = req.query;
    const offset = (page - 1) * limit;
    
    // 사용자 조회 서비스 호출
    const users = await getAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      offset,
      search,
      role,
      company
    });
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length,
        hasMore: users.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 사용자 생성
router.post('/', async (req, res) => {
  try {
    const { email, name, company, role } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '이메일과 이름은 필수입니다.',
          details: 'email and name are required'
        }
      });
    }
    
    const newUser = await createUser(email, name, company, role);
    
    res.status(201).json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('User creation error:', error);
    
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      return res.status(409).json({
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: '이미 존재하는 이메일입니다.',
          details: error.detail
        }
      });
    }
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 생성 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

// 사용자 ID로 조회
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
          details: `userId: ${userId}`
        }
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User retrieval error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 조회 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

// 이메일로 사용자 조회
router.get('/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
          details: `email: ${email}`
        }
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User retrieval error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 조회 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

// 사용자 정보 업데이트
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const updatedUser = await updateUser(userId, updates);
    
    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('User update error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
          details: `userId: ${req.params.userId}`
        }
      });
    }
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 정보 업데이트 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

// 사용자 삭제 (소프트 삭제)
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await deleteUser(userId);
    
    res.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('User deletion error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.',
          details: `userId: ${req.params.userId}`
        }
      });
    }
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '사용자 삭제 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }
});

module.exports = router;
