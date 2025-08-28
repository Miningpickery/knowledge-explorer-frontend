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
  initializeDatabase 
} = require('../services/chatHistoryService');
const { createChatSession } = require('../services/geminiService');
const { generatePrompt, validatePromptStructure, SECURITY_DEFENSE } = require('../prompts/chatPrompt');
const securityService = require('../services/securityService');
const { optionalAuth } = require('../middleware/auth');
const memoryService = require('../services/memoryService');

// 메모리 저장 조건 확인 함수
async function shouldSaveLongTermMemory(chatId, conversationContexts) {
  try {
    // 1. 대화 길이 확인 (최소 4번의 교환)
    const messages = await getMessagesByChatId(chatId);
    const messageCount = messages.length;
    
    if (messageCount < 8) { // 사용자 4개 + AI 4개 = 최소 8개
      console.log(`📝 대화가 너무 짧음 (${messageCount}개 메시지) - 메모리 저장 건너뜀`);
      return false;
    }
    
    // 2. 최근 메모리 저장 시간 확인 (같은 채팅에서 10분 이내 중복 방지)
    const recentMemories = await memoryService.getUserMemories(messages[0]?.user_id || 1, 5);
    const now = new Date();
    
    for (const memory of recentMemories) {
      if (memory.chat_id === chatId) {
        const memoryTime = new Date(memory.created_at);
        const timeDiff = (now - memoryTime) / (1000 * 60); // 분 단위
        
        if (timeDiff < 10) {
          console.log(`📝 최근 메모리 저장됨 (${timeDiff.toFixed(1)}분 전) - 중복 방지`);
          return false;
        }
      }
    }
    
    // 3. 대화 내용의 중요도 확인
    const hasImportantContent = conversationContexts.some(context => {
      if (!context) return false;
      const importantKeywords = ['중요', '핵심', '주요', '전략', '방안', '해결', '분석', '전망'];
      return importantKeywords.some(keyword => context.includes(keyword));
    });
    
    if (!hasImportantContent && messageCount < 12) {
      console.log(`📝 중요 내용 부족 - 메모리 저장 건너뜀`);
      return false;
    }
    
    // 4. 대화 종결성 확인 (마지막 메시지가 감사나 확인 표현인지)
    const lastMessage = messages[messages.length - 1];
    const closingExpressions = ['고맙습니다', '감사합니다', '알겠습니다', '네', '좋아요', '정말 유용해요'];
    const isClosing = closingExpressions.some(expr => 
      lastMessage?.text?.includes(expr)
    );
    
    if (!isClosing && messageCount < 15) {
      console.log(`📝 대화가 아직 진행 중 - 메모리 저장 건너뜀`);
      return false;
    }
    
    console.log(`✅ 메모리 저장 조건 충족 (${messageCount}개 메시지, 중요도: ${hasImportantContent})`);
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

// GET /api/chats - 모든 대화 목록 조회 (인증된 사용자 또는 기본 사용자)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || 3; // 안전한 기본값 처리
    console.log(`📋 채팅 목록 조회 - userId: ${userId}`);
    const chats = await getAllChats(userId);
    console.log(`✅ ${chats.length}개의 채팅 발견`);
    res.json(chats);
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

// POST /api/chats - 새 대화 생성 (인증된 사용자 또는 기본 사용자)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || 3; // 안전한 기본값 처리
    console.log(`📝 새 채팅 생성 - userId: ${userId}`);
    const newChat = await createNewChat(userId);
    console.log(`✅ 채팅 생성 완료 - chatId: ${newChat.id}`);
    res.status(201).json(newChat);
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

// GET /api/chats/:chatId - 특정 대화 조회 (인증된 사용자 또는 기본 사용자)
router.get('/:chatId', optionalAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.userId || 1; // 기본 사용자 ID 사용
    console.log(`🔍 Getting chat with userId: ${userId} for chatId: ${chatId}`);
    const chat = await getChatById(chatId, userId);
    res.json(chat);
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

// PUT /api/chats/:chatId - 대화 수정
router.put('/:chatId', async (req, res) => {
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
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    await deleteChat(chatId);
    res.status(204).send();
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
    const userId = req.user?.userId || 1; // 기본 사용자 ID 사용

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
        chatId: chatId
      });
      
      // 보안 응답 반환
      const securityResponse = SECURITY_DEFENSE.SECURITY_RESPONSES[securityCheck.threat] || 
                             SECURITY_DEFENSE.SECURITY_RESPONSES.PROMPT_INJECTION;
      
      // 사용자 메시지 저장 (보안 위협이어도 저장)
      const userMessage = await saveMessage(chatId, 'user', message, null);
      
      // 첫 번째 메시지인 경우 제목 업데이트
      const messageCount = await pool.query(
        'SELECT COUNT(*) as count FROM messages WHERE chat_id = $1',
        [chatId]
      );
      
      if (parseInt(messageCount.rows[0].count) === 1) {
        const title = message.trim().replace(/[^\w\s가-힣]/g, '').trim();
        const finalTitle = title.length > 12 ? title.substring(0, 12) + '...' : title;
        
        await pool.query(
          'UPDATE chat_sessions SET title = $1 WHERE id = $2',
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
        
        // 보안 응답을 DB에 저장
        const savedMessage = await saveMessage(chatId, 'model', paragraph.content.trim(), '보안 위협에 대한 안전한 대응');
        
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
              isStreaming: true
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
            isStreaming: false
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
        const savedFollowUpMessage = await saveMessage(chatId, 'model', followUpText, '보안 위협에 대한 안전한 대응');
        
        res.write(`DATA: ${JSON.stringify({
          type: 'followUp',
          message: savedFollowUpMessage
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
         try {
           console.log('🧠 Extracting and saving long-term memory (security response)...');
           await memoryService.extractAndSaveMemory(userId, chatId, []);
           console.log('✅ Long-term memory saved successfully');
         } catch (memoryError) {
           console.error('❌ Error saving long-term memory:', memoryError);
         }
       }, 1000);
       
       return;
    }

    // 채팅 세션 가져오기 (실제 사용자 ID 사용)
    const currentUserId = req.user?.userId || 3; // 인증된 사용자 ID 또는 기본값
    console.log('🔍 Getting chat with userId:', currentUserId, 'for chatId:', chatId);
    const chat = await getChatById(chatId, currentUserId);
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

    // 사용자 메시지 저장
    const userMessage = await saveMessage(chatId, 'user', message, null);
    
    // 첫 번째 메시지인 경우 제목 업데이트
    const messageCount = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE chat_id = $1',
      [chatId]
    );
    
    if (parseInt(messageCount.rows[0].count) === 1) {
      const title = message.trim().replace(/[^\w\s가-힣]/g, '').trim();
      const finalTitle = title.length > 12 ? title.substring(0, 12) + '...' : title;
      
      await pool.query(
        'UPDATE chat_sessions SET title = $1 WHERE id = $2',
        [finalTitle, chatId]
      );
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
       userId: req.user?.userId,
       userEmail: req.user?.email
     });
     
     if (req.user && req.user.userId) {
       try {
         userMemories = await memoryService.getUserMemories(req.user.userId);
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
     const chatSession = createChatSession(chat.messages || []);
     
     try {
       // 통합된 프롬프트 생성 (사용자 메모리 포함)
       const integratedPrompt = generatePrompt(message, conversationContexts, userMemories);
       
       // 프롬프트 구조 검증
       validatePromptStructure(integratedPrompt);
       
       // AI로부터 전체 JSON 응답 받기 (스트리밍 없이)
       let result = await chatSession.sendMessage(integratedPrompt);
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
            
            console.log(`📤 Sending paragraph ${i + 1}/${parsedResponse.paragraphs.length}:`, paragraph.content.substring(0, 50) + '...');
            
                         // 문단을 DB에 저장
             const savedMessage = await saveMessage(chatId, 'model', paragraph.content.trim(), parsedResponse.context);
            
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
                  isStreaming: true
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
                isStreaming: false
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
           const errorMessage = await saveMessage(chatId, 'model', '죄송합니다. 응답 형식에 문제가 발생했습니다. 다시 시도해주세요.');
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
            const savedMessage = await saveMessage(chatId, 'model', chunk.trim());
            
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
        followUpQuestions: followUpQuestions
      })}\n\n`);
      
      console.log('✅ Streaming completed, all paragraphs sent');
      
      // 답변 완료 후 1초 지연 후 추천 질문 표시
      if (followUpQuestions.length > 0) {
        console.log('⏰ Waiting 1 second before showing follow-up questions...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const followUpMessage = `추천 질문: ${followUpQuestions.join(' | ')}`;
        const savedMessage = await saveMessage(chatId, 'model', followUpMessage);
        res.write(`DATA: ${JSON.stringify({
          type: 'followUp',
          message: savedMessage
        })}\n\n`);
        
        console.log('✅ Follow-up questions sent after 1 second delay');
      }
      
      // 스트리밍 완료 후 메시지 새로고침을 위한 신호
      res.write(`DATA: ${JSON.stringify({
        type: 'refresh'
      })}\n\n`);
      
                   // 🧠 장기 메모리 추출 및 저장 (적절한 시점에만)
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
      
         } catch (error) {
       console.error('Error in streaming response:', error);
       
       const errorMessage = await saveMessage(chatId, 'model', '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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

module.exports = router;
