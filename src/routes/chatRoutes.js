const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { 
  getAllChats, 
  createNewChat, 
  updateChat,
  deleteChat, 
  getChatById,
  saveMessage,
  saveContext,
  getConversationContext,
  getMessagesByChatId,
  initializeDatabase,
  generateAnonymousUserId
} = require('../services/chatHistoryService');
const { createChatSession } = require('../services/geminiService');
const { generatePrompt, validatePromptStructure, SECURITY_DEFENSE } = require('../prompts/chatPrompt');
const securityService = require('../services/securityService');
const { optionalAuth, authenticateToken } = require('../middleware/auth');
const { validateKey } = require('../middleware/validation');
const memoryService = require('../services/memoryService');

// 개인정보 중심 메모리 저장 조건 확인 함수
async function shouldSaveLongTermMemory(chatId, conversationContexts) {
  try {
    // 1. 대화 길이 확인 (최소 8개 메시지로 감소)
    const messages = await getMessagesByChatId(chatId);
    const messageCount = messages.length;
    
    if (messageCount < 8) { // 사용자 4개 + AI 4개 = 최소 8개
      console.log(`📝 대화가 너무 짧음 (${messageCount}개 메시지) - 메모리 저장 건너뜀`);
      return false;
    }
    
    // 2. 익명 사용자 제외 (user_id IS NULL로 통일)
    if (messages[0]?.user_id === null) {
      console.log('📝 익명 사용자 (user_id IS NULL) - 메모리 저장 건너뜀');
      return false;
    }
    
    // 3. 최근 메모리 저장 시간 확인 (같은 채팅에서 10분 이내 중복 방지로 완화)
    const recentMemories = await memoryService.getUserMemories(messages[0]?.user_id || 1, 5);
    const now = new Date();
    
    for (const memory of recentMemories) {
      if (memory.chat_id === chatId) {
        const memoryTime = new Date(memory.created_at);
        const timeDiff = (now - memoryTime) / (1000 * 60); // 분 단위
        
        if (timeDiff < 10) { // 60분 → 10분으로 완화
          console.log(`📝 최근 메모리 저장됨 (${timeDiff.toFixed(1)}분 전) - 중복 방지`);
          return false;
        }
      }
    }
    
    // 4. 개인정보 관련 키워드 확인 (핵심만)
    const personalInfoKeywords = [
      // 개인 식별 정보
      '이름', '나이', '생년월일', '주소', '전화번호', '이메일', '주민번호',
      // 직업/학력 정보
      '직업', '회사', '직장', '부서', '직급', '학력', '학교', '전공',
      // 개인적 관심사/선호도
      '취미', '관심사', '선호', '싫어하는', '좋아하는', '꿈', '목표',
      // 개인적 상황/경험
      '가족', '결혼', '자녀', '경험', '이력', '상황', '문제', '고민',
      // 개인적 의견/감정
      '생각', '의견', '감정', '느낌', '희망', '걱정', '불안', '기쁨'
    ];
    
    const hasPersonalInfo = conversationContexts.some(context => {
      if (!context) return false;
      return personalInfoKeywords.some(keyword => context.includes(keyword));
    });
    
    // 5. 대화 종결성 확인
    const lastMessage = messages[messages.length - 1];
    const closingExpressions = ['고맙습니다', '감사합니다', '알겠습니다', '도움이 되었습니다', '완료되었습니다', '마무리', '정리해주세요', '끝'];
    const isClosing = closingExpressions.some(expr => 
      lastMessage?.text?.includes(expr)
    );
    
    // 6. 개인정보 밀도 확인 (개인정보 키워드가 2개 이상 포함된 경우)
    const personalInfoCount = conversationContexts.reduce((count, context) => {
      if (!context) return count;
      return count + personalInfoKeywords.filter(keyword => context.includes(keyword)).length;
    }, 0);
    
    const hasHighPersonalInfoDensity = personalInfoCount >= 2;
    
    // 7. 대화 비활성 시간 확인 (마지막 메시지가 15분 이상 지났는지)
    const lastMessageTime = new Date(lastMessage?.timestamp || 0);
    const timeSinceLastMessage = (now - lastMessageTime) / (1000 * 60);
    const isInactive = timeSinceLastMessage > 15;
    
    // 개인정보가 있거나 개인정보 밀도가 높거나 대화가 종결되었거나 비활성 상태일 때만 저장
    if (!hasPersonalInfo && !hasHighPersonalInfoDensity && !isClosing && !isInactive) {
      console.log(`📝 개인정보 관련 내용 부족 - 메모리 저장 건너뜀`);
      return false;
    }
    
    console.log(`✅ 개인정보 중심 메모리 저장 조건 충족 (${messageCount}개 메시지, 개인정보: ${hasPersonalInfo}, 종료: ${isClosing}, 비활성: ${isInactive})`);
    return true;
    
  } catch (error) {
    console.error('❌ 메모리 저장 조건 확인 실패:', error);
    return false; // 오류 시 안전하게 저장하지 않음
  }
}

