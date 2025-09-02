// 데이터베이스 상태 확인 스크립트
// 브라우저 콘솔에서 실행하세요

console.log('🔍 데이터베이스 상태 확인 시작...');

// API 엔드포인트
const API_BASE = 'http://localhost:3001/api';
const HEALTH_ENDPOINTS = {
  status: '/health/database/status',
  users: '/health/database/users/sample',
  chats: '/health/database/chats/sample',
  messages: '/health/database/messages/sample',
  memories: '/health/database/memories/sample'
};

// 데이터베이스 상태 확인
async function checkDatabaseStatus() {
  try {
    console.log('📡 데이터베이스 연결 상태 확인 중...');
    const response = await fetch(`${API_BASE}${HEALTH_ENDPOINTS.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 데이터베이스 상태:', result.data);
      return result.data;
    } else {
      throw new Error(`HTTP ${response.status}: 상태 확인 실패`);
    }
  } catch (error) {
    console.error('❌ 데이터베이스 상태 확인 실패:', error);
    return null;
  }
}

// 샘플 데이터 로드
async function loadSampleData(type, limit = 10) {
  try {
    console.log(`📝 ${type} 샘플 데이터 로드 중...`);
    const response = await fetch(`${API_BASE}${HEALTH_ENDPOINTS[type]}?limit=${limit}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${type} 샘플 데이터:`, result.data);
      return result.data;
    } else {
      throw new Error(`HTTP ${response.status}: ${type} 데이터 로드 실패`);
    }
  } catch (error) {
    console.error(`❌ ${type} 데이터 로드 실패:`, error);
    return [];
  }
}

// 전체 데이터베이스 점검
async function fullDatabaseCheck() {
  console.log('🔍 전체 데이터베이스 점검 시작...\n');
  
  // 1. 연결 상태 확인
  const status = await checkDatabaseStatus();
  if (!status) {
    console.log('❌ 데이터베이스 연결에 실패했습니다.');
    return;
  }
  
  console.log('\n📊 테이블별 레코드 수:');
  Object.entries(status.recordCounts).forEach(([table, count]) => {
    console.log(`  ${table}: ${count.toLocaleString()}개`);
  });
  
  console.log('\n📋 테이블 존재 여부:');
  Object.entries(status.tables).forEach(([table, exists]) => {
    console.log(`  ${table}: ${exists ? '✅ 존재' : '❌ 없음'}`);
  });
  
  // 2. 샘플 데이터 로드
  console.log('\n📝 샘플 데이터 확인:');
  
  const users = await loadSampleData('users', 5);
  const chats = await loadSampleData('chats', 5);
  const messages = await loadSampleData('messages', 5);
  const memories = await loadSampleData('memories', 5);
  
  // 3. 데이터 요약
  console.log('\n📈 데이터 요약:');
  console.log(`  👥 사용자: ${users.length}개`);
  console.log(`  💬 채팅 세션: ${chats.length}개`);
  console.log(`  💭 메시지: ${messages.length}개`);
  console.log(`  🧠 메모리: ${memories.length}개`);
  
  return {
    status,
    sampleData: { users, chats, messages, memories }
  };
}

// 특정 테이블 상세 확인
async function checkTableDetails(tableName) {
  console.log(`🔍 ${tableName} 테이블 상세 확인...`);
  
  const data = await loadSampleData(tableName, 20);
  
  if (data.length > 0) {
    console.log(`\n📋 ${tableName} 테이블 구조:`, Object.keys(data[0]));
    console.log(`\n📝 ${tableName} 샘플 레코드:`);
    data.forEach((item, index) => {
      console.log(`  ${index + 1}.`, item);
    });
  }
  
  return data;
}

// 전역 함수로 등록 (브라우저 콘솔에서 사용)
window.dbCheck = {
  status: checkDatabaseStatus,
  sample: loadSampleData,
  full: fullDatabaseCheck,
  table: checkTableDetails
};

console.log('✅ 데이터베이스 확인 스크립트 로드 완료!');
console.log('사용법:');
console.log('  dbCheck.full() - 전체 데이터베이스 점검');
console.log('  dbCheck.status() - 연결 상태만 확인');
console.log('  dbCheck.sample("users", 10) - 사용자 샘플 데이터 10개');
console.log('  dbCheck.table("users") - 사용자 테이블 상세 확인');

// 자동으로 전체 점검 실행
fullDatabaseCheck();
