# 🛠️ Knowledge Explorer - 관리자 운영 가이드

## 📊 **실시간 모니터링 대시보드 접속**

### **1. 시스템 헬스체크**
```bash
# 기본 상태 확인
curl http://localhost:3001/health

# 종합 시스템 상태
curl http://localhost:3001/health/comprehensive

# 데이터베이스 상태
curl http://localhost:3001/health/database

# AI 서비스 상태  
curl http://localhost:3001/health/ai
```

### **2. 분석 대시보드 접속**
```bash
# 실시간 메트릭
curl http://localhost:3001/api/analytics/realtime

# 대시보드 데이터 (지난 24시간)
curl http://localhost:3001/api/analytics/dashboard?timeRange=24h

# 주간 데이터
curl http://localhost:3001/api/analytics/dashboard?timeRange=7d
```

---

## 👥 **사용자 활동 모니터링**

### **실시간 활성 사용자 추적**
```javascript
// 📁 src/middleware/monitoring.js에서 자동 수집
const activeUsers = new Set(); // 현재 활성 사용자
const userSessions = new Map(); // 세션 정보

// 사용자 활동 시 자동 기록
function userActivityTrackingMiddleware(req, res, next) {
  const userId = req.user?.id || req.ip;
  const sessionId = req.sessionID || req.headers['x-session-id'];
  
  activeUsers.add(userId);
  userSessions.set(sessionId, {
    userId,
    lastActivity: Date.now(),
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
}
```

### **사용자별 활동 로그 조회**
```sql
-- 특정 사용자의 최근 활동
SELECT 
  action,
  details,
  timestamp,
  ip_address,
  user_agent
FROM user_activity_logs 
WHERE user_id = 123 
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- 일일 메시지 통계
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as active_users
FROM messages 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### **채팅 활동 분석**
```sql
-- 가장 활발한 사용자 TOP 10
SELECT 
  u.name,
  u.email,
  COUNT(m.id) as message_count,
  COUNT(DISTINCT cs.id) as chat_count,
  MAX(m.timestamp) as last_activity
FROM users u
LEFT JOIN chat_sessions cs ON u.id = cs.user_id
LEFT JOIN messages m ON cs.id = m.chat_id
WHERE m.timestamp > NOW() - INTERVAL '7 days'
GROUP BY u.id, u.name, u.email
ORDER BY message_count DESC
LIMIT 10;
```

---

## 🚨 **에러 모니터링 및 알림**

### **Sentry 에러 모니터링**
1. **Sentry 대시보드 접속**: https://sentry.io/[your-project]
2. **주요 확인 항목**:
   - 에러 발생 빈도
   - 영향받은 사용자 수
   - 에러 트렌드 분석
   - 성능 병목 지점

### **실시간 에러 알림 설정**
```javascript
// 📁 .env 파일 설정
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
ADMIN_EMAILS=admin1@company.com,admin2@company.com

// 알림 임계치 설정 (src/services/notifications.js)
const alertRules = {
  error_rate: { threshold: 5, cooldown: 300000 }, // 5% 에러율, 5분 쿨다운
  response_time: { threshold: 3000, cooldown: 600000 }, // 3초 응답시간, 10분 쿨다운
  memory_usage: { threshold: 90, cooldown: 300000 } // 90% 메모리, 5분 쿨다운
};
```

### **보안 위협 모니터링**
```sql
-- 최근 보안 위협 조회
SELECT 
  threat_type,
  threat_level,
  user_question,
  detected_patterns,
  user_ip,
  timestamp,
  handled
FROM security_threats 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY threat_level DESC, timestamp DESC;

-- IP별 위험 활동 집계
SELECT 
  user_ip,
  COUNT(*) as threat_count,
  MAX(threat_level) as max_threat_level,
  array_agg(DISTINCT threat_type) as threat_types
FROM security_threats 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_ip
HAVING COUNT(*) > 5
ORDER BY threat_count DESC;
```

---

## 📈 **성능 분석 및 최적화**

### **API 성능 모니터링**
```bash
# 느린 API 엔드포인트 확인
curl http://localhost:3001/api/analytics/dashboard | jq '.metrics.performance'

# 실시간 응답 시간 모니터링
watch -n 5 'curl -s http://localhost:3001/api/analytics/realtime | jq .systemHealth.responseTime'
```

### **데이터베이스 성능 분석**
```sql
-- 느린 쿼리 식별 (PostgreSQL)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE mean_time > 1000 -- 1초 이상
ORDER BY mean_time DESC
LIMIT 10;

-- 테이블 크기 확인
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **시스템 리소스 모니터링**
```bash
# 메모리 사용량 확인
curl http://localhost:3001/metrics | grep memory

# CPU 사용률 확인  
curl http://localhost:3001/metrics | grep cpu

# 디스크 사용량 확인
df -h

# 프로세스 모니터링
top -p $(pgrep -f "node.*index.js")
```

---

## 🔔 **알림 채널 관리**