// 맥락 단위로 텍스트를 분할하는 함수
function splitByContext(text) {
  const chunks = [];
  let currentChunk = '';
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 빈 줄이면 현재 청크 완료
    if (line === '') {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      continue;
    }
    
    // 새로운 맥락의 시작을 감지
    const isNewContext = 
      /^\d+\.\s+\*\*/.test(line) ||
      /^\*\*[^*]+\*\*/.test(line) ||
      /^\*\*예시:\*\*/.test(line) ||
      line.includes('**이 분야가') ||
      line.includes('**예시:**') ||
      line.includes('**결론:**') ||
      line.includes('**요약:**');
    
    // 새로운 맥락이 시작되면 현재 청크 완료
    if (isNewContext && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // 현재 줄을 청크에 추가
    currentChunk += (currentChunk ? '\n' : '') + line;
    
    // 마지막 줄이면 청크 완료
    if (i === lines.length - 1 && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }
  
  // 너무 작은 청크는 병합
  const mergedChunks = [];
  let tempChunk = '';
  
  for (const chunk of chunks) {
    if (chunk.length < 300 && tempChunk.length < 1000) {
      tempChunk += (tempChunk ? '\n\n' : '') + chunk;
    } else {
      if (tempChunk) {
        mergedChunks.push(tempChunk);
        tempChunk = '';
      }
      mergedChunks.push(chunk);
    }
  }
  
  if (tempChunk) {
    mergedChunks.push(tempChunk);
  }
  
  return mergedChunks.filter(chunk => chunk.trim().length > 0);
}

// PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 데이터베이스 초기화
initializeDatabase().catch(console.error);

// GET /api/chats - 모든 대화 목록 조회 (인증된 사용자 또는 익명 사용자)
router.get('/', optionalAuth, async (req, res) => {
  try {
    let userId = req.user?.user_id; // 인증된 사용자 ID
    
    if (!userId) {
      // 익명 사용자인 경우 IP 기반 익명 사용자 ID 생성
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      userId = generateAnonymousUserId(clientIp);
      console.log(`🌐 익명 사용자 IP 기반 ID 생성: ${clientIp} -> ${userId}`);
    }
    
    console.log(`📋 채팅 목록 조회 - userId: ${userId}`);
    const chats = await getAllChats(userId);
    console.log(`✅ ${chats.length}개의 채팅 발견`);
    res.json({
      success: true,
      data: chats,
      count: chats.length
    });
  } catch (error) {
    console.error('Error getting all chats:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '대화 목록을 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chats - 새 대화 생성 (인증된 사용자 또는 익명 사용자)
router.post('/', optionalAuth, async (req, res) => {
  try {
    // 요청 본문에서 userId를 명시적으로 받거나, 인증된 사용자 ID 사용
    const { userId: requestUserId } = req.body;
    const authenticatedUserId = req.user?.user_id;
    
    let userId;
    
    if (requestUserId !== undefined) {
      // 요청에서 명시적으로 userId가 전달된 경우
      userId = requestUserId;
    } else if (authenticatedUserId) {
      // 인증된 사용자인 경우
      userId = authenticatedUserId;
    } else {
      // 익명 사용자인 경우 IP 기반 익명 사용자 ID 생성
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      userId = generateAnonymousUserId(clientIp);
      console.log(`🌐 익명 사용자 IP 기반 ID 생성: ${clientIp} -> ${userId}`);
    }
    
    console.log(`📝 새 채팅 생성 - userId: ${userId} (인증: ${authenticatedUserId}, 요청: ${requestUserId}, IP: ${req.ip})`);
    
    // createNewChat에서 익명 사용자는 temp_ 접두사로 채팅 ID 생성
    const newChat = await createNewChat(userId);
    
    console.log(`✅ 채팅 생성 완료 - chatId: ${newChat.chat_id}`);
    res.status(201).json({
      success: true,
      data: newChat,
      message: '새 대화가 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('Error creating new chat:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '새 대화를 생성하는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/chats/:chatId - 특정 대화 조회 (인증된 사용자 또는 익명 사용자)
router.get('/:chatId', validateKey('chatId', 'chat_sessions'), optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.user_id || null; // 인증된 사용자 ID 또는 null (익명)
    console.log(`🔍 Getting chat with userId: ${userId} for chatId: ${chatId}`);
    const chat = await getChatById(chatId, userId);
    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Error getting chat:', error);
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화 세션을 찾을 수 없습니다.',
          details: `chatId: ${req.params.chatId}`
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: {
          code: 'DATABASE_ERROR',
          message: '대화를 가져오는 중 오류가 발생했습니다.',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});

// GET /api/chats/:chatId/messages - 특정 대화의 메시지 목록 조회
router.get('/:chatId/messages', validateKey('chatId', 'chat_sessions'), optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.user_id || null; // 인증된 사용자 ID 또는 null (익명)
    
    console.log(`📨 Getting messages for chatId: ${chatId}, userId: ${userId}`);
    
    // 익명 채팅의 경우 더 관대한 처리
    let chat = null;
    let messages = [];
    
    try {
      // 채팅 존재 여부 및 접근 권한 확인
      chat = await getChatById(chatId, userId);
    } catch (error) {
      // 익명 채팅의 경우 채팅이 없어도 빈 메시지 배열 반환
      if (chatId.startsWith('temp_')) {
        console.log(`📝 익명 채팅 세션 없음: ${chatId} - 빈 메시지 반환`);
        messages = [];
      } else {
        return res.status(404).json({
          error: {
            code: 'CHAT_NOT_FOUND',
            message: '요청한 대화 세션을 찾을 수 없습니다.',
            details: `chatId: ${chatId}`
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 채팅이 존재하는 경우에만 메시지 조회
    if (chat) {
      try {
        messages = await getMessagesByChatId(chatId);
      } catch (messageError) {
        console.error(`❌ 메시지 조회 실패: ${chatId}`, messageError);
        messages = []; // 메시지 조회 실패 시 빈 배열
      }
    }
    console.log(`✅ 메시지 ${messages.length}개 조회 완료 - chatId: ${chatId}`);
    
    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('❌ 메시지 조회 실패:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '메시지를 가져오는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/chats/:chatId - 대화 수정
router.put('/:chatId', optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const updates = req.body;
    await updateChat(chatId, updates);
    res.json({ message: '대화가 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '대화를 수정하는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/chats/:chatId - 대화 삭제
router.delete('/:chatId', optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.user_id || null;
    
    // 채팅 존재 여부 및 접근 권한 확인
    const chat = await getChatById(chatId, userId);
    if (!chat) {
      return res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화 세션을 찾을 수 없습니다.',
          details: `chatId: ${chatId}`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await deleteChat(chatId);
    res.status(200).json({
      success: true,
      message: '대화가 성공적으로 삭제되었습니다.',
      chatId
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '대화를 삭제하는 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chats/:chatId/messages - 메시지 전송 및 AI 응답 (문단 단위 순차 전송)
router.post('/:chatId/messages', optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const userId = req.user?.user_id || null; // 인증된 사용자 ID 또는 null (익명)

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_MESSAGE',
          message: '유효하지 않은 메시지입니다.',
          details: 'message 필드는 문자열이어야 합니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 🛡️ 보안 검사 수행
    const securityCheck = SECURITY_DEFENSE.checkSecurityThreat(message);
    if (securityCheck.threat !== 'NONE') {
      console.log(`🛡️ 보안 위협 감지: ${securityCheck.threat} (레벨: ${securityCheck.level})`);
      
      // 보안 위협 로깅
      await securityService.logSecurityThreat({
        threatType: securityCheck.threat,
        threatLevel: securityCheck.level,
        userQuestion: message,
        detectedPatterns: SECURITY_DEFENSE.FORBIDDEN_PATTERNS
          .filter(pattern => pattern.test(message.toLowerCase()))
          .map(pattern => pattern.toString()),
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        chatId
      });
      
      // 보안 응답 반환
      const securityResponse = SECURITY_DEFENSE.SECURITY_RESPONSES[securityCheck.threat] || 
                             SECURITY_DEFENSE.SECURITY_RESPONSES.PROMPT_INJECTION;
      
             // 사용자 메시지 저장 (보안 위협이어도 저장)
       let currentUserId = req.user?.user_id || null; // 인증된 사용자 ID 또는 null (익명)
       
       // 익명 사용자인 경우 IP 기반 익명 사용자 ID 생성 (음수로 변환)
       if (!currentUserId) {
         const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
         const generatedId = generateAnonymousUserId(clientIp);
         currentUserId = -Math.abs(generatedId); // 음수로 변환
         console.log(`🌐 보안 응답 - 익명 사용자 IP 기반 ID 생성: ${clientIp} -> ${generatedId} -> ${currentUserId}`);
       }
       const userMessage = await saveMessage(chatId, 'user', message, null, currentUserId);
      
      // 첫 번째 메시지인 경우 제목 업데이트
      const messageCount = await pool.query(
        'SELECT COUNT(*) as count FROM messages WHERE chat_id = $1',
        [chatId]
      );
      
      if (parseInt(messageCount.rows[0].count) === 1) {
        const title = message.trim().replace(/[^\w\s가-힣]/g, '').trim();
        const finalTitle = title.length > 12 ? `${title.substring(0, 12)  }...` : title;
        
                 await pool.query(
           'UPDATE chat_sessions SET title = $1 WHERE chat_id = $2',
           [finalTitle, chatId]
         );
      }
      
      // 스트리밍 응답 설정
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 보안 응답을 문단별로 스트리밍 (DB 저장 포함)
      for (let i = 0; i < securityResponse.paragraphs.length; i++) {
        const paragraph = securityResponse.paragraphs[i];
        
        // 보안 응답을 DB에 저장 (인증된 사용자 또는 익명 사용자)
        const savedMessage = await saveMessage(chatId, 'model', paragraph.content.trim(), '보안 위협에 대한 안전한 대응', currentUserId);
        
        // 단어 단위 스트리밍 효과
        const words = paragraph.content.trim().split(/\s+/);
        let currentText = '';
        
        for (let j = 0; j < words.length; j++) {
          currentText += (j > 0 ? ' ' : '') + words[j];
          
          res.write(`DATA: ${JSON.stringify({
            type: 'streaming',
            message: {
              ...savedMessage,
              text: currentText,
              isStreaming: true,
              chat_id: chatId // 채팅방 ID 추가
            },
            paragraphIndex: i + 1,
            totalParagraphs: securityResponse.paragraphs.length,
            wordIndex: j + 1,
            totalWords: words.length
          })}\n\n`);
          
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 30));
        }
        
        // 최종 문단 전송
        res.write(`DATA: ${JSON.stringify({
          type: 'paragraph',
          message: {
            ...savedMessage,
            isStreaming: false,
            chat_id: chatId // 채팅방 ID 추가
          },
          paragraphIndex: i + 1,
          totalParagraphs: securityResponse.paragraphs.length
        })}\n\n`);
        
        // 문단 간 지연
        if (i < securityResponse.paragraphs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // 추천 질문 전송 (DB 저장 포함)
      setTimeout(async () => {
        const followUpText = `추천 질문: ${securityResponse.followUpQuestions.join(' | ')}`;
        const savedFollowUpMessage = await saveMessage(chatId, 'model', followUpText, '보안 위협에 대한 안전한 대응', currentUserId);
        
        res.write(`DATA: ${JSON.stringify({
          type: 'followUp',
          message: {
            ...savedFollowUpMessage,
            chat_id: chatId
          }
        })}\n\n`);
        
        res.write(`DATA: ${JSON.stringify({
          type: 'complete'
        })}\n\n`);
        
        // 스트리밍 완료 후 메시지 새로고침을 위한 신호
        res.write(`DATA: ${JSON.stringify({
          type: 'refresh'
        })}\n\n`);
        
                 res.end();
         
         // 🧠 장기 메모리 추출 및 저장 (보안 응답 완료 시)
         // 익명 사용자는 메모리 저장 건너뛰기
         if (currentUserId && currentUserId > 0) {
           try {
             console.log('🧠 Extracting and saving long-term memory (security response)...');
             await memoryService.extractAndSaveMemory(userId, chatId, []);
             console.log('✅ Long-term memory saved successfully');
           } catch (memoryError) {
             console.error('❌ Error saving long-term memory:', memoryError);
           }
         } else {
           console.log('📝 익명 사용자 - 메모리 저장 건너뜀');
         }
       }, 1000);
       
       return;
    }

    // 채팅 세션 가져오기 (인증된 사용자 또는 익명 사용자)
    let currentUserId = req.user?.user_id; // 인증된 사용자 ID
    
    if (!currentUserId) {
      // 익명 사용자인 경우 IP 기반 익명 사용자 ID 생성 (음수로 변환)
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const generatedId = generateAnonymousUserId(clientIp);
      currentUserId = -Math.abs(generatedId); // 음수로 변환
      console.log(`🌐 익명 사용자 IP 기반 ID 생성: ${clientIp} -> ${generatedId} -> ${currentUserId}`);
    }
    
    console.log('🔍 Getting chat with userId:', currentUserId, 'for chatId:', chatId);
    let chat;
    try {
      chat = await getChatById(chatId, currentUserId);
    } catch (e) {
      // 익명 채팅의 경우 채팅이 없으면 자동 생성
      if (chatId.startsWith('temp_') && (!e || !e.message || e.message.includes('not found'))) {
        console.log(`📝 익명 채팅 자동 생성: ${chatId}`);
        try {
          chat = await createNewChat(currentUserId);
          console.log(`✅ 익명 채팅 생성 완료: ${chat.chat_id}`);
        } catch (createError) {
          console.error('❌ 익명 채팅 생성 실패:', createError);
          return res.status(500).json({
            error: {
              code: 'CHAT_CREATION_FAILED',
              message: '익명 채팅 생성에 실패했습니다.',
              details: createError.message
            },
            timestamp: new Date().toISOString()
          });
        }
      } else if (e && e.message && (e.message.includes('not found') || e.message.includes('access denied'))) {
        return res.status(404).json({
          error: {
            code: 'CHAT_NOT_FOUND',
            message: '요청한 대화 세션을 찾을 수 없습니다.',
            details: `chatId: ${chatId}`
          },
          timestamp: new Date().toISOString()
        });
      } else {
        throw e;
      }
    }
    
    if (!chat) {
      return res.status(404).json({
        error: {
          code: 'CHAT_NOT_FOUND',
          message: '요청한 대화 세션을 찾을 수 없습니다.',
          details: `chatId: ${chatId}`
        },
        timestamp: new Date().toISOString()
      });
    }

    // 사용자 메시지 저장 (인증된 사용자 또는 익명 사용자)
    const userMessage = await saveMessage(chatId, 'user', message, null, currentUserId);
    
    // 첫 번째 메시지인 경우 제목 업데이트 (사용자 메시지 저장 후)
    const messageCount = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE chat_id = $1',
      [chatId]
    );
    
    if (parseInt(messageCount.rows[0].count) === 1) {
      const title = message.trim().replace(/[^\w\s가-힣]/g, '').trim();
      const finalTitle = title.length > 12 ? `${title.substring(0, 12)}...` : title;
      
      await pool.query(
        'UPDATE chat_sessions SET title = $1 WHERE chat_id = $2',
        [finalTitle, chatId]
      );
      console.log('✅ 채팅 제목 자동 업데이트:', finalTitle);
    }

    // 스트리밍 응답 설정
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 누적 맥락 조회
    const conversationContexts = await getConversationContext(chatId);
    console.log('🔄 Conversation contexts for chat', chatId, ':', conversationContexts);
    console.log('📊 Total contexts found:', conversationContexts.length);
    
         // 사용자 메모리 조회 (인증된 사용자인 경우)
     let userMemories = [];
     console.log('🔍 User authentication check:', {
       hasUser: !!req.user,
               userId: req.user?.user_id,
       userEmail: req.user?.email
     });
     
         if (req.user && req.user.user_id) {
      try {
        userMemories = await memoryService.getUserMemories(req.user.user_id);
         console.log('🧠 User memories loaded:', userMemories.length, 'memories');
         if (userMemories.length > 0) {
           console.log('📝 Memory preview:', userMemories.slice(0, 2).map(m => `${m.title}: ${m.content.substring(0, 50)}...`));
         }
       } catch (error) {
         console.error('❌ Failed to load user memories:', error);
       }
     } else {
       console.log('⚠️ No authenticated user found, skipping memory loading');
     }
    
         // AI 응답 생성 (문단 단위 JSON 응답)
     try {
       console.log('🤖 AI 응답 생성 시작...');
       
       // 각 단계별 에러 처리
       let chatSession;
       try {
         chatSession = createChatSession(chat.messages || []);
         console.log('✅ createChatSession 성공');
       } catch (error) {
         console.error('❌ createChatSession 실패:', error);
         throw new Error('AI 세션 생성 실패');
       }
       
       // 🚨 실제 메시지 내용을 AI 프롬프트에 포함
       const actualMessages = chat.messages || [];
       const recentMessages = actualMessages.slice(-10); // 최근 10개 메시지만 포함
       
       console.log('📝 AI 프롬프트에 포함될 메시지:', {
         totalMessages: actualMessages.length,
         recentMessages: recentMessages.length,
         messagePreview: recentMessages.map(m => ({ 
           sender: m.sender, 
           text: m.text?.substring(0, 50) 
         }))
       });
       
       let integratedPrompt;
       try {
         integratedPrompt = generatePrompt(message, conversationContexts, userMemories, recentMessages);
         console.log('✅ generatePrompt 성공');
       } catch (error) {
         console.error('❌ generatePrompt 실패:', error);
         throw new Error('프롬프트 생성 실패');
       }
       
       try {
         validatePromptStructure(integratedPrompt);
         console.log('✅ validatePromptStructure 성공');
       } catch (error) {
         console.error('❌ validatePromptStructure 실패:', error);
         throw new Error('프롬프트 검증 실패');
       }
       
      // AI로부터 전체 JSON 응답 받기 (스트리밍 없이)
      console.log('📤 AI에 메시지 전송 중...');
      
      let result;
      
      // 정상적인 AI 응답 생성
      result = await chatSession.sendMessage(integratedPrompt);
      console.log('📥 AI 응답 수신 완료');
      let fullResponse = result.response.text();
      let retryCount = 0;
      const maxRetries = 3;
      let parsedResponse = null;
      
      console.log('📥 Received full response from AI, length:', fullResponse.length);
      
      // JSON 형식 응답을 받을 때까지 재시도
      while (retryCount < maxRetries) {
        console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} to parse JSON response...`);
        
        try {
          // JSON 코드 블록에서 추출
          const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[1]);
            console.log('✅ Successfully parsed JSON from code block');
            console.log('📋 Parsed JSON structure:', JSON.stringify(parsedResponse, null, 2));
            break;
          } else {
            // 직접 JSON 파싱 시도
            const cleanResponse = fullResponse.trim();
            if (cleanResponse.endsWith('...') || cleanResponse.length < 100) {
              console.log('⚠️ Response appears to be truncated, retrying...');
              retryCount++;
                             if (retryCount < maxRetries) {
                 result = await chatSession.sendMessage(`다시 한 번 JSON 형식으로만 응답해주세요: ${message}`);
                fullResponse = result.response.text();
                continue;
              }
            } else {
              parsedResponse = JSON.parse(cleanResponse);
              console.log('✅ Successfully parsed JSON directly');
              console.log('📋 Parsed JSON structure:', JSON.stringify(parsedResponse, null, 2));
              break;
            }
          }
        } catch (parseError) {
          console.log(`❌ Failed to parse JSON (attempt ${retryCount + 1}):`, parseError.message);
          console.log('🔍 Full response preview:', fullResponse.substring(0, 500));
          
          retryCount++;
          if (retryCount < maxRetries) {
                         console.log(`🔄 Retrying with stronger JSON enforcement...`);
             result = await chatSession.sendMessage(`JSON 형식으로만 응답하세요. 일반 텍스트는 절대 사용하지 마세요: ${message}`);
            fullResponse = result.response.text();
            continue;
          } else {
            console.log('📄 Complete response for debugging:');
            console.log('='.repeat(80));
            console.log(fullResponse);
            console.log('='.repeat(80));
            parsedResponse = null;
          }
        }
      }
      
      // JSON 응답 처리 및 문단 단위 순차 전송
      console.log('📝 Processing JSON response for paragraph streaming...');
      
      let followUpQuestions = [];
      
      if (parsedResponse) {
        // 새로운 paragraphs 구조 처리
        if (parsedResponse.paragraphs && Array.isArray(parsedResponse.paragraphs)) {
          console.log('✅ Processing paragraphs structure...');
          
          // context 정보 저장
          if (parsedResponse.context) {
            console.log('Context:', parsedResponse.context);
            await saveContext(chatId, parsedResponse.context);
          }
          
          // 각 문단을 순차적으로 프론트로 전송 (스트리밍 효과)
          for (let i = 0; i < parsedResponse.paragraphs.length; i++) {
            const paragraph = parsedResponse.paragraphs[i];
            
            console.log(`📤 Sending paragraph ${i + 1}/${parsedResponse.paragraphs.length}:`, `${paragraph.content.substring(0, 50)  }...`);
            
                         // 문단을 DB에 저장
             const savedMessage = await saveMessage(chatId, 'model', paragraph.content.trim(), parsedResponse.context, currentUserId);
            
            // 단어 단위 스트리밍 효과 구현
            const words = paragraph.content.trim().split(/\s+/);
            let currentText = '';
            
            for (let j = 0; j < words.length; j++) {
              currentText += (j > 0 ? ' ' : '') + words[j];
              
              // 프론트로 단어 단위 전송
              res.write(`DATA: ${JSON.stringify({
                type: 'streaming',
                message: {
                  ...savedMessage,
                  text: currentText,
                  isStreaming: true,
                  chat_id: chatId // 채팅방 ID 추가
                },
                paragraphIndex: i + 1,
                totalParagraphs: parsedResponse.paragraphs.length,
                wordIndex: j + 1,
                totalWords: words.length
              })}\n\n`);
              
              // 단어 간 지연 (타이핑 효과)
              await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 30));
            }
            
            // 최종 문단 전송 (스트리밍 완료)
            res.write(`DATA: ${JSON.stringify({
              type: 'paragraph',
              message: {
                ...savedMessage,
                isStreaming: false,
                chat_id: chatId // 채팅방 ID 추가
              },
              paragraphIndex: i + 1,
              totalParagraphs: parsedResponse.paragraphs.length
            })}\n\n`);
            
            // 문단 간 지연
            if (i < parsedResponse.paragraphs.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // 추천 질문 설정
          if (parsedResponse.followUpQuestions && parsedResponse.followUpQuestions.length > 0) {
            followUpQuestions = parsedResponse.followUpQuestions;
          }
                 }
         // 잘못된 구조 감지 및 오류 처리
         else {
           console.log('❌ Invalid JSON structure detected. Expected "paragraphs" but got:', Object.keys(parsedResponse));
           console.log('📄 Full response for debugging:');
           console.log('='.repeat(80));
           console.log(fullResponse);
           console.log('='.repeat(80));
           
           // 잘못된 구조에 대한 오류 메시지 전송
           const errorMessage = await saveMessage(chatId, 'model', '죄송합니다. 응답 형식에 문제가 발생했습니다. 다시 시도해주세요.', null, currentUserId);
           res.write(`DATA: ${JSON.stringify({
             type: 'error',
             message: errorMessage
           })}\n\n`);
           
           followUpQuestions = [
             '다시 질문해보시겠어요?',
             '다른 주제로 대화해보시겠어요?',
             '도움이 필요하시면 언제든 말씀해 주세요.'
           ];
         }
      } else {
        // JSON 파싱 실패 시 fallback 처리
        console.log('Processing text response (fallback)...');
        
        const contextChunks = splitByContext(fullResponse);
        console.log(`Split into ${contextChunks.length} context chunks`);
        
        for (let i = 0; i < contextChunks.length; i++) {
          const chunk = contextChunks[i];
          if (chunk.trim()) {
            const savedMessage = await saveMessage(chatId, 'model', chunk.trim(), null, currentUserId);
            
            res.write(`DATA: ${JSON.stringify({
              type: 'paragraph',
              message: savedMessage,
              paragraphIndex: i + 1,
              totalParagraphs: contextChunks.length
            })}\n\n`);
            
            if (i < contextChunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          }
        }
        
        followUpQuestions = [
          '이 주제에 대해 더 자세히 알고 싶으신가요?',
          '다른 관점에서도 살펴보시겠어요?',
          '실제 사례나 예시를 들어 설명해드릴까요?'
        ];
      }
      
      // 스트리밍 완료
      res.write(`DATA: ${JSON.stringify({
        type: 'complete',
        followUpQuestions
      })}\n\n`);
      
      console.log('✅ Streaming completed, all paragraphs sent');
      
      // 답변 완료 후 1초 지연 후 추천 질문 표시
      if (followUpQuestions.length > 0) {
        console.log('⏰ Waiting 1 second before showing follow-up questions...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const followUpMessage = `추천 질문: ${followUpQuestions.join(' | ')}`;
        const savedMessage = await saveMessage(chatId, 'model', followUpMessage, null, currentUserId);
        res.write(`DATA: ${JSON.stringify({
          type: 'followUp',
          message: {
            ...savedMessage,
            chat_id: chatId // 채팅방 ID 추가
          },
          paragraphIndex: 'followUp', // followUp 타입을 위한 고유 식별자
          totalParagraphs: 1
        })}\n\n`);
        
        console.log('✅ Follow-up questions sent after 1 second delay');
      }
      
      // 스트리밍 완료 후 메시지 새로고침을 위한 신호
      res.write(`DATA: ${JSON.stringify({
        type: 'refresh'
      })}\n\n`);
      
                   // 🧠 장기 메모리 추출 및 저장 (적절한 시점에만)
      // 익명 사용자는 메모리 저장 건너뛰기
      if (currentUserId && currentUserId > 0) {
        try {
          // 메모리 저장 조건 확인
          const shouldSaveMemory = await shouldSaveLongTermMemory(chatId, conversationContexts);
          
          if (shouldSaveMemory) {
            console.log('🧠 Extracting and saving long-term memory...');
            await memoryService.extractAndSaveMemory(userId, chatId, conversationContexts);
            console.log('✅ Long-term memory saved successfully');
          } else {
            console.log('📝 메모리 저장 조건 미충족 - 건너뜀');
          }
        } catch (memoryError) {
          console.error('❌ Error saving long-term memory:', memoryError);
          // 메모리 저장 실패는 전체 응답에 영향을 주지 않도록 함
        }
      } else {
        console.log('📝 익명 사용자 - 메모리 저장 건너뜀');
      }
      
    } catch (error) {
       console.error('❌ AI 응답 생성 중 오류 발생:', error);
       
       // 에러 메시지 저장
       const errorMessage = await saveMessage(chatId, 'model', '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', null, currentUserId);
       res.write(`DATA: ${JSON.stringify({
         type: 'error',
         message: errorMessage
       })}\n\n`);
     }
    
    res.end();

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      error: {
        code: 'PROCESSING_ERROR',
        message: '메시지 처리 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chats/cleanup - 기존 채팅 정리 (개발용)
router.post('/cleanup', async (req, res) => {
  try {
    // 기존 채팅 세션과 메시지 삭제
    await pool.query("DELETE FROM messages WHERE chat_id LIKE 'chat-%'");
    await pool.query("DELETE FROM chat_sessions WHERE chat_id LIKE 'chat-%'");
    
    res.json({
      success: true,
      message: '기존 채팅이 정리되었습니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up chats:', error);
    res.status(500).json({
      error: {
        code: 'CLEANUP_ERROR',
        message: '채팅 정리 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chats/cleanup-temp - temp_ 채팅들 정리 (개발용)
router.post('/cleanup-temp', async (req, res) => {
  try {
    console.log('🧹 temp_ 채팅들 정리 시작...');
    
    // temp_로 시작하는 채팅들의 메시지 먼저 삭제
    const deleteMessagesResult = await pool.query(
      "DELETE FROM messages WHERE chat_id LIKE 'temp_%'"
    );
    console.log(`✅ temp_ 메시지 ${deleteMessagesResult.rowCount}개 삭제 완료`);
    
    // temp_로 시작하는 채팅 세션 삭제
    const deleteChatsResult = await pool.query(
      "DELETE FROM chat_sessions WHERE chat_id LIKE 'temp_%'"
    );
    console.log(`✅ temp_ 채팅 세션 ${deleteChatsResult.rowCount}개 삭제 완료`);
    
    res.json({
      success: true,
      message: 'temp_ 채팅들이 성공적으로 정리되었습니다.',
      deletedMessages: deleteMessagesResult.rowCount,
      deletedChats: deleteChatsResult.rowCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ temp_ 채팅 정리 중 오류:', error);
    res.status(500).json({
      error: {
        code: 'CLEANUP_ERROR',
        message: 'temp_ 채팅 정리 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chats/migrate-anonymous - 익명 채팅을 로그인 사용자로 마이그레이션
router.post('/migrate-anonymous', authenticateToken, async (req, res) => {
  try {
    const { anonymousChats } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '로그인이 필요합니다.',
          details: '익명 채팅을 마이그레이션하려면 로그인이 필요합니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 1. 현재 사용자의 기존 채팅 목록 조회 (중복 방지용)
    console.log(`🔍 현재 사용자 기존 채팅 확인 - userId: ${userId}`);
    const existingUserChatsQuery = `
      SELECT chat_id FROM chat_sessions WHERE user_id = $1
    `;
    const existingUserChats = await pool.query(existingUserChatsQuery, [userId]);
    const existingChatIds = new Set(existingUserChats.rows.map(row => row.chat_id));
    console.log(`📋 현재 사용자 기존 채팅 ${existingChatIds.size}개 확인 완료`);

    if (!anonymousChats || !Array.isArray(anonymousChats)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATA',
          message: '유효하지 않은 익명 채팅 데이터입니다.',
          details: 'anonymousChats는 배열이어야 합니다.'
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔄 익명 채팅 마이그레이션 시작 - userId: ${userId}, 채팅 수: ${anonymousChats.length}`);

    const migratedChats = [];

    for (const anonymousChat of anonymousChats) {
      try {
        // 1. 현재 사용자의 기존 채팅에 이미 존재하는지 확인
        const candidateChatId = anonymousChat.chat_id || anonymousChat.chatId;
        if (existingChatIds.has(candidateChatId)) {
                      console.log(`⚠️ 현재 사용자 채팅에 이미 존재함: ${anonymousChat.chat_id} - 건너뜀`);
          continue;
        }
        
        // 2. 전체 데이터베이스에서 해당 채팅이 이미 존재하는지 확인
        const existingChatQuery = `
          SELECT chat_id, user_id FROM chat_sessions WHERE chat_id = $1
        `;
                  const existingChat = await pool.query(existingChatQuery, [anonymousChat.chat_id]);
        
        if (existingChat.rows.length > 0) {
          const existingChatData = existingChat.rows[0];
          if (existingChatData.user_id && existingChatData.user_id !== userId) {
            console.log(`⚠️ 다른 사용자의 채팅임: ${anonymousChat.chat_id} (user_id: ${existingChatData.user_id}) - 건너뜀`);
            continue;
          }
                      console.log(`⚠️ 채팅이 이미 존재함: ${anonymousChat.chat_id} - 건너뜀`);
          continue;
        }

        // 2. 새로운 채팅 세션 생성 (user_id 포함)
        const newChatQuery = `
          INSERT INTO chat_sessions (chat_id, user_id, title, created_at, updated_at, context)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        
        const newChatResult = await pool.query(newChatQuery, [
          candidateChatId,
          userId,
          anonymousChat.title,
          anonymousChat.created_at,
          anonymousChat.updated_at,
          anonymousChat.context || null
        ]);

        const newChat = newChatResult.rows[0];

        // 3. 메시지들 마이그레이션
        if (anonymousChat.messages && Array.isArray(anonymousChat.messages)) {
          for (const message of anonymousChat.messages) {
            // 기존 메시지가 이미 존재하는지 확인 (chat_id와 text로 중복 체크)
            const existingMessageQuery = `
              SELECT message_id FROM messages WHERE chat_id = $1 AND text = $2 AND sender = $3
            `;
            const existingMessage = await pool.query(existingMessageQuery, [newChat.chat_id, message.text, message.sender]);
            
            if (existingMessage.rows.length > 0) {
              console.log(`⚠️ 메시지가 이미 존재함: ${message.text.substring(0, 30)}... - 건너뜀`);
              continue;
            }

            const messageQuery = `
              INSERT INTO messages (chat_id, user_id, sender, text, timestamp, context)
              VALUES ($1, $2, $3, $4, $5, $6)
            `;
            
            await pool.query(messageQuery, [
              newChat.chat_id,
              userId, // 익명 메시지도 로그인 사용자로 변경
              message.sender,
              message.text,
              message.timestamp,
              message.context || null
            ]);
          }
        }

        migratedChats.push(newChat);
        console.log(`✅ 채팅 마이그레이션 완료: ${newChat.chat_id}`);

      } catch (chatError) {
                    console.error(`❌ 채팅 마이그레이션 실패: ${anonymousChat.chat_id}`, chatError);
        // 개별 채팅 실패는 전체 마이그레이션을 중단하지 않음
      }
    }

    console.log(`🎉 익명 채팅 마이그레이션 완료 - 성공: ${migratedChats.length}/${anonymousChats.length}`);

    res.json({
      success: true,
      message: '익명 채팅이 성공적으로 마이그레이션되었습니다.',
      migratedCount: migratedChats.length,
      totalCount: anonymousChats.length,
      migratedChats
    });

  } catch (error) {
    console.error('Error migrating anonymous chats:', error);
    res.status(500).json({
      error: {
        code: 'MIGRATION_ERROR',
        message: '익명 채팅 마이그레이션 중 오류가 발생했습니다.',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
