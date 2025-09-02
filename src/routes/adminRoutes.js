const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const {
  checkAdminPermission,
  getAdminUsers,
  grantAdminPermission,
  revokeAdminPermission,
  getSystemHealth,
  getDatabaseTables,
  getTableData,
  initializeAdminTables
} = require('../services/adminService');
const {
  checkDatabaseStatus,
  getSampleUsers,
  getSampleChatSessions,
  getSampleMessages,
  getSampleMemories
} = require('../services/chatHistoryService');

// 관리자 권한 미들웨어
const requireAdmin = async (req, res, next) => {
  try {
    // JWT 토큰에서 사용자 정보 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.'
        }
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'knowledge-explorer-secret-key-2024-change-in-production';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { email: decoded.email };
    } catch (jwtError) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: '유효하지 않은 토큰입니다.'
        }
      });
    }

    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.'
        }
      });
    }

    const adminStatus = await checkAdminPermission(userEmail, req.requiredPermissions || []);
    
    if (!adminStatus.isAdmin) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        }
      });
    }

    req.adminStatus = adminStatus;
    next();
  } catch (error) {
    console.error('❌ 관리자 권한 확인 실패:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_CHECK_ERROR',
        message: '관리자 권한 확인에 실패했습니다.',
        details: error.message
      }
    });
  }
};

