// 🛡️ Security Utilities
// 상용화 수준의 보안 유틸리티 (XSS, CSRF, 입력 검증)

import DOMPurify from 'dompurify';

/**
 * 🔒 Input Validation & Sanitization
 */
export class SecurityValidator {
  // 허용되는 HTML 태그 (메시지용)
  private static readonly ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote'];
  private static readonly ALLOWED_ATTRIBUTES = ['class'];

  /**
   * HTML 새니타이제이션 (XSS 방어)
   */
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: SecurityValidator.ALLOWED_TAGS,
      ALLOWED_ATTR: SecurityValidator.ALLOWED_ATTRIBUTES,
      FORBID_SCRIPTS: true,
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
    });
  }

  /**
   * 텍스트 입력 검증 및 새니타이제이션
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .trim()
      .replace(/[<>\"']/g, '') // 기본 HTML 문자 제거
      .replace(/javascript:/gi, '') // JavaScript URL 제거
      .replace(/data:/gi, '') // Data URL 제거
      .substring(0, 10000); // 길이 제한
  }

  /**
   * 메시지 내용 검증
   */
  static validateMessage(message: string): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];
    
    if (typeof message !== 'string') {
      errors.push('메시지는 문자열이어야 합니다.');
      return { isValid: false, sanitized: '', errors };
    }

    if (message.length === 0) {
      errors.push('메시지는 비어있을 수 없습니다.');
      return { isValid: false, sanitized: '', errors };
    }

    if (message.length > 10000) {
      errors.push('메시지는 10,000자를 초과할 수 없습니다.');
    }

    // SQL 인젝션 패턴 검사
    const sqlPatterns = [
      /('|(\\')|(;|\\;))/i,
      /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)/i,
      /(\bOR\b|\bAND\b).*[=<>]/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(message)) {
        errors.push('허용되지 않는 패턴이 감지되었습니다.');
        break;
      }
    }

    // XSS 패턴 검사
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(message)) {
        errors.push('보안상 허용되지 않는 내용이 포함되어 있습니다.');
        break;
      }
    }

    const sanitized = SecurityValidator.sanitizeText(message);
    const isValid = errors.length === 0;

    return { isValid, sanitized, errors };
  }

  /**
   * 이메일 검증
   */
  static validateEmail(email: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('이메일은 필수입니다.');
      return { isValid: false, errors };
    }

    // 더 엄격한 이메일 정규식 (연속된 점 제외)
    const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email) || email.includes('..')) {
      errors.push('올바른 이메일 형식이 아닙니다.');
    }

    if (email.length > 254) {
      errors.push('이메일이 너무 깁니다.');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 파일 업로드 검증
   */
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/pdf'];

    if (!file) {
      errors.push('파일이 선택되지 않았습니다.');
      return { isValid: false, errors };
    }

    if (file.size > maxSize) {
      errors.push('파일 크기는 10MB를 초과할 수 없습니다.');
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push('허용되지 않는 파일 형식입니다.');
    }

    // 파일 이름 검증
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(file.name)) {
      errors.push('파일 이름에 허용되지 않는 문자가 포함되어 있습니다.');
    }

    return { isValid: errors.length === 0, errors };
  }
}

/**
 * 🔐 CSRF Protection
 */
export class CSRFProtection {
  private static token: string | null = null;
  private static readonly TOKEN_HEADER = 'X-CSRF-Token';

  /**
   * CSRF 토큰 생성
   */
  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    CSRFProtection.token = token;
    
    // 세션 스토리지에 저장
    sessionStorage.setItem('csrf_token', token);
    return token;
  }

  /**
   * CSRF 토큰 가져오기
   */
  static getToken(): string | null {
    if (!CSRFProtection.token) {
      CSRFProtection.token = sessionStorage.getItem('csrf_token');
    }
    return CSRFProtection.token;
  }

  /**
   * CSRF 토큰 검증
   */
  static validateToken(receivedToken: string): boolean {
    const storedToken = CSRFProtection.getToken();
    return storedToken !== null && storedToken === receivedToken;
  }

  /**
   * 요청 헤더에 CSRF 토큰 추가
   */
  static addTokenToHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const token = CSRFProtection.getToken();
    if (token) {
      headers[CSRFProtection.TOKEN_HEADER] = token;
    }
    return headers;
  }

  /**
   * CSRF 토큰 초기화
   */
  static initializeToken(): void {
    if (!CSRFProtection.getToken()) {
      CSRFProtection.generateToken();
    }
  }

  /**
   * CSRF 토큰 클리어
   */
  static clearToken(): void {
    CSRFProtection.token = null;
    sessionStorage.removeItem('csrf_token');
  }
}

