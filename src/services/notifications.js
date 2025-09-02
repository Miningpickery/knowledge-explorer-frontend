// 🔔 Real-time Notification System
// 상용화 수준의 실시간 알림 및 경고 시스템

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.log('⚠️ nodemailer not installed - email notifications disabled');
}
const { logger } = require('./monitoring');

/**
 * 📧 이메일 알림 서비스
 */
class EmailNotificationService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      console.log('✅ Email notification service initialized');
    } else {
      console.log('⚠️ SMTP configuration missing - email notifications disabled');
    }
  }

  async sendEmail(to, subject, html, priority = 'normal') {
    if (!this.transporter) {
      console.warn('Email transporter not configured');
      return false;
    }

    try {
      const mailOptions = {
        from: `${process.env.FROM_NAME || 'Knowledge Explorer'} <${process.env.FROM_EMAIL}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        priority: priority === 'high' ? 'high' : 'normal',
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        type: 'email_notification',
        to: mailOptions.to,
        subject,
        messageId: result.messageId,
        priority,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', error, {
        to,
        subject,
        priority,
      });
      return false;
    }
  }

  async sendCriticalAlert(title, message, details = {}) {
    const html = this.generateCriticalAlertTemplate(title, message, details);
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    
    if (adminEmails.length > 0) {
      return await this.sendEmail(
        adminEmails,
        `🚨 CRITICAL ALERT: ${title}`,
        html,
        'high'
      );
    }
    return false;
  }

  async sendWeeklyReport(data) {
    const html = this.generateWeeklyReportTemplate(data);
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    
    if (adminEmails.length > 0) {
      return await this.sendEmail(
        adminEmails,
        `📊 Weekly Analytics Report - ${new Date().toLocaleDateString()}`,
        html
      );
    }
    return false;
  }

  generateCriticalAlertTemplate(title, message, details) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Critical Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .alert { background: #fee; border: 2px solid #f00; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .timestamp { color: #666; font-size: 0.9em; }
          h1 { color: #d00; }
          h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .severity-critical { background: #ff4444; color: white; padding: 5px 10px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="alert">
          <h1>🚨 Critical System Alert</h1>
          <p><span class="severity-critical">CRITICAL</span></p>
          
          <h2>${title}</h2>
          <p>${message}</p>
          
          <div class="details">
            <h3>Details:</h3>
            <ul>
              ${Object.entries(details).map(([key, value]) => 
                `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`
              ).join('')}
            </ul>
          </div>
          
          <p class="timestamp">
            <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
            <strong>Environment:</strong> ${process.env.NODE_ENV}<br>
            <strong>Server:</strong> ${process.env.HOSTNAME || 'Unknown'}
          </p>
          
          <p><strong>Action Required:</strong> Please investigate immediately.</p>
        </div>
      </body>
      </html>
    `;
  }

  generateWeeklyReportTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .metric { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .metric-value { font-size: 2em; font-weight: bold; color: #4CAF50; }
          .chart-placeholder { background: #eee; height: 200px; display: flex; align-items: center; justify-content: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Knowledge Explorer - Weekly Report</h1>
          <p>Week of ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="metric">
          <h3>👥 User Activity</h3>
          <div class="metric-value">${data.users?.active || 0}</div>
          <p>Active Users (${(data.users?.growth || 0) > 0 ? '↗️' : '↘️'} ${Math.abs(data.users?.growth || 0)}% from last week)</p>
        </div>
        
        <div class="metric">
          <h3>💬 Chat Activity</h3>
          <div class="metric-value">${data.messages?.total || 0}</div>
          <p>Total Messages Sent</p>
        </div>
        
        <div class="metric">
          <h3>🚨 System Health</h3>
          <div class="metric-value">${(data.uptime?.percentage || 0).toFixed(2)}%</div>
          <p>Uptime Percentage</p>
        </div>
        
        <div class="metric">
          <h3>⚡ Performance</h3>
          <div class="metric-value">${(data.performance?.avgResponseTime || 0).toFixed(0)}ms</div>
          <p>Average Response Time</p>
        </div>
        
        <p style="text-align: center; color: #666; margin-top: 40px;">
          Generated automatically by Knowledge Explorer monitoring system
        </p>
      </body>
      </html>
    `;
  }
}

/**
 * 💬 Slack 알림 서비스
 */
class SlackNotificationService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;
    
    if (this.enabled) {
      console.log('✅ Slack notification service initialized');
    } else {
      console.log('⚠️ Slack webhook URL not configured - Slack notifications disabled');
    }
  }

  async sendMessage(text, options = {}) {
    if (!this.enabled) return false;

    const payload = {
      text,
      username: options.username || 'Knowledge Explorer Bot',
      icon_emoji: options.icon || ':robot_face:',
      channel: options.channel || process.env.SLACK_CHANNEL || '#alerts',
      attachments: options.attachments || [],
      ...options
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        logger.info('Slack message sent successfully', {
          type: 'slack_notification',
          channel: payload.channel,
          username: payload.username,
        });
        return true;
      } else {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('Failed to send Slack message', error, {
        text: text.substring(0, 100),
        channel: payload.channel,
      });
      return false;
    }
  }

  async sendAlert(level, title, message, details = {}) {
    const colors = {
      info: '#36a64f',    // 녹색
      warning: '#ff9900',  // 주황색
      error: '#ff0000',   // 빨간색
      critical: '#8B0000' // 진한 빨간색
    };

    const icons = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':x:',
      critical: ':rotating_light:'
    };

    const attachment = {
      color: colors[level] || colors.info,
      title: `${icons[level]} ${title}`,
      text: message,
      fields: Object.entries(details).map(([key, value]) => ({
        title: key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        short: true
      })),
      footer: 'Knowledge Explorer Monitoring',
      ts: Math.floor(Date.now() / 1000)
    };

    return await this.sendMessage('', {
      attachments: [attachment],
      channel: level === 'critical' ? '#critical-alerts' : '#alerts'
    });
  }

  async sendDeploymentNotification(environment, version, status) {
    const color = status === 'success' ? '#36a64f' : '#ff0000';
    const icon = status === 'success' ? ':white_check_mark:' : ':x:';
    
    const attachment = {
      color,
      title: `${icon} Deployment ${status === 'success' ? 'Successful' : 'Failed'}`,
      fields: [
        { title: 'Environment', value: environment, short: true },
        { title: 'Version', value: version, short: true },
        { title: 'Status', value: status, short: true },
        { title: 'Time', value: new Date().toISOString(), short: true }
      ],
      footer: 'CI/CD Pipeline',
      ts: Math.floor(Date.now() / 1000)
    };

    return await this.sendMessage('', {
      attachments: [attachment],
      channel: '#deployments'
    });
  }

  async sendMetricsUpdate(metrics) {
    const attachment = {
      color: '#439FE0',
      title: ':chart_with_upwards_trend: Real-time Metrics Update',
      fields: [
        { title: 'Active Users', value: metrics.activeUsers || 0, short: true },
        { title: 'Messages/Hour', value: metrics.messagesPerHour || 0, short: true },
        { title: 'Avg Response Time', value: `${metrics.avgResponseTime || 0}ms`, short: true },
        { title: 'Error Rate', value: `${(metrics.errorRate || 0).toFixed(2)}%`, short: true },
      ],
      footer: 'Hourly Metrics Report',
      ts: Math.floor(Date.now() / 1000)
    };

    return await this.sendMessage('', {
      attachments: [attachment],
      channel: '#metrics'
    });
  }
}

/**
 * 🔔 통합 알림 관리자
 */
class NotificationManager {
  constructor() {
    this.emailService = new EmailNotificationService();
    this.slackService = new SlackNotificationService();
    this.alertRules = new Map();
    this.alertCooldowns = new Map();
    this.setupDefaultRules();
  }

  /**
   * 기본 알림 규칙 설정
   */
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

    // 디스크 사용량 임계치
    this.addAlertRule('disk_usage', {
      condition: (value) => value > 85, // 85% 이상
      cooldown: 3600000, // 1시간
      level: 'warning',
      message: 'Disk usage is high'
    });
  }

  /**
   * 알림 규칙 추가
   */
  addAlertRule(name, rule) {
    this.alertRules.set(name, rule);
  }

  /**
   * 메트릭 값 확인 및 알림
   */
  async checkMetricAndAlert(metricName, value, context = {}) {
    const rule = this.alertRules.get(metricName);
    if (!rule || !rule.condition(value)) return false;

    // 쿨다운 확인
    const lastAlert = this.alertCooldowns.get(metricName);
    if (lastAlert && Date.now() - lastAlert < rule.cooldown) {
      return false; // 쿨다운 중
    }

    // 알림 전송
    await this.sendAlert(rule.level, metricName, rule.message, {
      value,
      threshold: rule.condition.toString(),
      ...context
    });

    // 쿨다운 설정
    this.alertCooldowns.set(metricName, Date.now());
    return true;
  }

  /**
   * 통합 알림 전송
   */
  async sendAlert(level, title, message, details = {}) {
    const timestamp = new Date().toISOString();
    
    // 로그 기록
    logger[level === 'critical' ? 'error' : 'warn']('System Alert', {
      type: 'system_alert',
      level,
      title,
      message,
      details,
      timestamp,
    });

    // Slack 알림
    await this.slackService.sendAlert(level, title, message, details);

    // 치명적인 알림은 이메일로도 전송
    if (level === 'critical' || level === 'error') {
      await this.emailService.sendCriticalAlert(title, message, details);
    }
  }

  /**
   * 배포 알림
   */
  async notifyDeployment(environment, version, status, details = {}) {
    await this.slackService.sendDeploymentNotification(environment, version, status);
    
    logger.info('Deployment notification sent', {
      type: 'deployment_notification',
      environment,
      version,
      status,
      details,
    });
  }

  /**
   * 정기 메트릭 보고
   */
  async sendPeriodicReport(metrics) {
    await this.slackService.sendMetricsUpdate(metrics);
    
    // 주간 보고서는 이메일로
    const now = new Date();
    if (now.getDay() === 1 && now.getHours() === 9) { // 월요일 9시
      await this.emailService.sendWeeklyReport(metrics);
    }
  }

  /**
   * 사용자 행동 기반 알림
   */
  async notifyUserBehavior(event, data) {
    switch (event) {
      case 'new_user_signup':
        await this.slackService.sendMessage(
          `:wave: New user signed up: ${data.email}`,
          { channel: '#growth' }
        );
        break;
        
      case 'high_engagement':
        await this.slackService.sendMessage(
          `:fire: User ${data.userId} sent ${data.messageCount} messages today!`,
          { channel: '#engagement' }
        );
        break;
        
      case 'feature_adoption':
        await this.slackService.sendMessage(
          `:rocket: Feature "${data.feature}" was used by ${data.userCount} users today`,
          { channel: '#product' }
        );
        break;
    }
  }

  /**
   * 보안 이벤트 알림
   */
  async notifySecurityEvent(event, details) {
    await this.sendAlert('critical', `Security Event: ${event}`, 
      'A security event has been detected and requires immediate attention.', 
      details
    );
  }
}

// 싱글톤 인스턴스
const notificationManager = new NotificationManager();

module.exports = {
  EmailNotificationService,
  SlackNotificationService,
  NotificationManager,
  notificationManager,
};
