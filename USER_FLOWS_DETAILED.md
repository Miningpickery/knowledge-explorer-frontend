# 🎯 Knowledge Explorer - 상세 사용자 플로우 가이드

이 문서는 실제 구현된 코드를 바탕으로 **고객 플로우**와 **관리자 플로우**를 상세히 설명합니다.

---

## 👥 **고객 플로우 (Customer Journey)**

### 🚀 **1단계: 초기 접속 및 화면 로딩**

#### **접속 URL**
```
http://localhost:8000/
```

#### **프론트엔드 처리 과정**
1. **`index.html`** → React 앱 마운트
2. **`index.tsx`** → 라우터 설정 확인
   ```typescript
   // 📁 index.tsx
   <Router>
     <Routes>
       <Route path="/auth/callback" element={<AuthCallback />} />
       <Route path="/*" element={<App />} />
     </Routes>
   </Router>
   ```
3. **`App.tsx`** → 메인 애플리케이션 컴포넌트 실행

#### **백엔드 초기화**
1. **`src/index.js`** → Express 서버 시작 (포트 3001)
2. **모니터링 시스템** 자동 초기화
   ```javascript
   // 📊 모니터링 시스템 초기화
   initializeMonitoring();
   
   // 🚀 서버 시작 로깅
   logger.info('Knowledge Explorer Backend started successfully', {
     type: 'server_start',
     port: PORT,
     environment: process.env.NODE_ENV
   });
   ```

#### **사용자가 보는 화면**
- **로딩 스피너** (초기 데이터 로딩 중)
- **사이드바**: 빈 채팅 목록
- **메인 영역**: 환영 메시지와 채팅 입력창
- **상단**: 로그인 버튼

---

### 🔐 **2단계: 사용자 인증 상태 확인**

#### **자동 인증 체크 프로세스**
```typescript
// 📁 App.tsx - useEffect에서 자동 실행
const checkAuthStatus = async () => {
  const token = localStorage.getItem('token');
  if (token) {
    // 토큰 유효성 검증
    const response = await fetch('/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      setIsAuthenticated(true);
      setUser(userData);
    }
  }
};
```

#### **인증 상태에 따른 분기**

**A) 인증되지 않은 사용자 (익명 사용자)**
- `isAuthenticated: false`
- 로컬 스토리지에서 익명 채팅 복원
- Google 로그인 버튼 표시

**B) 인증된 사용자**
- `isAuthenticated: true`
- 서버에서 사용자 채팅 목록 로드
- 사용자 프로필 정보 표시

---

### 💬 **3A단계: 익명 사용자 채팅 플로우**

#### **새 채팅 생성**
```typescript
// 📁 App.tsx
const handleCreateNewChat = () => {
  const newChat = {
    id: `chat-${Date.now()}`,
    title: '새로운 대화',
    status: 'active',
    created_at: new Date().toISOString(),
    messages: []
  };
  
  // 로컬 스토리지에 저장
  localStorage.setItem('anonymous_chats', JSON.stringify(chats));
  localStorage.setItem('active_chat_id', newChat.id);
};
```

#### **메시지 전송 과정**
1. **사용자 입력** → `ChatInterface.tsx`
2. **프론트엔드 처리**:
   ```typescript
   const sendMessage = async (text: string) => {
     // 1. 사용자 메시지 추가
     const userMessage = {
       id: `user-${Date.now()}`,
       text: text,
       sender: 'user',
       timestamp: new Date().toISOString()
     };
     
     // 2. API 호출
     const response = await fetch(`/api/chats/${activeChat.id}/messages`, {
       method: 'POST',
       body: JSON.stringify({ message: text })
     });
   };
   ```