// 관리자 대시보드 초기화
router.post('/initialize', requireAdmin, async (req, res) => {
  try {
    await initializeAdminTables();
    
    res.json({
      success: true,
      message: '관리자 시스템 초기화 완료'
    });
  } catch (error) {
    console.error('❌ 관리자 시스템 초기화 실패:', error);
    res.status(500).json({
      error: {
        code: 'INITIALIZATION_ERROR',
        message: '관리자 시스템 초기화에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 시스템 상태 조회
router.get('/system/health', requireAdmin, async (req, res) => {
  try {
    const systemHealth = await getSystemHealth();
    
    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    console.error('❌ 시스템 상태 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'SYSTEM_HEALTH_ERROR',
        message: '시스템 상태 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 상태 조회
router.get('/database/status', requireAdmin, async (req, res) => {
  try {
    const dbStatus = await checkDatabaseStatus();
    
    res.json({
      success: true,
      data: dbStatus
    });
  } catch (error) {
    console.error('❌ 데이터베이스 상태 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_STATUS_ERROR',
        message: '데이터베이스 상태 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 샘플 데이터 조회
router.get('/database/sample/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    let data = [];
    
    switch (type) {
      case 'users':
        data = await getSampleUsers(limit);
        break;
      case 'chats':
        data = await getSampleChatSessions(limit);
        break;
      case 'messages':
        data = await getSampleMessages(limit);
        break;
      case 'memories':
        data = await getSampleMemories(limit);
        break;
      default:
        return res.status(400).json({
          error: {
            code: 'INVALID_TYPE',
            message: '지원하지 않는 데이터 타입입니다.'
          }
        });
    }
    
    res.json({
      success: true,
      data,
      count: data.length,
      type
    });
  } catch (error) {
    console.error(`❌ ${req.params.type} 샘플 데이터 조회 실패:`, error);
    res.status(500).json({
      error: {
        code: 'SAMPLE_DATA_ERROR',
        message: '샘플 데이터 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 관리자 목록 조회
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const adminUsers = await getAdminUsers();
    
    res.json({
      success: true,
      data: adminUsers
    });
  } catch (error) {
    console.error('❌ 관리자 목록 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'ADMIN_USERS_ERROR',
        message: '관리자 목록 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 관리자 권한 부여
router.post('/users/grant', requireAdmin, async (req, res) => {
  try {
    const { targetEmail, permissions } = req.body;
    
    if (!targetEmail) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: '대상 이메일이 필요합니다.'
        }
      });
    }

    const result = await grantAdminPermission(targetEmail, permissions || ['database_read']);
    
    res.json({
      success: true,
      data: result,
      message: `관리자 권한이 성공적으로 부여되었습니다: ${targetEmail}`
    });
  } catch (error) {
    console.error('❌ 관리자 권한 부여 실패:', error);
    res.status(500).json({
      error: {
        code: 'GRANT_PERMISSION_ERROR',
        message: '관리자 권한 부여에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 관리자 권한 해제
router.post('/users/revoke', requireAdmin, async (req, res) => {
  try {
    const { targetEmail } = req.body;
    
    if (!targetEmail) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: '대상 이메일이 필요합니다.'
        }
      });
    }

    const result = await revokeAdminPermission(targetEmail);
    
    res.json({
      success: true,
      data: result,
      message: `관리자 권한이 성공적으로 해제되었습니다: ${targetEmail}`
    });
  } catch (error) {
    console.error('❌ 관리자 권한 해제 실패:', error);
    res.status(500).json({
      error: {
        code: 'REVOKE_PERMISSION_ERROR',
        message: '관리자 권한 해제에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 현재 사용자 관리자 권한 확인
router.get('/me', requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.adminStatus
    });
  } catch (error) {
    console.error('❌ 현재 사용자 권한 확인 실패:', error);
    res.status(500).json({
      error: {
        code: 'CURRENT_USER_ERROR',
        message: '현재 사용자 권한 확인에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 관리자 비밀번호 확인
router.post('/verify-password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인 (환경변수에서 가져오거나 기본값 사용)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    res.json({
      success: true,
      message: '비밀번호 확인 완료',
      verified: true
    });
  } catch (error) {
    console.error('❌ 관리자 비밀번호 확인 실패:', error);
    res.status(500).json({
      error: {
        code: 'PASSWORD_VERIFICATION_ERROR',
        message: '비밀번호 확인에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 레코드 삭제 (비밀번호 확인 필요)
router.delete('/database/records/:tableName/:recordId', requireAdmin, async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    // 안전한 테이블명 검증
    if (!isValidTableName(tableName)) {
      return res.status(400).json({
        error: {
          code: 'UNSAFE_TABLE',
          message: '해당 테이블은 삭제가 허용되지 않습니다.',
          details: `허용된 테이블: ${safeTables.join(', ')}`
        }
      });
    }

    // 레코드 삭제
    const result = await pool.query(
      `DELETE FROM ${tableName} WHERE ${getPrimaryKeyColumn(tableName)} = $1`,
      [recordId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: 'RECORD_NOT_FOUND',
          message: '해당 레코드를 찾을 수 없습니다.'
        }
      });
    }

    res.json({
      success: true,
      message: '레코드가 성공적으로 삭제되었습니다.',
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('❌ 레코드 삭제 실패:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: '레코드 삭제에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 레코드 업데이트 (비밀번호 확인 필요)
router.put('/database/records/:tableName/:recordId', requireAdmin, async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    const { password, updates } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: {
          code: 'MISSING_UPDATES',
          message: '업데이트할 데이터가 필요합니다.'
        }
      });
    }

    // 업데이트할 컬럼명들의 안전성 검증
    for (const columnName of Object.keys(updates)) {
      if (!isValidColumnName(columnName)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_COLUMN',
            message: '안전하지 않은 컬럼명입니다.',
            details: `컬럼명: ${columnName}`
          }
        });
      }
    }

    // 안전한 테이블명 검증
    if (!isValidTableName(tableName)) {
      return res.status(400).json({
        error: {
          code: 'UNSAFE_TABLE',
          message: '해당 테이블은 업데이트가 허용되지 않습니다.',
          details: `허용된 테이블: ${safeTables.join(', ')}`
        }
      });
    }

    // 업데이트 쿼리 생성
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [recordId, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE ${getPrimaryKeyColumn(tableName)} = $1`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: {
          code: 'RECORD_NOT_FOUND',
          message: '해당 레코드를 찾을 수 없습니다.'
        }
      });
    }

    res.json({
      success: true,
      message: '레코드가 성공적으로 업데이트되었습니다.',
      updatedCount: result.rowCount
    });
  } catch (error) {
    console.error('❌ 레코드 업데이트 실패:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: '레코드 업데이트에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 테이블 목록 조회
router.get('/database/tables', requireAdmin, async (req, res) => {
  try {
    const result = await getDatabaseTables();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ 데이터베이스 테이블 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_TABLES_ERROR',
        message: '데이터베이스 테이블 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 특정 테이블 데이터 조회
router.get('/database/tables/:tableName', requireAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await getTableData(tableName, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ 테이블 데이터 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'TABLE_DATA_ERROR',
        message: '테이블 데이터 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 백업 생성
router.post('/database/backup', requireAdmin, async (req, res) => {
  try {
    const { password, backupName } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    // 백업 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = backupName ? `${backupName}_${timestamp}.sql` : `backup_${timestamp}.sql`;
    const backupPath = `./backups/${fileName}`;

    // 백업 디렉토리 생성
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // PostgreSQL 백업 명령어 실행
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL;
    
    // DATABASE_URL에서 호스트, 포트, 데이터베이스명, 사용자명 추출
    const dbUrlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!dbUrlMatch) {
      throw new Error('DATABASE_URL 형식이 올바르지 않습니다.');
    }
    
    const [, username, password_db, host, port, database] = dbUrlMatch;
    
    // Windows 환경 대응
    const isWindows = process.platform === 'win32';
    const pgDumpCommand = isWindows 
      ? `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe" -h ${host} -p ${port} -U ${username} -d ${database} -f "${backupPath}"`
      : `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -f "${backupPath}"`;
    
    console.log('🔍 백업 명령어:', pgDumpCommand);
    
    // 환경변수 설정 (비밀번호)
    const env = { ...process.env, PGPASSWORD: password_db };
    
    exec(pgDumpCommand, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ 백업 생성 실패:', error);
        return res.status(500).json({
          error: {
            code: 'BACKUP_ERROR',
            message: '백업 생성에 실패했습니다.',
            details: error.message
          }
        });
      }
      
      // 백업 정보를 데이터베이스에 저장
      const backupInfo = {
        filename: fileName,
        size: fs.statSync(backupPath).size,
        created_at: new Date().toISOString(),
        created_by: req.user?.email || 'admin'
      };
      
      pool.query(
        'INSERT INTO admin_backups (filename, size, created_at, created_by) VALUES ($1, $2, $3, $4)',
        [backupInfo.filename, backupInfo.size, backupInfo.created_at, backupInfo.created_by]
      ).then(() => {
        res.json({
          success: true,
          message: '백업이 성공적으로 생성되었습니다.',
          data: backupInfo
        });
      }).catch(dbError => {
        console.error('❌ 백업 정보 저장 실패:', dbError);
        res.json({
          success: true,
          message: '백업이 생성되었지만 정보 저장에 실패했습니다.',
          data: backupInfo
        });
      });
    });
  } catch (error) {
    console.error('❌ 백업 생성 실패:', error);
    res.status(500).json({
      error: {
        code: 'BACKUP_ERROR',
        message: '백업 생성에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 백업 목록 조회
router.get('/database/backups', requireAdmin, async (req, res) => {
  try {
    // 데이터베이스에서 백업 정보 조회
    const result = await pool.query(
      'SELECT * FROM admin_backups ORDER BY created_at DESC'
    );
    
    // 파일 시스템에서 실제 파일 확인
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    
    const backups = result.rows.map(backup => {
      const filePath = path.join(backupDir, backup.filename);
      const exists = fs.existsSync(filePath);
      const stats = exists ? fs.statSync(filePath) : null;
      
      return {
        ...backup,
        exists,
        actual_size: stats ? stats.size : 0,
        last_modified: stats ? stats.mtime.toISOString() : null
      };
    });
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('❌ 백업 목록 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'BACKUP_LIST_ERROR',
        message: '백업 목록 조회에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 백업 파일 다운로드 (비밀번호 기반 인증)
router.get('/database/backups/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { password } = req.query; // URL 쿼리 파라미터로 비밀번호 받기
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    const path = require('path');
    const fs = require('fs');
    
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: '백업 파일을 찾을 수 없습니다.'
        }
      });
    }
    
    res.download(filePath, filename);
  } catch (error) {
    console.error('❌ 백업 다운로드 실패:', error);
    res.status(500).json({
      error: {
        code: 'BACKUP_DOWNLOAD_ERROR',
        message: '백업 다운로드에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 데이터베이스 복원
router.post('/database/restore', requireAdmin, async (req, res) => {
  try {
    const { password, filename } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    if (!filename) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FILENAME',
          message: '복원할 백업 파일명이 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    // 백업 파일 존재 확인
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: '백업 파일을 찾을 수 없습니다.'
        }
      });
    }

    // PostgreSQL 복원 명령어 실행
    const { exec } = require('child_process');
    const dbUrl = process.env.DATABASE_URL;
    
    // DATABASE_URL에서 호스트, 포트, 데이터베이스명, 사용자명 추출
    const dbUrlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!dbUrlMatch) {
      throw new Error('DATABASE_URL 형식이 올바르지 않습니다.');
    }
    
    const [, username, password_db, host, port, database] = dbUrlMatch;
    
    const psqlCommand = `psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${filePath}"`;
    
    // 환경변수 설정 (비밀번호)
    const env = { ...process.env, PGPASSWORD: password_db };
    
    exec(psqlCommand, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ 복원 실패:', error);
        return res.status(500).json({
          error: {
            code: 'RESTORE_ERROR',
            message: '데이터베이스 복원에 실패했습니다.',
            details: error.message
          }
        });
      }
      
      // 복원 로그 저장
      const restoreInfo = {
        filename,
        restored_at: new Date().toISOString(),
        restored_by: req.user?.email || 'admin'
      };
      
      pool.query(
        'INSERT INTO admin_restores (filename, restored_at, restored_by) VALUES ($1, $2, $3)',
        [restoreInfo.filename, restoreInfo.restored_at, restoreInfo.restored_by]
      ).then(() => {
        res.json({
          success: true,
          message: '데이터베이스가 성공적으로 복원되었습니다.',
          data: restoreInfo
        });
      }).catch(dbError => {
        console.error('❌ 복원 로그 저장 실패:', dbError);
        res.json({
          success: true,
          message: '데이터베이스가 복원되었지만 로그 저장에 실패했습니다.',
          data: restoreInfo
        });
      });
    });
  } catch (error) {
    console.error('❌ 복원 실패:', error);
    res.status(500).json({
      error: {
        code: 'RESTORE_ERROR',
        message: '데이터베이스 복원에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 백업 삭제
router.delete('/database/backups/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PASSWORD',
          message: '관리자 비밀번호가 필요합니다.'
        }
      });
    }

    // 관리자 비밀번호 확인
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '관리자 비밀번호가 올바르지 않습니다.'
        }
      });
    }

    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: '백업 파일을 찾을 수 없습니다.'
        }
      });
    }

    // 파일 삭제
    fs.unlinkSync(filePath);
    
    // 데이터베이스에서 백업 정보 삭제
    await pool.query('DELETE FROM admin_backups WHERE filename = $1', [filename]);
    
    res.json({
      success: true,
      message: '백업 파일이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('❌ 백업 삭제 실패:', error);
    res.status(500).json({
      error: {
        code: 'BACKUP_DELETE_ERROR',
        message: '백업 삭제에 실패했습니다.',
        details: error.message
      }
    });
  }
});

// 안전한 테이블명 검증 함수
function isValidTableName(tableName) {
  const safeTables = ['users', 'chat_sessions', 'messages', 'user_memories', 'security_threats', 'admin_users', 'admin_permissions'];
  return safeTables.includes(tableName);
}

// 안전한 컬럼명 검증 함수
function isValidColumnName(columnName) {
  // SQL 인젝션 방지를 위한 안전한 컬럼명 패턴
  const safeColumnPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return safeColumnPattern.test(columnName);
}

// 테이블별 기본키 컬럼 반환 함수
function getPrimaryKeyColumn(tableName) {
  if (!isValidTableName(tableName)) {
    throw new Error(`안전하지 않은 테이블명: ${tableName}`);
  }
  
  const primaryKeys = {
    'users': 'user_id',
    'chat_sessions': 'chat_id',
    'messages': 'message_id',
    'user_memories': 'memory_id',
    'security_threats': 'threat_id',
    'admin_users': 'admin_id',
    'admin_permissions': 'permission_id'
  };
  
  return primaryKeys[tableName] || 'id';
}

module.exports = router;
