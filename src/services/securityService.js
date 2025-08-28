// ============================================================================
// SECURITY SERVICE - 보안 위협 모니터링 및 로깅
// ============================================================================

const { Pool } = require('pg');

// 데이터베이스 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 보안 위협 로깅 테이블 생성
async function initializeSecurityTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_threats (
        id SERIAL PRIMARY KEY,
        threat_type VARCHAR(50) NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
        user_question TEXT NOT NULL,
        detected_patterns TEXT[],
        user_ip VARCHAR(45),
        user_agent TEXT,
        chat_id VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        handled BOOLEAN DEFAULT FALSE,
        response_type VARCHAR(50) DEFAULT 'security_response'
      )
    `);

    // 인덱스 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_threats_timestamp 
      ON security_threats(timestamp DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_security_threats_type 
      ON security_threats(threat_type, threat_level)
    `);

    console.log('✅ 보안 테이블 초기화 완료');
  } catch (error) {
    console.error('❌ 보안 테이블 초기화 실패:', error);
    throw error;
  }
}

// 보안 위협 로깅 (강화된 버전)
async function logSecurityThreat(threatData) {
  try {
    const {
      threatType,
      threatLevel,
      userQuestion,
      detectedPatterns,
      userIp,
      userAgent,
      chatId
    } = threatData;

    // IP 주소 마스킹 (개인정보 보호)
    const maskedIp = userIp ? maskIpAddress(userIp) : null;
    
    // 사용자 에이전트 정보 정리
    const sanitizedUserAgent = userAgent ? sanitizeUserAgent(userAgent) : null;

    const query = `
      INSERT INTO security_threats 
      (threat_type, threat_level, user_question, detected_patterns, user_ip, user_agent, chat_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const result = await pool.query(query, [
      threatType,
      threatLevel,
      userQuestion,
      detectedPatterns,
      maskedIp,
      sanitizedUserAgent,
      chatId
    ]);

    console.log(`🛡️ 보안 위협 로깅 완료 - ID: ${result.rows[0].id}`);
    
    // 높은 수준의 위협은 즉시 알림
    if (threatLevel === 'HIGH' || threatLevel === 'CRITICAL') {
      await sendSecurityAlert(threatData);
    }
    
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ 보안 위협 로깅 실패:', error);
    // 로깅 실패가 전체 시스템에 영향을 주지 않도록 에러를 던지지 않음
  }
}

// IP 주소 마스킹 (개인정보 보호)
function maskIpAddress(ip) {
  if (!ip) return null;
  
  // IPv4 주소 마스킹 (마지막 옥텟만 마스킹)
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }
  }
  
  // IPv6 주소 마스킹 (마지막 64비트 마스킹)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(':')}::*`;
    }
  }
  
  return ip;
}

// 사용자 에이전트 정보 정리
function sanitizeUserAgent(userAgent) {
  if (!userAgent) return null;
  
  // 민감한 정보 제거
  return userAgent
    .replace(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g, '***.***.***.***')
    .replace(/[a-f0-9]{8,}/gi, '***') // 해시값 마스킹
    .substring(0, 200); // 길이 제한
}

// 보안 알림 전송
async function sendSecurityAlert(threatData) {
  try {
    // 여기에 실제 알림 로직 구현 (이메일, 슬랙, 텔레그램 등)
    console.log(`🚨 보안 알림: ${threatData.threatType} (${threatData.threatLevel})`);
    console.log(`📍 IP: ${maskIpAddress(threatData.userIp)}`);
    console.log(`💬 질문: ${threatData.userQuestion.substring(0, 100)}...`);
    
    // 실제 구현 시:
    // - 이메일 알림
    // - 슬랙 웹훅
    // - 텔레그램 봇
    // - 관리자 대시보드 업데이트
  } catch (error) {
    console.error('❌ 보안 알림 전송 실패:', error);
  }
}

// 보안 통계 조회
async function getSecurityStats() {
  try {
    const query = `
      SELECT 
        threat_type,
        threat_level,
        COUNT(*) as count,
        DATE_TRUNC('hour', timestamp) as hour
      FROM security_threats 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY threat_type, threat_level, DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC, count DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('❌ 보안 통계 조회 실패:', error);
    return [];
  }
}

// 최근 보안 위협 조회
async function getRecentThreats(limit = 10) {
  try {
    const query = `
      SELECT 
        id,
        threat_type,
        threat_level,
        LEFT(user_question, 100) as question_preview,
        timestamp,
        handled
      FROM security_threats 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ 최근 보안 위협 조회 실패:', error);
    return [];
  }
}

// 보안 위협 처리 완료 표시
async function markThreatHandled(threatId) {
  try {
    const query = `
      UPDATE security_threats 
      SET handled = TRUE 
      WHERE id = $1
    `;

    await pool.query(query, [threatId]);
    console.log(`✅ 보안 위협 처리 완료 - ID: ${threatId}`);
  } catch (error) {
    console.error('❌ 보안 위협 처리 표시 실패:', error);
  }
}

// IP 기반 위협 분석
async function analyzeIpThreats(userIp, timeWindow = '1 hour') {
  try {
    const query = `
      SELECT 
        COUNT(*) as threat_count,
        threat_type,
        threat_level
      FROM security_threats 
      WHERE user_ip = $1 
        AND timestamp > NOW() - INTERVAL '${timeWindow}'
      GROUP BY threat_type, threat_level
      ORDER BY threat_count DESC
    `;

    const result = await pool.query(query, [userIp]);
    return result.rows;
  } catch (error) {
    console.error('❌ IP 위협 분석 실패:', error);
    return [];
  }
}

// 보안 대시보드 데이터
async function getSecurityDashboard() {
  try {
    const stats = await getSecurityStats();
    const recentThreats = await getRecentThreats(5);
    
    // 전체 위협 수
    const totalThreatsResult = await pool.query(`
      SELECT COUNT(*) as total FROM security_threats 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);
    
    // 위협 레벨별 분포
    const levelDistributionResult = await pool.query(`
      SELECT threat_level, COUNT(*) as count
      FROM security_threats 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY threat_level
    `);

    return {
      totalThreats: totalThreatsResult.rows[0]?.total || 0,
      levelDistribution: levelDistributionResult.rows,
      hourlyStats: stats,
      recentThreats: recentThreats
    };
  } catch (error) {
    console.error('❌ 보안 대시보드 데이터 조회 실패:', error);
    return {
      totalThreats: 0,
      levelDistribution: [],
      hourlyStats: [],
      recentThreats: []
    };
  }
}

module.exports = {
  initializeSecurityTables,
  logSecurityThreat,
  getSecurityStats,
  getRecentThreats,
  markThreatHandled,
  analyzeIpThreats,
  getSecurityDashboard,
  maskIpAddress,
  sanitizeUserAgent,
  sendSecurityAlert
};
