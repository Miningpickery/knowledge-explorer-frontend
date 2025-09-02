// ============================================================================
// MEMORY SERVICE - 사용자별 장기메모리 관리
// ============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 사용자의 모든 메모리 조회 (프로필 정보 포함)
async function getUserMemories(userId, limit = 50) {
  try {
    // 1. 기본 메모리 조회
    const memoryQuery = `
      SELECT memory_id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
      FROM user_memories
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY importance DESC, created_at DESC
      LIMIT $2
    `;
    
    const memoryResult = await pool.query(memoryQuery, [userId, limit]);
    const memories = memoryResult.rows;
    
    // 2. 사용자 프로필 정보 조회
    const profileQuery = `
      SELECT name, email, company, role, google_id, created_at
      FROM users
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const profileResult = await pool.query(profileQuery, [userId]);
    const profile = profileResult.rows[0];
    
    // 3. 프로필 기반 컨텍스트 메모리 생성
    if (profile) {
             const profileMemory = {
         memory_id: 'profile_context',
        memory_type: 'profile',
        title: '사용자 프로필 정보',
        content: `사용자명: ${profile.name || '미설정'}
이메일: ${profile.email || '미설정'}
회사: ${profile.company || '미설정'}
역할: ${profile.role || '미설정'}
가입일: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '미설정'}`,
        importance: 5, // 최고 중요도
        tags: ['프로필', '기본정보'],
        chat_id: null,
        created_at: profile.created_at,
        updated_at: profile.created_at
      };
      
      // 프로필 메모리를 최상단에 추가
      memories.unshift(profileMemory);
    }
    
    return memories;
  } catch (error) {
    console.error('❌ 사용자 메모리 조회 실패:', error);
    throw error;
  }
}

// 특정 메모리 조회
async function getMemoryById(memoryId, userId) {
  try {
    const query = `
      SELECT memory_id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
      FROM user_memories
      WHERE memory_id = $1 AND user_id = $2 AND deleted_at IS NULL
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
      RETURNING memory_id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
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

// 메모리 업데이트 (데이터 검증 포함)
async function updateMemory(memoryId, userId, updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 메모리 존재 및 권한 확인
    const checkQuery = `
      SELECT memory_id, user_id FROM user_memories 
      WHERE memory_id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    const checkResult = await client.query(checkQuery, [memoryId, userId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Memory not found or access denied');
    }
    
    // 2. 업데이트 가능한 필드들 검증
    const allowedFields = ['title', 'content', 'importance', 'tags'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    // 3. 메모리 업데이트
    const setClause = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 3}`).join(', ');
    const values = [memoryId, userId, ...Object.values(validUpdates)];
    
    const updateQuery = `
      UPDATE user_memories 
      SET ${setClause}, updated_at = NOW()
      WHERE memory_id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING memory_id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
    `;
    
    const result = await client.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      throw new Error('Memory update failed');
    }
    
    await client.query('COMMIT');
    console.log(`✅ 메모리 업데이트 완료: ${memoryId}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 메모리 업데이트 실패:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 메모리 삭제 (소프트 삭제)
async function deleteMemory(memoryId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 메모리 존재 및 권한 확인
    const checkQuery = `
      SELECT memory_id FROM user_memories 
      WHERE memory_id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    const checkResult = await client.query(checkQuery, [memoryId, userId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Memory not found or access denied');
    }
    
    // 2. 메모리 소프트 삭제
    const deleteQuery = `
      UPDATE user_memories 
      SET deleted_at = NOW() 
      WHERE memory_id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING memory_id
    `;
    
    const result = await client.query(deleteQuery, [memoryId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Memory deletion failed');
    }
    
    await client.query('COMMIT');
    console.log(`✅ 메모리 삭제 완료: ${memoryId}`);
    return { success: true, message: 'Memory deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 메모리 삭제 실패:', error);
    throw error;
  } finally {
    client.release();
  }
}



// 개인정보 중심 핵심 내용 추출 함수 (AI 기반 개선)
function extractKeyPoints(conversationContext) {
  const keyPoints = [];
  
  // conversationContext가 배열인지 확인
  if (!Array.isArray(conversationContext)) {
    console.log('⚠️ conversationContext가 배열이 아닙니다:', typeof conversationContext);
    return [];
  }
  
  // 개인정보 관련 키워드 정의 (더 정교한 분류)
  const personalInfoKeywords = {
    // 개인 식별 정보 (최고 중요도)
    identity: ['이름', '나이', '생년월일', '주소', '전화번호', '이메일', '주민번호', '주민등록번호'],
    // 직업/학력 정보 (높은 중요도)
    career: ['직업', '회사', '직장', '부서', '직급', '학력', '학교', '전공', '경력', '업무'],
    // 개인적 관심사/선호도 (중간 중요도)
    preferences: ['취미', '관심사', '선호', '싫어하는', '좋아하는', '꿈', '목표', '희망'],
    // 개인적 상황/경험 (중간 중요도)
    personal: ['가족', '결혼', '자녀', '경험', '이력', '상황', '문제', '고민', '사정'],
    // 개인적 의견/감정 (낮은 중요도)
    emotions: ['생각', '의견', '감정', '느낌', '걱정', '불안', '기쁨', '스트레스']
  };
  
  // 모든 컨텍스트에서 개인정보 관련 내용만 추출
  conversationContext.forEach((context, index) => {
    if (context && typeof context === 'string' && context.length > 10) {
      // 개인정보 키워드가 포함된 문장들만 추출 (카테고리별로 분류)
      const sentences = context.split(/[.!?。]/).filter(sentence => {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length < 5) return false;
        
        // 모든 카테고리의 키워드 확인
        return Object.values(personalInfoKeywords).flat().some(keyword => 
          trimmedSentence.includes(keyword)
        );
      });
      
      if (sentences.length > 0) {
        // 카테고리별로 개인정보 분류
        const categorizedInfo = {};
        
        sentences.forEach(sentence => {
          Object.entries(personalInfoKeywords).forEach(([category, keywords]) => {
            if (keywords.some(keyword => sentence.includes(keyword))) {
              if (!categorizedInfo[category]) categorizedInfo[category] = [];
              categorizedInfo[category].push(sentence.trim());
            }
          });
        });
        
        // 카테고리별로 요약 생성
        Object.entries(categorizedInfo).forEach(([category, categorySentences]) => {
          const categorySummary = categorySentences.slice(0, 2).join(' ');
          
          if (categorySummary.length > 20) {
            const summary = categorySummary.length > 120 
              ? `${categorySummary.substring(0, 120)}...`
              : categorySummary;
            
            const categoryName = {
              identity: '개인식별정보',
              career: '직업/학력정보',
              preferences: '관심사/선호도',
              personal: '개인상황/경험',
              emotions: '의견/감정'
            }[category];
            
            keyPoints.push(`${categoryName}: ${summary}`);
          }
        });
      }
    }
  });
  
  return keyPoints;
}

