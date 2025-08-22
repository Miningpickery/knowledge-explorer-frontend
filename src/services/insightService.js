const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 대화 요약 생성
const generateConversationSummary = async (chatId) => {
  try {
    const query = `
      SELECT 
        cs.title,
        cs.created_at,
        cs.updated_at,
        COUNT(m.id) as message_count,
        COUNT(CASE WHEN m.sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.sender = 'model' THEN 1 END) as ai_messages,
        AVG(LENGTH(m.text)) as avg_message_length,
        STRING_AGG(DISTINCT m.text, ' ' ORDER BY m.timestamp) as conversation_text
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.id = $1
      GROUP BY cs.id, cs.title, cs.created_at, cs.updated_at
    `;
    
    const result = await pool.query(query, [chatId]);
    const chat = result.rows[0];
    
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    // 간단한 요약 생성 (실제로는 AI 모델을 사용해야 함)
    const summary = {
      chatId,
      title: chat.title,
      duration: new Date(chat.updated_at) - new Date(chat.created_at),
      messageCount: chat.message_count,
      userMessageCount: chat.user_messages,
      aiMessageCount: chat.ai_messages,
      avgMessageLength: Math.round(chat.avg_message_length || 0),
      keyTopics: extractKeyTopics(chat.conversation_text),
      sentiment: analyzeSentiment(chat.conversation_text),
      createdAt: chat.created_at,
      updatedAt: chat.updated_at
    };
    
    return summary;
  } catch (error) {
    console.error("Failed to generate conversation summary:", error);
    throw error;
  }
};

// 고객 만족도 분석
const analyzeCustomerSatisfaction = async (chatId) => {
  try {
    const query = `
      SELECT 
        AVG(f.rating) as avg_rating,
        COUNT(f.id) as feedback_count,
        COUNT(CASE WHEN f.rating >= 4 THEN 1 END) as positive_count,
        COUNT(CASE WHEN f.rating <= 2 THEN 1 END) as negative_count,
        STRING_AGG(f.feedback_text, '; ') as feedback_texts
      FROM feedback f
      WHERE f.chat_id = $1
    `;
    
    const result = await pool.query(query, [chatId]);
    const feedback = result.rows[0];
    
    return {
      chatId,
      avgRating: feedback.avg_rating || 0,
      feedbackCount: feedback.feedback_count || 0,
      satisfactionScore: feedback.feedback_count > 0 ? 
        (feedback.positive_count / feedback.feedback_count) * 100 : 0,
      sentiment: analyzeFeedbackSentiment(feedback.feedback_texts || ''),
      hasFeedback: feedback.feedback_count > 0
    };
  } catch (error) {
    console.error("Failed to analyze customer satisfaction:", error);
    throw error;
  }
};

// 고객 행동 패턴 분석
const analyzeCustomerBehavior = async (userId = null) => {
  try {
    let query = `
      SELECT 
        cs.id,
        cs.title,
        cs.created_at,
        cs.updated_at,
        COUNT(m.id) as message_count,
        AVG(LENGTH(m.text)) as avg_message_length,
        COUNT(CASE WHEN m.sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.sender = 'model' THEN 1 END) as ai_messages
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
    `;
    
    const params = [];
    if (userId) {
      query += ' WHERE cs.user_id = $1';
      params.push(userId);
    }
    
    query += `
      GROUP BY cs.id, cs.title, cs.created_at, cs.updated_at
      ORDER BY cs.updated_at DESC
    `;
    
    const result = await pool.query(query, params);
    
    const behavior = {
      totalChats: result.rows.length,
      totalMessages: result.rows.reduce((sum, row) => sum + parseInt(row.message_count), 0),
      avgMessagesPerChat: result.rows.length > 0 ? 
        result.rows.reduce((sum, row) => sum + parseInt(row.message_count), 0) / result.rows.length : 0,
      avgMessageLength: result.rows.length > 0 ? 
        result.rows.reduce((sum, row) => sum + parseFloat(row.avg_message_length || 0), 0) / result.rows.length : 0,
      activeHours: analyzeActiveHours(result.rows),
      chatFrequency: analyzeChatFrequency(result.rows),
      engagementLevel: calculateEngagementLevel(result.rows)
    };
    
    return behavior;
  } catch (error) {
    console.error("Failed to analyze customer behavior:", error);
    throw error;
  }
};

