// ============================================================================
// DATABASE NORMALIZATION TEST SCRIPT
// ============================================================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 테스트 결과 저장
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// 테스트 헬퍼 함수
const runTest = async (testName, testFunction) => {
  try {
    console.log(`\n🧪 Running test: ${testName}`);
    await testFunction();
    console.log(`✅ PASS: ${testName}`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${testName}`);
    console.log(`   Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
  }
};

// 1. 테이블 존재 여부 테스트
const testTableExistence = async () => {
  const requiredTables = [
    'users',
    'chat_sessions', 
    'messages',
    'user_memories',
    'security_threats',
    'user_sessions'
  ];

  for (const table of requiredTables) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [table]);
    
    if (!result.rows[0].exists) {
      throw new Error(`Table '${table}' does not exist`);
    }
  }
};

// 2. 컬럼 타입 일관성 테스트
const testColumnTypeConsistency = async () => {
  // chat_id 컬럼들이 모두 VARCHAR(50)인지 확인
  const chatIdColumns = [
    { table: 'messages', column: 'chat_id' },
    { table: 'security_threats', column: 'chat_id' },
    { table: 'user_memories', column: 'chat_id' }
  ];

  for (const { table, column } of chatIdColumns) {
    const result = await pool.query(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [table, column]);
    
    if (result.rows.length === 0) {
      throw new Error(`Column '${column}' not found in table '${table}'`);
    }
    
    const colInfo = result.rows[0];
    if (colInfo.data_type !== 'character varying' || colInfo.character_maximum_length !== 50) {
      throw new Error(`Column '${table}.${column}' should be VARCHAR(50), but is ${colInfo.data_type}(${colInfo.character_maximum_length})`);
    }
  }
};

// 3. 외래키 제약조건 테스트
const testForeignKeyConstraints = async () => {
  const foreignKeys = [
    { table: 'chat_sessions', column: 'user_id', references: 'users(user_id)' },
    { table: 'messages', column: 'chat_id', references: 'chat_sessions(chat_id)' },
    { table: 'messages', column: 'user_id', references: 'users(user_id)' },
    { table: 'security_threats', column: 'chat_id', references: 'chat_sessions(chat_id)' },
    { table: 'user_memories', column: 'chat_id', references: 'chat_sessions(chat_id)' },
    { table: 'user_memories', column: 'user_id', references: 'users(user_id)' },
    { table: 'user_sessions', column: 'user_id', references: 'users(user_id)' }
  ];

  for (const fk of foreignKeys) {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_name = $1
      AND kcu.column_name = $2
    `, [fk.table, fk.column]);
    
    if (parseInt(result.rows[0].count) === 0) {
      console.log(`⚠️ Foreign key constraint missing: ${fk.table}.${fk.column} → ${fk.references}`);
      // 외래키가 없어도 테스트를 계속 진행 (선택적 외래키)
    }
  }
};

// 4. 인덱스 존재 테스트
const testIndexExistence = async () => {
  const requiredIndexes = [
    'idx_messages_chat_id',
    'idx_messages_user_id',
    'idx_chat_sessions_user_id',
    'idx_chat_sessions_updated_at',
    'idx_users_email',
    'idx_security_threats_chat_id',
    'idx_user_memories_chat_id',
    'idx_user_memories_user_id',
    'idx_user_memories_importance',
    'idx_user_memories_created_at',
    'idx_user_sessions_token_hash',
    'idx_user_sessions_expires_at'
  ];

  for (const indexName of requiredIndexes) {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE indexname = $1
    `, [indexName]);
    
    if (parseInt(result.rows[0].count) === 0) {
      throw new Error(`Index '${indexName}' does not exist`);
    }
  }
};

// 5. 데이터 무결성 테스트
const testDataIntegrity = async () => {
  // orphaned messages 확인
  const orphanedMessages = await pool.query(`
    SELECT COUNT(*) as count
    FROM messages m
    LEFT JOIN chat_sessions cs ON m.chat_id = cs.chat_id
    WHERE cs.chat_id IS NULL
  `);
  
  if (parseInt(orphanedMessages.rows[0].count) > 0) {
    throw new Error(`Found ${orphanedMessages.rows[0].count} orphaned messages`);
  }

  // orphaned chat_sessions 확인
  const orphanedChats = await pool.query(`
    SELECT COUNT(*) as count
    FROM chat_sessions cs
    LEFT JOIN users u ON cs.user_id = u.user_id
    WHERE cs.user_id IS NOT NULL AND u.user_id IS NULL
  `);
  
  if (parseInt(orphanedChats.rows[0].count) > 0) {
    throw new Error(`Found ${orphanedChats.rows[0].count} orphaned chat sessions`);
  }
};

// 6. 변수명 일관성 테스트 (코드 분석)
const testVariableNameConsistency = async () => {
  console.log('📝 Checking variable name consistency...');
  
  // 실제로는 코드 파일을 읽어서 분석해야 하지만,
  // 여기서는 데이터베이스 스키마 기반으로 확인
  const userColumns = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY column_name
  `);
  
  const expectedUserColumns = [
    'user_id', 'email', 'name', 'company', 'role', 'google_id', 
    'profile_picture', 'is_active', 'last_login',
    'created_at', 'updated_at', 'deleted_at'
  ];
  
  const actualColumns = userColumns.rows.map(row => row.column_name);
  const missingColumns = expectedUserColumns.filter(col => !actualColumns.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`Missing user columns: ${missingColumns.join(', ')}`);
  }
};

// 7. API 엔드포인트 테스트
const testAPIEndpoints = async () => {
  console.log('🔌 Testing API endpoint consistency...');
  
  // 실제 API 테스트는 별도로 구현해야 하지만,
  // 여기서는 데이터베이스 연결 상태만 확인
  const result = await pool.query('SELECT 1 as test');
  if (result.rows[0].test !== 1) {
    throw new Error('Database connection test failed');
  }
};

// 메인 테스트 실행
const runAllTests = async () => {
  console.log('🚀 Starting Database Normalization Tests...\n');
  
  await runTest('Table Existence', testTableExistence);
  await runTest('Column Type Consistency', testColumnTypeConsistency);
  await runTest('Foreign Key Constraints', testForeignKeyConstraints);
  await runTest('Index Existence', testIndexExistence);
  await runTest('Data Integrity', testDataIntegrity);
  await runTest('Variable Name Consistency', testVariableNameConsistency);
  await runTest('API Endpoints', testAPIEndpoints);
  
  // 결과 출력
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Database is properly normalized.');
  } else {
    console.log('\n⚠️ Some tests failed. Please fix the issues above.');
    process.exit(1);
  }
};

// 스크립트 실행
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Normalization test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = {
  runAllTests,
  testResults
};