// 메모리 품질 점수 계산 함수
function calculateMemoryQualityScore(conversationContext) {
  let score = 0;
  
  // 1. 대화 길이 점수 (0-20점)
  const totalLength = conversationContext.reduce((sum, context) => 
    sum + (context ? context.length : 0), 0
  );
  score += Math.min(20, totalLength / 100);
  
  // 2. 개인정보 키워드 밀도 점수 (0-30점)
  const personalInfoKeywords = [
    '이름', '나이', '생년월일', '주소', '전화번호', '이메일', '주민번호',
    '직업', '회사', '직장', '부서', '직급', '학력', '학교', '전공',
    '취미', '관심사', '선호', '싫어하는', '좋아하는', '꿈', '목표',
    '가족', '결혼', '자녀', '경험', '이력', '상황', '문제', '고민',
    '생각', '의견', '감정', '느낌', '희망', '걱정', '불안', '기쁨'
  ];
  
  const keywordCount = conversationContext.reduce((count, context) => {
    if (!context) return count;
    return count + personalInfoKeywords.filter(keyword => context.includes(keyword)).length;
  }, 0);
  
  score += Math.min(30, keywordCount * 2);
  
  // 3. 대화 복잡성 점수 (0-25점)
  const sentenceCount = conversationContext.reduce((count, context) => {
    if (!context) return count;
    return count + context.split(/[.!?。]/).filter(s => s.trim().length > 5).length;
  }, 0);
  
  score += Math.min(25, sentenceCount * 0.5);
  
  // 4. 추상적 표현 점수 (0-25점)
  const abstractKeywords = ['같다', '비슷하다', '마치', '처럼', '같은', '비슷한', '유사한'];
  const abstractCount = conversationContext.reduce((count, context) => {
    if (!context) return count;
    return count + abstractKeywords.filter(keyword => context.includes(keyword)).length;
  }, 0);
  
  score += Math.min(25, abstractCount * 3);
  
  return Math.round(score);
}

// AI 사용 여부 결정 함수
function shouldUseAI(conversationContext) {
  const qualityScore = calculateMemoryQualityScore(conversationContext);
  
  // 품질 점수가 60점 이상이면 AI 사용
  const useAI = qualityScore >= 60;
  
  console.log(`📊 메모리 품질 점수: ${qualityScore}/100 (AI 사용: ${useAI ? '예' : '아니오'})`);
  
  return useAI;
}