// 고객 이슈 트렌드 분석
const analyzeIssueTrends = async (days = 30) => {
  try {
    const query = `
      SELECT 
        DATE(ci.created_at) as date,
        ci.issue_type,
        ci.priority,
        COUNT(*) as issue_count
      FROM customer_issues ci
      WHERE ci.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(ci.created_at), ci.issue_type, ci.priority
      ORDER BY date DESC, issue_count DESC
    `;
    
    const result = await pool.query(query);
    
    const trends = {
      totalIssues: result.rows.reduce((sum, row) => sum + parseInt(row.issue_count), 0),
      issueTypes: {},
      priorityDistribution: {},
      dailyTrend: {}
    };
    
    result.rows.forEach(row => {
      // 이슈 타입별 분포
      if (!trends.issueTypes[row.issue_type]) {
        trends.issueTypes[row.issue_type] = 0;
      }
      trends.issueTypes[row.issue_type] += parseInt(row.issue_count);
      
      // 우선순위별 분포
      if (!trends.priorityDistribution[row.priority]) {
        trends.priorityDistribution[row.priority] = 0;
      }
      trends.priorityDistribution[row.priority] += parseInt(row.issue_count);
      
      // 일별 트렌드
      if (!trends.dailyTrend[row.date]) {
        trends.dailyTrend[row.date] = 0;
      }
      trends.dailyTrend[row.date] += parseInt(row.issue_count);
    });
    
    return trends;
  } catch (error) {
    console.error("Failed to analyze issue trends:", error);
    throw error;
  }
};

// 헬퍼 함수들
const extractKeyTopics = (text) => {
  if (!text) return [];
  // 간단한 키워드 추출 (실제로는 NLP 라이브러리 사용)
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const keywords = words.filter(word => 
    word.length > 3 && !stopWords.includes(word)
  );
  
  const wordCount = {};
  keywords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
};

const analyzeSentiment = (text) => {
  if (!text) return 'neutral';
  // 간단한 감정 분석 (실제로는 감정 분석 모델 사용)
  const positiveWords = ['good', 'great', 'excellent', 'happy', 'satisfied', 'helpful'];
  const negativeWords = ['bad', 'terrible', 'unhappy', 'dissatisfied', 'unhelpful', 'wrong'];
  
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
};

const analyzeFeedbackSentiment = (feedbackTexts) => {
  return analyzeSentiment(feedbackTexts);
};

const analyzeActiveHours = (chats) => {
  const hourCount = {};
  chats.forEach(chat => {
    const hour = new Date(chat.created_at).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  });
  
  return Object.entries(hourCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
};

const analyzeChatFrequency = (chats) => {
  if (chats.length < 2) return 'low';
  
  const timeSpan = new Date(chats[0].updated_at) - new Date(chats[chats.length - 1].created_at);
  const days = timeSpan / (1000 * 60 * 60 * 24);
  const chatsPerDay = chats.length / days;
  
  if (chatsPerDay > 2) return 'high';
  if (chatsPerDay > 0.5) return 'medium';
  return 'low';
};

const calculateEngagementLevel = (chats) => {
  if (chats.length === 0) return 'none';
  
  const avgMessages = chats.reduce((sum, chat) => sum + parseInt(chat.message_count), 0) / chats.length;
  const avgLength = chats.reduce((sum, chat) => sum + parseFloat(chat.avg_message_length || 0), 0) / chats.length;
  
  if (avgMessages > 10 && avgLength > 50) return 'high';
  if (avgMessages > 5 && avgLength > 30) return 'medium';
  return 'low';
};

module.exports = {
  generateConversationSummary,
  analyzeCustomerSatisfaction,
  analyzeCustomerBehavior,
  analyzeIssueTrends
};