3. **백엔드 처리** (`src/routes/messageRoutes.js`):
   ```javascript
   router.post('/:chatId/messages', async (req, res) => {
     // 1. 메시지 검증
     if (!message || message.trim() === '') {
       return res.status(400).json({ error: 'Invalid message' });
     }
     
     // 2. 데이터베이스에 사용자 메시지 저장
     await saveMessage(chatId, userMessage);
     
     // 3. Gemini AI API 호출
     const aiResponse = await sendMessage(chat, message);
     
     // 4. AI 응답 저장
     await saveMessage(chatId, aiMessage);
     
     // 5. 스트리밍 응답 전송
     res.writeHead(200, {
       'Content-Type': 'text/plain',
       'Transfer-Encoding': 'chunked'
     });
   });
   ```

4. **데이터베이스 저장** (`src/services/chatHistoryService.js`):
   ```javascript
   const saveMessage = async (chatId, sender, text, context = null) => {
     const query = `
       INSERT INTO messages (chat_id, text, sender, sources, follow_up_questions, context, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     `;
     await pool.query(query, [chatId, text, sender, JSON.stringify([]), JSON.stringify([]), context, 'sent']);
   };
   ```

#### **실시간 분석 추적**
```typescript
// 📁 src/services/analytics.ts - 자동 추적
analytics.trackChatEvent('message_sent', {
  messageLength: text.length,
  chatId: activeChat.id,
  isAuthenticated: false
});
```

---

### 🔑 **3B단계: 로그인 사용자 플로우**

#### **Google OAuth 로그인 과정**
1. **로그인 버튼 클릭** → `LoginButton.tsx`
2. **Google OAuth 시작**:
   ```javascript
   // 📁 src/routes/authRoutes.js
   router.get('/google', passport.authenticate('google', { 
     scope: ['profile', 'email'] 
   }));
   ```

3. **Google 리디렉션** → 사용자 인증
4. **콜백 처리**:
   ```javascript
   router.get('/google/callback', async (req, res) => {
     // 1. Google에서 사용자 정보 받기
     const user = await authService.createOrUpdateUser({
       email: profile.emails[0].value,
       name: profile.displayName,
       google_id: profile.id,
       profile_picture: profile.photos[0].value
     });
     
     // 2. JWT 토큰 생성
     const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
     
     // 3. 프론트엔드로 리디렉션
     res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
   });
   ```

5. **프론트엔드 토큰 처리** (`AuthCallback.tsx`):
   ```typescript
   const handleCallback = async () => {
     const urlParams = new URLSearchParams(window.location.search);
     const token = urlParams.get('token');
     
     if (token) {
       localStorage.setItem('token', token);
       sessionStorage.setItem('token', token);
       // 메인 페이지로 리디렉션
     }
   };
   ```

#### **인증된 사용자 채팅 로드**
```typescript
// 📁 App.tsx
const loadChats = async () => {
  if (isAuthenticated) {
    const response = await fetch('/api/chats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chats = await response.json();
    setChats(chats);
  }
};
```

#### **서버 측 채팅 데이터 조회**
```javascript
// 📁 src/routes/chatRoutes.js
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const query = `
    SELECT * FROM chat_sessions 
    WHERE user_id = $1 AND deleted_at IS NULL 
    ORDER BY updated_at DESC
  `;
  const result = await pool.query(query, [userId]);
  res.json(result.rows);
});
```

---

### 📊 **4단계: 백그라운드 모니터링 및 분석**

#### **자동 성능 추적**
```javascript
// 📁 src/middleware/monitoring.js - 모든 API 요청에 자동 적용
function performanceTrackingMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    // 성능 메트릭 기록
    performanceMetrics.recordMetric('api_response_time', duration, {
      method: req.method,
      route: req.route?.path || req.url,
      statusCode: res.statusCode,
      userId: req.user?.id
    });
  });
}
```

#### **사용자 활동 로깅**
```javascript
// 📁 src/routes/analyticsRoutes.js - 프론트엔드에서 전송된 이벤트 처리
async function processChatEvent(event, session) {
  switch (event.action) {
    case 'message_sent':
      logger.businessMetric('daily_messages', 1, {
        userId: session.userId,
        chatId: event.properties.chatId
      });
      break;
    case 'new_chat_created':
      logger.businessMetric('daily_new_chats', 1, {
        userId: session.userId
      });
      break;
  }
}
```

---

## 👨‍💼 **관리자 플로우 (Administrator Journey)**

### 🎛️ **1단계: 관리자 시스템 접근**

#### **접속 방법**
```
# 헬스체크 대시보드
http://localhost:3001/health/comprehensive

# 실시간 메트릭
http://localhost:3001/api/analytics/realtime

# 대시보드 데이터
http://localhost:3001/api/analytics/dashboard
```

#### **모니터링 대시보드 컴포넌트**
```typescript
// 📁 src/components/MonitoringDashboard.tsx
const MonitoringDashboard: React.FC = () => {
  // 실시간 데이터 페치 (5초마다)
  useEffect(() => {
    const realtimeInterval = setInterval(fetchRealtimeData, 5000);
    return () => clearInterval(realtimeInterval);
  }, []);
  
  // 주요 메트릭 표시
  return (
    <div>
      <MetricCard title="Active Users" value={metrics.activeUsers} />
      <MetricCard title="Response Time" value={metrics.responseTime} />
      <MetricCard title="Error Rate" value={metrics.errorRate} />
    </div>
  );
};
```

---

### 📊 **2단계: 실시간 시스템 상태 모니터링**

#### **헬스체크 API** (`src/routes/healthRoutes.js`)
```javascript
// 종합 시스템 상태
router.get('/health/comprehensive', async (req, res) => {
  const checks = {};
  
  // 데이터베이스 상태
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    checks.database = { status: 'healthy', responseTime: `${duration}ms` };
  } catch (error) {
    checks.database = { status: 'unhealthy', error: error.message };
  }
  
  // AI 서비스 상태
  checks.ai = {
    status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
    model: process.env.AI_MODEL_NAME || 'gemini-1.5-flash'
  };
  
  res.json({ status: 'healthy', checks });
});
```

#### **실시간 메트릭 수집** (`src/middleware/monitoring.js`)
```javascript
// 시스템 리소스 모니터링 (30초마다)
setInterval(() => {
  // 메모리 사용량
  const memoryUsage = process.memoryUsage();
  performanceMetrics.recordMetric('memory_usage_mb', memoryUsage.heapUsed / 1024 / 1024);
  
  // CPU 사용률
  const cpuUsage = process.cpuUsage();
  performanceMetrics.recordMetric('cpu_user_time', cpuUsage.user / 1000000);
  
  // 로드 애버리지
  const loadAverage = os.loadavg();
  performanceMetrics.recordMetric('load_average_1m', loadAverage[0]);
}, 30000);
```

---

### 👥 **3단계: 사용자 활동 추적 및 분석**

#### **사용자 행동 데이터 수집** (`src/routes/analyticsRoutes.js`)
```javascript
// 분석 이벤트 수집 API
router.post('/analytics', async (req, res) => {
  const { session, events } = req.body;
  
  // 세션 정보 로깅
  logger.userActivity(session.userId || 'anonymous', 'analytics_batch', {
    sessionId: session.sessionId,
    eventCount: events.length,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  // 각 이벤트 처리
  for (const event of events) {
    await processAnalyticsEvent(event, session, req);
  }
});
```

#### **사용자별 활동 로그 조회**
```javascript
// 📁 src/services/analyticsService.js
const getUserActivityLog = async (userId, timeRange = '24h') => {
  const query = `
    SELECT 
      action,
      details,
      timestamp,
      ip_address,
      user_agent
    FROM user_activity_logs 
    WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '${timeRange}'
    ORDER BY timestamp DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
};
```

#### **비즈니스 메트릭 대시보드**
```javascript
// 📁 src/routes/analyticsRoutes.js
router.get('/analytics/dashboard', async (req, res) => {
  const metrics = {
    userActivity: {
      activeUsers: performanceMetrics.getStats('active_users'),
      newUsers: performanceMetrics.getStats('new_users'),
      sessionDuration: performanceMetrics.getStats('session_duration')
    },
    chatActivity: {
      messagesSent: performanceMetrics.getStats('chat_messages_sent'),
      newChats: performanceMetrics.getStats('new_chats_created'),
      averageMessageLength: performanceMetrics.getStats('message_length')
    }
  };
  
  res.json({ status: 'success', metrics });
});
```

---

### 🚨 **4단계: 에러 모니터링 및 알림 시스템**

#### **Sentry 에러 추적** (`src/services/monitoring.js`)
```javascript
// 에러 모니터링 초기화
class ErrorMonitoring {
  static initialize() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // 민감한 정보 제거
        if (event.exception) {
          const error = event.exception.values[0];
          // 스팸성 에러 필터링
          if (error.type === 'ValidationError') return null;
        }
        return event;
      }
    });
  }
  
  static captureError(error, context = {}) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
      Sentry.captureException(error);
    });
  }
}
```

#### **보안 위협 로그** (`src/services/securityService.js`)
```javascript
// 보안 위협 로깅
async function logSecurityThreat(threatData) {
  const query = `
    INSERT INTO security_threats (
      threat_type, threat_level, user_question, 
      detected_patterns, user_ip, user_agent, chat_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  
  await pool.query(query, [
    threatData.type,
    threatData.level,
    threatData.question,
    threatData.patterns,
    threatData.ip,
    threatData.userAgent,
    threatData.chatId
  ]);
  
  // 치명적 위협인 경우 즉시 알림
  if (threatData.level === 'critical') {
    await notificationManager.sendAlert('critical', 
      'Security Threat Detected', 
      threatData.question, 
      threatData
    );
  }
}
```

#### **Slack 알림 시스템** (`src/services/notifications.js`)
```javascript
class SlackNotificationService {
  async sendAlert(level, title, message, details = {}) {
    const colors = {
      info: '#36a64f',
      warning: '#ff9900', 
      error: '#ff0000',
      critical: '#8B0000'
    };
    
    const attachment = {
      color: colors[level],
      title: `🚨 ${title}`,
      text: message,
      fields: Object.entries(details).map(([key, value]) => ({
        title: key,
        value: String(value),
        short: true
      }))
    };
    
    return await this.sendMessage('', {
      attachments: [attachment],
      channel: level === 'critical' ? '#critical-alerts' : '#alerts'
    });
  }
}
```

#### **이메일 긴급 알림** (`src/services/notifications.js`)
```javascript
class EmailNotificationService {
  async sendCriticalAlert(title, message, details = {}) {
    const html = `
      <div style="background: #fee; border: 2px solid #f00; padding: 20px;">
        <h1>🚨 Critical System Alert</h1>
        <h2>${title}</h2>
        <p>${message}</p>
        <div>
          <h3>Details:</h3>
          <ul>
            ${Object.entries(details).map(([key, value]) => 
              `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`
            ).join('')}
          </ul>
        </div>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    `;
    
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return await this.sendEmail(adminEmails, `🚨 CRITICAL: ${title}`, html, 'high');
  }
}
```

---

### 📈 **5단계: 성능 분석 및 최적화**

#### **API 성능 모니터링**
```javascript
// 📁 src/middleware/monitoring.js
res.on('finish', () => {
  const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
  
  // 성능 임계치 알림
  if (duration > 3000) { // 3초 이상
    notificationManager.checkMetricAndAlert('response_time', duration, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode
    });
  }
});
```

#### **데이터베이스 쿼리 성능**
```javascript
// 📁 src/services/chatHistoryService.js
const getChatsWithPerformanceLog = async (userId) => {
  const startTime = Date.now();
  
  const query = `
    SELECT cs.*, COUNT(m.id) as message_count
    FROM chat_sessions cs
    LEFT JOIN messages m ON cs.id = m.chat_id
    WHERE cs.user_id = $1 AND cs.deleted_at IS NULL
    GROUP BY cs.id
    ORDER BY cs.updated_at DESC
  `;
  
  const result = await pool.query(query, [userId]);
  const duration = Date.now() - startTime;
  
  // 쿼리 성능 로깅
  logger.performance('db_query_chats', duration, {
    userId,
    resultCount: result.rows.length
  });
  
  return result.rows;
};
```

#### **실시간 알림 규칙** (`src/services/notifications.js`)
```javascript
class NotificationManager {
  setupDefaultRules() {
    // 에러율 임계치
    this.addAlertRule('error_rate', {
      condition: (value) => value > 5, // 5% 이상
      cooldown: 300000, // 5분
      level: 'warning',
      message: 'Error rate is above threshold'
    });
    
    // 응답 시간 임계치
    this.addAlertRule('response_time', {
      condition: (value) => value > 3000, // 3초 이상
      cooldown: 600000, // 10분
      level: 'warning', 
      message: 'Response time is above threshold'
    });
    
    // 메모리 사용량 임계치
    this.addAlertRule('memory_usage', {
      condition: (value) => value > 90, // 90% 이상
      cooldown: 300000, // 5분
      level: 'error',
      message: 'Memory usage is critically high'
    });
  }
}
```

---

### 📋 **6단계: 일일/주간 보고서 자동 생성**

#### **자동 보고서 생성** (`src/middleware/monitoring.js`)
```javascript
// 일일 보고서 (매일 오전 9시)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 9 && now.getMinutes() === 0) {
    generateDailyReport();
  }
}, 60000);

async function generateDailyReport() {
  const report = {
    date: new Date().toDateString(),
    users: {
      active: activeUsers.size,
      peak: performanceMetrics.getStats('active_users')?.max || 0,
      growth: 0 // 전날 대비 계산
    },
    messages: {
      total: performanceMetrics.getStats('chat_messages_sent')?.count || 0,
      peak: performanceMetrics.getStats('chat_messages_sent')?.max || 0
    },
    performance: {
      avgResponseTime: performanceMetrics.getStats('api_response_time')?.avg || 0,
      maxResponseTime: performanceMetrics.getStats('api_response_time')?.max || 0,
      errorRate: calculateErrorRate()
    },
    uptime: {
      percentage: calculateUptimePercentage()
    }
  };
  
  // 이메일로 보고서 전송
  await notificationManager.emailService.sendWeeklyReport(report);
}
```

---

## 🎯 **실제 코드와 플로우 매핑 완료**

### **고객 측면 요약**
1. **http://localhost:8000** 접속
2. **자동 인증 확인** → 익명/로그인 분기
3. **채팅 인터페이스** → 실시간 AI 응답
4. **로컬/서버 데이터 동기화**
5. **백그라운드 분석 추적**

### **관리자 측면 요약**
1. **http://localhost:3001/health/comprehensive** → 시스템 상태
2. **http://localhost:3001/api/analytics/dashboard** → 비즈니스 메트릭
3. **Slack/이메일 알림** → 실시간 문제 대응
4. **Sentry 대시보드** → 에러 상세 분석
5. **자동 보고서** → 일일/주간 성과 리포트

### **핵심 데이터베이스 테이블**
- **`users`** - 사용자 정보 (OAuth 포함)
- **`chat_sessions`** - 채팅 세션 관리
- **`messages`** - 모든 대화 내용
- **`security_threats`** - 보안 위협 로그
- **`user_memories`** - 장기 메모리 관리

**🎉 이제 Knowledge Explorer는 완전한 상용 서비스 플로우를 갖추었습니다!**