// 프롬프트 출력의 context를 활용한 메모리 저장
async function saveContextBasedMemory(userId, chatId, context, conversationContext) {
  try {
    // context가 유효한지 확인
    if (!context || typeof context !== 'string' || context.trim().length < 5) {
      console.log('📝 컨텍스트가 유효하지 않음 - 메모리 저장 건너뜀');
      return null;
    }

    // 개인정보 키워드 확인
    const personalInfoKeywords = [
      '이름', '나이', '생년월일', '주소', '전화번호', '이메일', '주민번호',
      '직업', '회사', '직장', '부서', '직급', '학력', '학교', '전공',
      '취미', '관심사', '선호', '싫어하는', '좋아하는', '꿈', '목표',
      '가족', '결혼', '자녀', '경험', '이력', '상황', '문제', '고민',
      '생각', '의견', '감정', '느낌', '희망', '걱정', '불안', '기쁨'
    ];

    const hasPersonalInfo = personalInfoKeywords.some(keyword => 
      context.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasPersonalInfo) {
      console.log('📝 컨텍스트에 개인정보 없음 - 메모리 저장 건너뜀');
      return null;
    }

    // 컨텍스트 품질 점수 계산
    const qualityScore = calculateContextQualityScore(context, conversationContext);
    
    // 품질 점수가 낮으면 저장하지 않음
    if (qualityScore < 30) {
      console.log(`📝 컨텍스트 품질 점수 낮음 (${qualityScore}/100) - 메모리 저장 건너뜀`);
      return null;
    }

    const title = `AI 컨텍스트 요약 - ${new Date().toLocaleDateString('ko-KR')}`;
    const content = `AI가 추출한 대화 핵심: ${context}\n\n관련 대화 내용:\n${conversationContext.slice(-2).join('\n')}`;

    const memoryData = {
      memory_type: 'ai_context_summary',
      title,
      content,
      importance: qualityScore >= 70 ? 4 : 3, // 품질에 따른 중요도 조정
      tags: ['개인정보', 'AI추출', '컨텍스트요약', '자동생성'],
      chat_id: chatId
    };

    const memory = await createMemory(userId, memoryData);
    console.log(`📝 AI 컨텍스트 기반 메모리 생성: ${memory.memory_id} (품질점수: ${qualityScore})`);
    return memory;
  } catch (error) {
    console.error('❌ 컨텍스트 기반 메모리 저장 실패:', error);
    return null;
  }
}

// 컨텍스트 품질 점수 계산 함수
function calculateContextQualityScore(context, conversationContext) {
  let score = 0;
  
  // 1. 컨텍스트 길이 점수 (0-20점)
  score += Math.min(20, context.length / 5);
  
  // 2. 개인정보 키워드 밀도 점수 (0-30점)
  const personalInfoKeywords = [
    '이름', '나이', '생년월일', '주소', '전화번호', '이메일', '주민번호',
    '직업', '회사', '직장', '부서', '직급', '학력', '학교', '전공',
    '취미', '관심사', '선호', '싫어하는', '좋아하는', '꿈', '목표',
    '가족', '결혼', '자녀', '경험', '이력', '상황', '문제', '고민',
    '생각', '의견', '감정', '느낌', '희망', '걱정', '불안', '기쁨'
  ];
  
  const keywordCount = personalInfoKeywords.filter(keyword => 
    context.toLowerCase().includes(keyword.toLowerCase())
  ).length;
  
  score += Math.min(30, keywordCount * 5);
  
  // 3. 구체성 점수 (0-25점)
  const specificKeywords = ['이름', '나이', '직업', '회사', '학교', '가족', '취미'];
  const specificCount = specificKeywords.filter(keyword => 
    context.toLowerCase().includes(keyword.toLowerCase())
  ).length;
  
  score += Math.min(25, specificCount * 4);
  
  // 4. 대화 연관성 점수 (0-25점)
  const contextWords = context.toLowerCase().split(/\s+/);
  const conversationText = conversationContext.join(' ').toLowerCase();
  
  const matchingWords = contextWords.filter(word => 
    word.length > 2 && conversationText.includes(word)
  ).length;
  
  score += Math.min(25, matchingWords * 2);
  
  return Math.round(score);
}

