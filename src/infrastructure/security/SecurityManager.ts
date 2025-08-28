/**
 * 🔒 보안 관리자 - 상용화 수준 보안 시스템
 * @description 포괄적인 클라이언트 사이드 보안 기능
 */

import { Logger } from '../logger/Logger';
import { ErrorHandler } from '../errors/ErrorHandler';

interface SecurityConfig {
  enableCSRFProtection: boolean;
  enableXSSProtection: boolean;
  enableInputSanitization: boolean;
  enableContentSecurityPolicy: boolean;
  tokenRefreshThreshold: number; // 토큰 만료 전 갱신 시간 (분)
  maxRequestSize: number; // 최대 요청 크기 (bytes)
  allowedOrigins: string[];
  sensitiveDataPatterns: RegExp[];
}

interface SecurityEvent {
  type: 'XSS_ATTEMPT' | 'CSRF_ATTEMPT' | 'TOKEN_HIJACK' | 'SUSPICIOUS_INPUT' | 'RATE_LIMIT_EXCEEDED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
  timestamp: string;
  userAgent: string;
  ip?: string;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private csrfToken: string | null = null;
  private securityEvents: SecurityEvent[] = [];
  private rateLimitMap: Map<string, number[]> = new Map();
  
  private constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableCSRFProtection: true,
      enableXSSProtection: true,
      enableInputSanitization: true,
      enableContentSecurityPolicy: true,
      tokenRefreshThreshold: 15,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: ['http://localhost:8000', 'http://localhost:3001'],
      sensitiveDataPatterns: [
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 신용카드
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 이메일
        /\b\d{10,11}\b/g // 전화번호
      ],
      ...config
    };
    
    this.initialize();
  }
  
  public static getInstance(config?: Partial<SecurityConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }
  
  // ============================================================================
  // 🚀 초기화 및 설정
  // ============================================================================
  
  private initialize(): void {
    this.setupCSRFProtection();
    this.setupXSSProtection();
    this.setupContentSecurityPolicy();
    this.setupSecurityHeaders();
    this.startTokenMonitoring();
    
    Logger.info('SecurityManager 초기화 완료', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  // ============================================================================
  // 🛡️ CSRF 보호
  // ============================================================================
  
  private setupCSRFProtection(): void {
    if (!this.config.enableCSRFProtection) return;
    
    // CSRF 토큰 생성
    this.csrfToken = this.generateSecureToken();
    
    // 메타 태그에 CSRF 토큰 설정
    const metaTag = document.createElement('meta');
    metaTag.name = 'csrf-token';
    metaTag.content = this.csrfToken;
    document.head.appendChild(metaTag);
    
    Logger.info('CSRF 보호 설정 완료');
  }
  
  public validateCSRFToken(token: string): boolean {
    if (!this.config.enableCSRFProtection) return true;
    
    const isValid = token === this.csrfToken;
    
    if (!isValid) {
      this.recordSecurityEvent({
        type: 'CSRF_ATTEMPT',
        severity: 'HIGH',
        details: { providedToken: token },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }
    
    return isValid;
  }
  
  public getCSRFToken(): string | null {
    return this.csrfToken;
  }
  
  // ============================================================================
  // 🧹 입력 데이터 검증 및 정화
  // ============================================================================
  
  public sanitizeInput(input: string): string {
    if (!this.config.enableInputSanitization) return input;
    
    // XSS 방지를 위한 HTML 태그 제거/이스케이프
    let sanitized = input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // SQL 인젝션 패턴 탐지
    const sqlPatterns = [
      /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bUNION\b)/i,
      /(\bOR\s+1=1\b|\bAND\s+1=1\b)/i,
      /(--|\#|\/\*)/,
      /(\bEXEC\b|\bEXECUTE\b)/i
    ];
    
    const containsSQLInjection = sqlPatterns.some(pattern => pattern.test(input));
    
    if (containsSQLInjection) {
      this.recordSecurityEvent({
        type: 'SUSPICIOUS_INPUT',
        severity: 'HIGH',
        details: { input: input.substring(0, 100), detected: 'SQL_INJECTION' },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
      
      // 의심스러운 내용 제거
      sanitized = sanitized.replace(/(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bUNION\b)/gi, '***');
    }
    
    // 스크립트 태그 탐지
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    const containsScript = scriptPatterns.some(pattern => pattern.test(input));
    
    if (containsScript) {
      this.recordSecurityEvent({
        type: 'XSS_ATTEMPT',
        severity: 'CRITICAL',
        details: { input: input.substring(0, 100) },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
      
      // 스크립트 태그 완전 제거
      sanitized = scriptPatterns.reduce((acc, pattern) => acc.replace(pattern, ''), sanitized);
    }
    
    return sanitized;
  }
  
  public validateMessageContent(message: string): { isValid: boolean; sanitized: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = this.sanitizeInput(message);
    
    // 길이 검증
    if (message.length > 10000) {
      warnings.push('메시지가 너무 깁니다');
      sanitized = sanitized.substring(0, 10000);
    }
    
    // 민감한 데이터 탐지
    for (const pattern of this.config.sensitiveDataPatterns) {
      if (pattern.test(message)) {
        warnings.push('민감한 정보가 포함되어 있을 수 있습니다');
        sanitized = sanitized.replace(pattern, '***');
      }
    }
    
    // 반복 문자/패턴 탐지 (스팸 방지)
    const repeatPattern = /(.)\1{10,}/g;
    if (repeatPattern.test(message)) {
      warnings.push('반복되는 문자가 감지되었습니다');
      sanitized = sanitized.replace(repeatPattern, (match, char) => char.repeat(3));
    }
    
    return {
      isValid: warnings.length === 0,
      sanitized,
      warnings
    };
  }
  
  // ============================================================================
  // 🔐 토큰 관리 및 보안
  // ============================================================================
  
  private startTokenMonitoring(): void {
    setInterval(() => {
      this.checkTokenSecurity();
    }, 60 * 1000); // 1분마다 검사
  }
  
  private checkTokenSecurity(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeToExpiry = expiresAt - now;
      
      // 만료 임박 시 경고
      if (timeToExpiry < this.config.tokenRefreshThreshold * 60 * 1000) {
        Logger.warn('토큰 만료 임박', {
          expiresAt: new Date(expiresAt).toISOString(),
          timeToExpiry: Math.floor(timeToExpiry / 1000 / 60) + '분'
        });
        
        // 자동 갱신 시도
        this.refreshToken();
      }
      
      // 토큰 무결성 검사 (간단한 형태)
      const storedHash = sessionStorage.getItem('token_hash');
      const currentHash = this.hashToken(token);
      
      if (storedHash && storedHash !== currentHash) {
        this.recordSecurityEvent({
          type: 'TOKEN_HIJACK',
          severity: 'CRITICAL',
          details: { 
            expected: storedHash.substring(0, 10),
            actual: currentHash.substring(0, 10)
          },
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
        
        // 토큰 무효화
        this.revokeToken();
      }
      
    } catch (error) {
      Logger.error('토큰 검증 실패', error);
    }
  }
  
  public secureTokenStorage(token: string): void {
    // 토큰 해시 저장 (무결성 검증용)
    const tokenHash = this.hashToken(token);
    sessionStorage.setItem('token_hash', tokenHash);
    
    // 토큰을 안전하게 저장
    localStorage.setItem('token', token);
    
    // 토큰 정보 로깅 (민감한 정보 제외)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      Logger.info('토큰 안전 저장 완료', {
        userId: payload.userId,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      });
    } catch (error) {
      Logger.error('토큰 정보 파싱 실패', error);
    }
  }
  
  private async refreshToken(): Promise<void> {
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const { token: newToken } = await response.json();
        this.secureTokenStorage(newToken);
        Logger.info('토큰 갱신 성공');
      }
      
    } catch (error) {
      Logger.error('토큰 갱신 실패', error);
    }
  }
  
  private revokeToken(): void {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token_hash');
    
    this.recordSecurityEvent({
      type: 'TOKEN_HIJACK',
      severity: 'CRITICAL',
      details: { action: 'token_revoked' },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
    
    // 사용자를 로그인 페이지로 리다이렉트
    window.location.href = '/login';
  }
  
  // ============================================================================
  // 🚦 Rate Limiting
  // ============================================================================
  
  public checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.rateLimitMap.has(identifier)) {
      this.rateLimitMap.set(identifier, []);
    }
    
    const requests = this.rateLimitMap.get(identifier)!;
    
    // 윈도우 외부의 요청 제거
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      this.recordSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        details: { 
          identifier, 
          requestCount: validRequests.length, 
          maxRequests, 
          windowMs 
        },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
      
      return false;
    }
    
    // 현재 요청 추가
    validRequests.push(now);
    this.rateLimitMap.set(identifier, validRequests);
    
    return true;
  }
  
  // ============================================================================
  // 📊 보안 모니터링
  // ============================================================================
  
  private recordSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // 이벤트 수 제한 (메모리 관리)
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-500);
    }
    
    // 심각한 이벤트는 즉시 보고
    if (event.severity === 'CRITICAL') {
      this.reportSecurityEvent(event);
    }
    
    Logger.warn('보안 이벤트 기록', event);
  }
  
  private async reportSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await fetch('/api/security/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken || ''
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      Logger.error('보안 이벤트 보고 실패', error);
    }
  }
  
  public getSecurityMetrics(): {
    totalEvents: number;
    criticalEvents: number;
    recentEvents: SecurityEvent[];
    riskScore: number;
  } {
    const recent = this.securityEvents.slice(-10);
    const critical = this.securityEvents.filter(e => e.severity === 'CRITICAL').length;
    
    // 위험 점수 계산 (0-100)
    let riskScore = 0;
    this.securityEvents.forEach(event => {
      switch (event.severity) {
        case 'LOW': riskScore += 1; break;
        case 'MEDIUM': riskScore += 3; break;
        case 'HIGH': riskScore += 7; break;
        case 'CRITICAL': riskScore += 15; break;
      }
    });
    
    riskScore = Math.min(100, riskScore);
    
    return {
      totalEvents: this.securityEvents.length,
      criticalEvents: critical,
      recentEvents: recent,
      riskScore
    };
  }
  
  // ============================================================================
  // 🔧 유틸리티 함수들
  // ============================================================================
  
  private setupXSSProtection(): void {
    if (!this.config.enableXSSProtection) return;
    
    // X-XSS-Protection 헤더 설정 (가능한 경우)
    const meta = document.createElement('meta');
    meta.httpEquiv = 'X-XSS-Protection';
    meta.content = '1; mode=block';
    document.head.appendChild(meta);
  }
  
  private setupContentSecurityPolicy(): void {
    if (!this.config.enableContentSecurityPolicy) return;
    
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' " + this.config.allowedOrigins.join(' '),
      "font-src 'self' data:",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = csp;
    document.head.appendChild(meta);
  }
  
  private setupSecurityHeaders(): void {
    // 추가 보안 헤더들
    const headers = [
      { name: 'X-Content-Type-Options', value: 'nosniff' },
      { name: 'X-Frame-Options', value: 'DENY' },
      { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ];
    
    headers.forEach(header => {
      const meta = document.createElement('meta');
      meta.httpEquiv = header.name;
      meta.content = header.value;
      document.head.appendChild(meta);
    });
  }
  
  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  private hashToken(token: string): string {
    // 간단한 해시 함수 (실제로는 더 강력한 해시 사용 권장)
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return hash.toString(16);
  }
  
  // ============================================================================
  // 🎯 Public API
  // ============================================================================
  
  public validateRequest(url: string, method: string, data?: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Origin 검증
    const origin = window.location.origin;
    if (!this.config.allowedOrigins.includes(origin)) {
      errors.push('허용되지 않은 Origin입니다');
    }
    
    // 요청 크기 검증
    if (data && JSON.stringify(data).length > this.config.maxRequestSize) {
      errors.push('요청 크기가 너무 큽니다');
    }
    
    // Rate limiting 검증
    const identifier = `${method}:${url}`;
    if (!this.checkRateLimit(identifier)) {
      errors.push('요청 제한을 초과했습니다');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  public secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // 요청 검증
    const validation = this.validateRequest(url, options.method || 'GET', options.body);
    if (!validation.isValid) {
      throw new Error(`보안 검증 실패: ${validation.errors.join(', ')}`);
    }
    
    // 보안 헤더 추가
    const secureHeaders = {
      'X-CSRF-Token': this.csrfToken || '',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers
    };
    
    return fetch(url, {
      ...options,
      headers: secureHeaders
    });
  }
}