### **Slack 알림 설정**
```javascript
// 📁 src/services/notifications.js
// 알림 채널 설정
const channels = {
  critical: '#critical-alerts',
  error: '#errors', 
  warning: '#warnings',
  info: '#general',
  deployment: '#deployments',
  metrics: '#metrics'
};

// 알림 예시
await slackService.sendAlert('critical', 
  'High Error Rate Detected', 
  'API error rate exceeded 5% in the last 5 minutes', 
  {
    currentRate: '7.2%',
    threshold: '5%',
    affectedUsers: 23,
    topErrors: ['Database timeout', 'AI service unavailable']
  }
);
```

### **이메일 알림 설정**
```javascript
// 긴급 상황 이메일 알림
await emailService.sendCriticalAlert(
  'System Down - Immediate Action Required',
  'The Knowledge Explorer service is experiencing critical issues',
  {
    downtime: '5 minutes',
    affectedServices: ['Chat API', 'User Authentication'],
    estimatedUsers: 150,
    nextSteps: 'Investigating database connectivity issues'
  }
);
```

---

## 📊 **정기 보고서 및 분석**

### **자동 생성 보고서**
1. **시간별 메트릭** (1시간마다)
   - 활성 사용자 수
   - 메시지 처리량
   - 시스템 성능 지표

2. **일일 리포트** (매일 오전 9시)
   - 전날 사용자 활동 요약
   - 성능 통계
   - 에러 및 보안 이벤트

3. **주간 요약** (매주 월요일)
   - 주간 사용자 성장률
   - 기능 사용 패턴
   - 시스템 안정성 보고

### **커스텀 분석 쿼리**
```sql
-- 사용자 성장 트렌드
WITH daily_users AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as new_users
  FROM users 
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at)
)
SELECT 
  date,
  new_users,
  SUM(new_users) OVER (ORDER BY date) as cumulative_users
FROM daily_users
ORDER BY date;

-- 기능 사용률 분석
SELECT 
  action,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (PARTITION BY user_id ORDER BY timestamp)))) as avg_interval_seconds
FROM user_activity_logs 
WHERE timestamp > NOW() - INTERVAL '7 days'
  AND action IN ('message_sent', 'new_chat_created', 'chat_deleted')
GROUP BY action
ORDER BY usage_count DESC;
```

---

## 🛠️ **장애 대응 가이드**

### **일반적인 문제 해결**

#### **1. 높은 응답 시간**
```bash
# 문제 확인
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/health

# 데이터베이스 연결 확인
curl http://localhost:3001/health/database

# 시스템 리소스 확인
curl http://localhost:3001/metrics
```

**대응 방법**:
- 데이터베이스 쿼리 최적화
- 캐시 설정 확인
- 서버 리소스 스케일링

#### **2. 높은 에러율**
```bash
# 에러 패턴 분석
curl http://localhost:3001/api/analytics/dashboard | jq '.metrics.performance.errorRate'

# 최근 에러 로그 확인
docker logs knowledge-explorer-backend --tail 100
```

**대응 방법**:
- Sentry 대시보드에서 상세 에러 분석
- 코드 롤백 고려
- 의존 서비스 상태 확인

#### **3. 메모리 부족**
```bash
# 메모리 사용량 확인
curl http://localhost:3001/metrics | grep memory

# 프로세스 재시작
docker-compose restart backend
```

**대응 방법**:
- 메모리 누수 확인
- 가비지 컬렉션 튜닝
- 서버 스케일링

### **긴급 연락처 및 에스컬레이션**
```
🚨 Level 1 - 운영팀
- Slack: #operations
- 이메일: ops@company.com

🔥 Level 2 - 개발팀
- Slack: #dev-team  
- 이메일: dev@company.com

☢️ Level 3 - 기술이사
- 핸드폰: +82-10-xxxx-xxxx
- 이메일: cto@company.com
```

---

## 🎯 **주요 KPI 및 목표 지표**

### **서비스 레벨 목표 (SLO)**
- **가용성**: 99.9% (월 43분 이하 다운타임)
- **응답 시간**: 95%의 요청이 500ms 이내
- **에러율**: 1% 미만
- **데이터 손실**: 0% (RPO = 0)

### **비즈니스 메트릭**
- **일일 활성 사용자 (DAU)**: 목표 1,000명
- **사용자 유지율**: 7일 후 70%, 30일 후 50%
- **평균 세션 시간**: 목표 15분
- **메시지당 평균 응답 시간**: 목표 3초

### **대시보드 모니터링 항목**
```javascript
// 실시간 모니터링 필수 지표
const criticalMetrics = {
  system: {
    uptime: '99.95%',
    responseTime: '245ms',
    errorRate: '0.3%',
    memoryUsage: '67%',
    cpuUsage: '42%'
  },
  business: {
    activeUsers: 847,
    messagesPerHour: 1205,
    newChatsToday: 156,
    averageSessionTime: '18m 32s'
  },
  alerts: {
    critical: 0,
    warnings: 2,
    info: 5
  }
};
```

**🎉 이제 Knowledge Explorer를 완벽하게 모니터링하고 관리할 수 있습니다!**