/**
 * 🔒 Content Security Policy
 */
export class CSPManager {
  /**
   * CSP 헤더 생성
   */
  static generateCSPHeader(): string {
    const policies = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' http://localhost:3001 https://api.openai.com",
      "frame-src 'self' https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    return policies.join('; ');
  }

  /**
   * CSP 메타 태그 생성
   */
  static generateCSPMetaTag(): HTMLMetaElement {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = CSPManager.generateCSPHeader();
    return meta;
  }

  /**
   * CSP 적용
   */
  static applyCSP(): void {
    // 메타 태그가 없으면 추가
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const cspMeta = CSPManager.generateCSPMetaTag();
      document.head.appendChild(cspMeta);
    }
  }
}

/**
 * 🛡️ Rate Limiting (클라이언트 사이드)
 */
export class RateLimiter {
  private static requests = new Map<string, number[]>();
  private static readonly DEFAULT_WINDOW = 60000; // 1분
  private static readonly DEFAULT_LIMIT = 60; // 60 요청/분

  /**
   * 요청 제한 확인
   */
  static checkLimit(
    key: string, 
    limit: number = RateLimiter.DEFAULT_LIMIT, 
    windowMs: number = RateLimiter.DEFAULT_WINDOW
  ): { allowed: boolean; remainingRequests: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // 기존 요청 기록 가져오기
    const requests = RateLimiter.requests.get(key) || [];
    
    // 윈도우 밖의 오래된 요청 제거
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // 현재 요청 추가
    recentRequests.push(now);
    
    // 업데이트된 요청 기록 저장
    RateLimiter.requests.set(key, recentRequests);
    
    const remainingRequests = Math.max(0, limit - recentRequests.length);
    const allowed = recentRequests.length <= limit;
    const resetTime = now + windowMs;

    return { allowed, remainingRequests, resetTime };
  }

  /**
   * 요청 기록 클리어
   */
  static clearRequests(key: string): void {
    RateLimiter.requests.delete(key);
  }

  /**
   * 모든 요청 기록 클리어
   */
  static clearAllRequests(): void {
    RateLimiter.requests.clear();
  }
}

/**
 * 🔐 Secure Token Manager
 */
export class SecureTokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_KEY = 'refresh_token';
  private static readonly ENCRYPTION_KEY = 'encryption_key';

  /**
   * 토큰 암호화 (간단한 XOR 암호화)
   */
  private static encrypt(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result);
  }

  /**
   * 토큰 복호화
   */
  private static decrypt(encryptedText: string, key: string): string {
    try {
      const text = atob(encryptedText);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch {
      return '';
    }
  }

  /**
   * 암호화 키 생성
   */
  private static generateKey(): string {
    // 테스트 환경에서는 고정된 키 사용
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return 'test-encryption-key-12345678';
    }
    
    let key = localStorage.getItem(SecureTokenManager.ENCRYPTION_KEY);
    if (!key) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      key = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SecureTokenManager.ENCRYPTION_KEY, key);
    }
    return key;
  }

  /**
   * 보안 토큰 저장
   */
  static setSecureToken(token: string, isRefreshToken: boolean = false): void {
    const key = SecureTokenManager.generateKey();
    const encrypted = SecureTokenManager.encrypt(token, key);
    const storageKey = isRefreshToken ? SecureTokenManager.REFRESH_KEY : SecureTokenManager.TOKEN_KEY;
    
    sessionStorage.setItem(storageKey, encrypted);
  }

  /**
   * 보안 토큰 가져오기
   */
  static getSecureToken(isRefreshToken: boolean = false): string | null {
    const key = SecureTokenManager.generateKey();
    const storageKey = isRefreshToken ? SecureTokenManager.REFRESH_KEY : SecureTokenManager.TOKEN_KEY;
    const encrypted = sessionStorage.getItem(storageKey);
    
    if (!encrypted) return null;
    
    return SecureTokenManager.decrypt(encrypted, key);
  }

  /**
   * 토큰 만료 시간 확인
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * 토큰 클리어
   */
  static clearTokens(): void {
    sessionStorage.removeItem(SecureTokenManager.TOKEN_KEY);
    sessionStorage.removeItem(SecureTokenManager.REFRESH_KEY);
  }
}

// 초기화
if (typeof window !== 'undefined') {
  // CSRF 토큰 초기화
  CSRFProtection.initializeToken();
  
  // CSP 적용
  CSPManager.applyCSP();
  
  console.log('🛡️ Security systems initialized');
}

export default {
  SecurityValidator,
  CSRFProtection,
  CSPManager,
  RateLimiter,
  SecureTokenManager,
};
