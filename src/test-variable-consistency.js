// ============================================================================
// VARIABLE NAME CONSISTENCY TEST SCRIPT
// ============================================================================

const fs = require('fs');
const path = require('path');

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

// 1. req.user 변수명 일관성 테스트
const testReqUserConsistency = async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = getAllJsFiles(srcDir);
  
  const inconsistentPatterns = [];
  
  for (const file of jsFiles) {
    // 테스트 스크립트 자체는 제외
    if (file.includes('test-variable-consistency.js') || file.includes('test-normalization.js')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // req.user.userId 패턴 찾기 (이제는 req.user.id를 사용해야 함)
    const userIdMatches = content.match(/req\.user\.userId/g);
    if (userIdMatches) {
      inconsistentPatterns.push({
        file: path.relative(process.cwd(), file),
        pattern: 'req.user.userId',
        count: userIdMatches.length
      });
    }
    
    // user.id vs user.userId 혼재 사용 확인
    const userDotIdMatches = content.match(/user\.id/g);
    const userDotUserIdMatches = content.match(/user\.userId/g);
    
    if (userDotIdMatches && userDotUserIdMatches) {
      inconsistentPatterns.push({
        file: path.relative(process.cwd(), file),
        pattern: 'user.id vs user.userId 혼재',
        count: userDotIdMatches.length + userDotUserIdMatches.length
      });
    }
  }
  
  if (inconsistentPatterns.length > 0) {
    throw new Error(`변수명 불일치 발견:\n${inconsistentPatterns.map(p => 
      `  - ${p.file}: ${p.pattern} (${p.count}개)`
    ).join('\n')}`);
  }
};

// 2. 데이터베이스 컬럼명 일관성 테스트
const testDatabaseColumnConsistency = async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = getAllJsFiles(srcDir);
  
  const inconsistentPatterns = [];
  
  for (const file of jsFiles) {
    // 테스트 스크립트 자체는 제외
    if (file.includes('test-variable-consistency.js') || file.includes('test-normalization.js')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // user_id 컬럼명이 올바르게 사용되는지 확인
    const userUnderscoreIdMatches = content.match(/user_id/g);
    const userIdCamelCaseMatches = content.match(/userId/g);
    
    // SQL 쿼리에서는 user_id를 사용해야 함
    const sqlQueries = content.match(/SELECT.*FROM|INSERT.*INTO|UPDATE.*SET|DELETE.*FROM/gi);
    if (sqlQueries) {
      for (const query of sqlQueries) {
        if (query.includes('userId') && !query.includes('user_id')) {
          inconsistentPatterns.push({
            file: path.relative(process.cwd(), file),
            pattern: 'SQL에서 userId 사용 (user_id여야 함)',
            query: `${query.substring(0, 100)  }...`
          });
        }
      }
    }
  }
  
  if (inconsistentPatterns.length > 0) {
    throw new Error(`데이터베이스 컬럼명 불일치 발견:\n${inconsistentPatterns.map(p => 
      `  - ${p.file}: ${p.pattern}\n    Query: ${p.query}`
    ).join('\n')}`);
  }
};

// 3. 함수 매개변수 일관성 테스트
const testFunctionParameterConsistency = async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = getAllJsFiles(srcDir);
  
  const inconsistentPatterns = [];
  
  for (const file of jsFiles) {
    // 테스트 스크립트 자체는 제외
    if (file.includes('test-variable-consistency.js') || file.includes('test-normalization.js')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // 함수 정의에서 userId vs id 매개변수 확인
    const functionDefs = content.match(/function\s+\w+\s*\([^)]*\)|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g);
    if (functionDefs) {
      for (const funcDef of functionDefs) {
        if (funcDef.includes('userId') && funcDef.includes('id')) {
          inconsistentPatterns.push({
            file: path.relative(process.cwd(), file),
            pattern: '함수 매개변수에서 userId와 id 혼재',
            function: `${funcDef.substring(0, 100)  }...`
          });
        }
      }
    }
  }
  
  if (inconsistentPatterns.length > 0) {
    throw new Error(`함수 매개변수 불일치 발견:\n${inconsistentPatterns.map(p => 
      `  - ${p.file}: ${p.pattern}\n    Function: ${p.function}`
    ).join('\n')}`);
  }
};

// 4. 주석 일관성 테스트
const testCommentConsistency = async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = getAllJsFiles(srcDir);
  
  const inconsistentPatterns = [];
  
  for (const file of jsFiles) {
    // 테스트 스크립트 자체는 제외
    if (file.includes('test-variable-consistency.js') || file.includes('test-normalization.js')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // 주석에서 혼란스러운 설명 확인
    const comments = content.match(/\/\/.*$/gm);
    if (comments) {
      for (const comment of comments) {
        if (comment.includes('userId') && comment.includes('user.id')) {
          inconsistentPatterns.push({
            file: path.relative(process.cwd(), file),
            pattern: '주석에서 userId와 user.id 혼재 언급',
            comment: comment.trim()
          });
        }
      }
    }
  }
  
  if (inconsistentPatterns.length > 0) {
    console.log(`⚠️ 주석 불일치 발견 (경고):\n${inconsistentPatterns.map(p => 
      `  - ${p.file}: ${p.comment}`
    ).join('\n')}`);
  }
};

// 모든 JS 파일 찾기
const getAllJsFiles = (dir) => {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
};

// 메인 테스트 실행
const runAllTests = async () => {
  console.log('🚀 Starting Variable Name Consistency Tests...\n');
  
  await runTest('req.user 변수명 일관성', testReqUserConsistency);
  await runTest('데이터베이스 컬럼명 일관성', testDatabaseColumnConsistency);
  await runTest('함수 매개변수 일관성', testFunctionParameterConsistency);
  await runTest('주석 일관성', testCommentConsistency);
  
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
    console.log('\n🎉 All variable name consistency tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Please fix the variable name inconsistencies above.');
    process.exit(1);
  }
};

// 스크립트 실행
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Variable name consistency test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testResults
};
