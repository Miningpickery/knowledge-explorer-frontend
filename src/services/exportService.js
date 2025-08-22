const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 채팅을 JSON 형태로 내보내기
const exportChatAsJSON = async (chatId) => {
  try {
    const query = `
      SELECT 
        cs.id,
        cs.title,
        cs.created_at,
        cs.updated_at,
        json_agg(
          json_build_object(
            'id', m.id,
            'text', m.text,
            'sender', m.sender,
            'timestamp', m.timestamp,
            'sources', m.sources,
            'follow_up_questions', m.follow_up_questions
          ) ORDER BY m.timestamp
        ) as messages
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.id = $1
      GROUP BY cs.id, cs.title, cs.created_at, cs.updated_at
    `;
    
    const result = await pool.query(query, [chatId]);
    
    if (result.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error("Failed to export chat as JSON:", error);
    throw error;
  }
};

// 채팅을 텍스트 형태로 내보내기
const exportChatAsText = async (chatId) => {
  try {
    const query = `
      SELECT 
        cs.title,
        cs.created_at,
        m.text,
        m.sender,
        m.timestamp
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.id = $1
      ORDER BY m.timestamp
    `;
    
    const result = await pool.query(query, [chatId]);
    
    if (result.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    const chat = result.rows[0];
    let text = `대화 제목: ${chat.title}\n`;
    text += `생성일: ${new Date(chat.created_at).toLocaleString('ko-KR')}\n`;
    text += `\n${'='.repeat(50)}\n\n`;
    
    result.rows.forEach((row, index) => {
      if (row.text) {
        const sender = row.sender === 'user' ? '사용자' : 'AI';
        const time = new Date(row.timestamp).toLocaleString('ko-KR');
        text += `[${time}] ${sender}:\n${row.text}\n\n`;
      }
    });
    
    return text;
  } catch (error) {
    console.error("Failed to export chat as text:", error);
    throw error;
  }
};

// 채팅을 마크다운 형태로 내보내기
const exportChatAsMarkdown = async (chatId) => {
  try {
    const query = `
      SELECT 
        cs.title,
        cs.created_at,
        m.text,
        m.sender,
        m.timestamp
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      WHERE cs.id = $1
      ORDER BY m.timestamp
    `;
    
    const result = await pool.query(query, [chatId]);
    
    if (result.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    const chat = result.rows[0];
    let markdown = `# ${chat.title}\n\n`;
    markdown += `**생성일:** ${new Date(chat.created_at).toLocaleString('ko-KR')}\n\n`;
    markdown += `---\n\n`;
    
    result.rows.forEach((row, index) => {
      if (row.text) {
        const sender = row.sender === 'user' ? '👤 사용자' : '🤖 AI';
        const time = new Date(row.timestamp).toLocaleString('ko-KR');
        markdown += `### ${sender} (${time})\n\n`;
        markdown += `${row.text}\n\n`;
        markdown += `---\n\n`;
      }
    });
    
    return markdown;
  } catch (error) {
    console.error("Failed to export chat as markdown:", error);
    throw error;
  }
};

// 모든 채팅을 JSON 형태로 내보내기
const exportAllChatsAsJSON = async () => {
  try {
    const query = `
      SELECT 
        cs.id,
        cs.title,
        cs.created_at,
        cs.updated_at,
        json_agg(
          json_build_object(
            'id', m.id,
            'text', m.text,
            'sender', m.sender,
            'timestamp', m.timestamp,
            'sources', m.sources,
            'follow_up_questions', m.follow_up_questions
          ) ORDER BY m.timestamp
        ) as messages
      FROM chat_sessions cs
      LEFT JOIN messages m ON cs.id = m.chat_id
      GROUP BY cs.id, cs.title, cs.created_at, cs.updated_at
      ORDER BY cs.updated_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Failed to export all chats as JSON:", error);
    throw error;
  }
};

module.exports = {
  exportChatAsJSON,
  exportChatAsText,
  exportChatAsMarkdown,
  exportAllChatsAsJSON
};