// AI 기반 개인정보 추출 함수
async function extractWithAI(conversationContext) {
  try {
    console.log('🤖 AI 기반 개인정보 추출 시작...');
    
    // Gemini API를 사용한 AI 기반 추출
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `
다음 대화에서 개인정보를 추출하여 JSON 형태로 반환하세요.

대화 내용:
${conversationContext.join('\n\n')}

다음 카테고리별로 개인정보를 분류하여 추출하세요:
1. 개인식별정보 (이름, 나이, 생년월일, 주소, 전화번호, 이메일)
2. 직업/학력정보 (직업, 회사, 직장, 부서, 직급, 학력, 학교, 전공)
3. 관심사/선호도 (취미, 관심사, 선호, 꿈, 목표)
4. 개인상황/경험 (가족, 결혼, 자녀, 경험, 이력, 상황, 문제, 고민)
5. 의견/감정 (생각, 의견, 감정, 느낌, 걱정, 불안, 기쁨)

응답 형식:
{
  "personal_info": {
    "identity": ["추출된 개인식별정보"],
    "career": ["추출된 직업/학력정보"],
    "preferences": ["추출된 관심사/선호도"],
    "personal": ["추출된 개인상황/경험"],
    "emotions": ["추출된 의견/감정"]
  },
  "summary": "전체 개인정보 요약",
  "importance_score": 1-5
}

개인정보가 없는 경우 빈 배열을 반환하세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱
    const aiExtraction = JSON.parse(text);
    
    console.log('✅ AI 기반 개인정보 추출 완료');
    return aiExtraction;
    
  } catch (error) {
    console.error('❌ AI 기반 추출 실패:', error);
    // AI 실패 시 키워드 기반 추출로 폴백
    return extractKeyPoints(conversationContext);
  }
}

// 하이브리드 메모리 추출 함수 (AI + 키워드)
async function extractAndSaveMemory(userId, chatId, conversationContext) {
  try {
    // AI 사용 여부 결정
    const useAI = shouldUseAI(conversationContext);
    
    let extractedInfo;
    if (useAI) {
      console.log('🤖 AI 기반 메모리 추출 사용');
      extractedInfo = await extractWithAI(conversationContext);
    } else {
      console.log('🔍 키워드 기반 메모리 추출 사용');
      extractedInfo = extractKeyPoints(conversationContext);
    }
    
    if (!extractedInfo || (Array.isArray(extractedInfo) && extractedInfo.length === 0)) {
      console.log('📝 추출할 핵심 내용이 없습니다.');
      return null;
    }
    
    const title = `대화 요약 - ${new Date().toLocaleDateString('ko-KR')}`;
    const content = Array.isArray(extractedInfo) 
      ? extractedInfo.join('\n\n')
      : extractedInfo.summary || JSON.stringify(extractedInfo.personal_info, null, 2);
    
    const memoryData = {
      memory_type: useAI ? 'ai_conversation_summary' : 'keyword_conversation_summary',
      title,
      content,
      importance: useAI ? (extractedInfo.importance_score || 3) : 3,
      tags: ['개인정보', useAI ? 'AI추출' : '키워드추출', '자동생성', '대화요약'],
      chat_id: chatId
    };
    
    const memory = await createMemory(userId, memoryData);
    console.log(`📝 ${useAI ? 'AI' : '키워드'} 기반 메모리 생성: ${memory.memory_id}`);
    return memory;
  } catch (error) {
    console.error('❌ 메모리 추출 및 저장 실패:', error);
    return null;
  }
}

// 메모리 통계 조회 (성능 최적화)
async function getMemoryStats(userId) {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_memories,
        COUNT(CASE WHEN importance >= 4 THEN 1 END) as high_importance,
        COUNT(CASE WHEN importance = 3 THEN 1 END) as medium_importance,
        COUNT(CASE WHEN importance <= 2 THEN 1 END) as low_importance,
        COUNT(CASE WHEN memory_type = 'conversation' THEN 1 END) as conversation_memories,
        COUNT(CASE WHEN memory_type = 'profile' THEN 1 END) as profile_memories,
        MAX(created_at) as last_created,
        AVG(importance) as avg_importance
      FROM user_memories 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    
    const result = await pool.query(query, [userId]);
    const stats = result.rows[0];
    
    // 숫자 필드들을 적절한 타입으로 변환
    stats.total_memories = parseInt(stats.total_memories) || 0;
    stats.high_importance = parseInt(stats.high_importance) || 0;
    stats.medium_importance = parseInt(stats.medium_importance) || 0;
    stats.low_importance = parseInt(stats.low_importance) || 0;
    stats.conversation_memories = parseInt(stats.conversation_memories) || 0;
    stats.profile_memories = parseInt(stats.profile_memories) || 0;
    stats.avg_importance = parseFloat(stats.avg_importance) || 0;
    
    return stats;
  } catch (error) {
    console.error('❌ 메모리 통계 조회 실패:', error);
    throw error;
  }
}

// 태그별 메모리 검색 (성능 최적화)
async function searchMemoriesByTags(userId, tags) {
  try {
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags array is required');
    }
    
         const query = `
       SELECT memory_id, memory_type, title, content, importance, tags, chat_id, created_at, updated_at
       FROM user_memories 
       WHERE user_id = $1 
         AND deleted_at IS NULL
         AND tags && $2
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
  extractWithAI,
  calculateMemoryQualityScore,
  shouldUseAI,
  calculateContextQualityScore,
  getMemoryStats,
  searchMemoriesByTags,
  saveContextBasedMemory
};




