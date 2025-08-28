/**
 * ❌ 에러 핸들러 - 상용화 수준 에러 관리 시스템
 * @description 통합된 에러 처리, 로깅, 복구 메커니즘
 */

import { AppError, ErrorCode } from '../../business/types/chat.types';
import { Logger } from '../logger/Logger';
import { NotificationService } from '../notifications/NotificationService';

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<ErrorCode, string> = {
    NETWORK_ERROR: '네트워크 연결에 문제가 발생했습니다.',
    AUTH_ERROR: '인증에 실패했습니다. 다시 로그인해주세요.',
    VALIDATION_ERROR: '입력 데이터가 올바르지 않습니다.',
    NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
    PERMISSION_DENIED: '접근 권한이 없습니다.',
    RATE_LIMITED: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    SERVER_ERROR: '서버에서 오류가 발생했습니다.',
    UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.'
  };

  private static readonly RECOVERABLE_ERRORS: Set<ErrorCode> = new Set([
    'NETWORK_ERROR',
    'RATE_LIMITED',
    'SERVER_ERROR'
  ]);

  private static readonly SILENT_ERRORS: Set<ErrorCode> = new Set([
    'RATE_LIMITED' // 이미 사용자에게 표시된 경우
  ]);

  /**
   * 🎯 메인 에러 처리 함수
   */
  static handle(error: unknown, context?: string): AppError {
    const appError = this.normalizeError(error, context);
    
    // 로깅
    this.logError(appError);
    
    // 사용자 알림 (필요한 경우)
    if (!this.SILENT_ERRORS.has(appError.code)) {
      NotificationService.showError({
        title: '오류 발생',
        message: appError.message,
        recoverable: appError.recoverable,
        onRetry: appError.recoverable ? () => this.handleRetry(appError) : undefined
      });
    }
    
    // 원격 에러 리포팅 (프로덕션 환경)
    if (process.env.NODE_ENV === 'production') {
      this.reportError(appError);
    }
    
    return appError;
  }

  /**
   * 🔄 재시도 가능한 에러 처리
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const appError = this.normalizeError(error, context);
        
        // 재시도 불가능한 에러는 즉시 던지기
        if (!this.RECOVERABLE_ERRORS.has(appError.code)) {
          throw appError;
        }
        
        // 마지막 시도였다면 에러 던지기
        if (attempt === maxAttempts) {
          break;
        }
        
        // 다음 시도 전 지연
        await this.sleep(delay * attempt);
        
        Logger.warn(`재시도 ${attempt}/${maxAttempts}`, {
          error: appError.message,
          context,
          nextDelay: delay * (attempt + 1)
        });
      }
    }
    
    throw this.handle(lastError!, `${context} (${maxAttempts}회 재시도 실패)`);
  }

  /**
   * 🔄 비동기 작업 래퍼 (자동 에러 처리)
   */
  static wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw this.handle(error, context);
      }
    };
  }

  /**
   * 🎭 에러 정규화 (모든 에러를 AppError로 변환)
   */
  private static normalizeError(error: unknown, context?: string): AppError {
    const timestamp = new Date().toISOString();
    
    // 이미 AppError인 경우
    if (this.isAppError(error)) {
      return {
        ...error,
        context: { ...error.context, additionalContext: context }
      };
    }
    
    // Error 객체인 경우
    if (error instanceof Error) {
      const code = this.inferErrorCode(error);
      return {
        name: 'AppError',
        message: this.ERROR_MESSAGES[code] || error.message,
        code,
        context: { originalMessage: error.message, context },
        timestamp,
        recoverable: this.RECOVERABLE_ERRORS.has(code),
        stack: error.stack
      };
    }
    
    // 문자열 에러인 경우
    if (typeof error === 'string') {
      return {
        name: 'AppError',
        message: error,
        code: 'UNKNOWN_ERROR',
        context: { context },
        timestamp,
        recoverable: false
      };
    }
    
    // 객체 에러인 경우 (API 에러 등)
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      const code = this.inferErrorCodeFromObject(errorObj);
      
      return {
        name: 'AppError',
        message: this.ERROR_MESSAGES[code] || errorObj.message || '알 수 없는 오류',
        code,
        context: { originalError: errorObj, context },
        timestamp,
        recoverable: this.RECOVERABLE_ERRORS.has(code)
      };
    }
    
    // 기타 모든 경우
    return {
      name: 'AppError',
      message: '알 수 없는 오류가 발생했습니다.',
      code: 'UNKNOWN_ERROR',
      context: { originalError: String(error), context },
      timestamp,
      recoverable: false
    };
  }

  /**
   * 🔍 에러 코드 추론
   */
  private static inferErrorCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();
    
    // 네트워크 에러
    if (
      message.includes('network') || 
      message.includes('fetch') || 
      message.includes('connection') ||
      error.name === 'NetworkError'
    ) {
      return 'NETWORK_ERROR';
    }
    
    // 인증 에러
    if (
      message.includes('unauthorized') || 
      message.includes('authentication') ||
      message.includes('token')
    ) {
      return 'AUTH_ERROR';
    }
    
    // 권한 에러
    if (
      message.includes('forbidden') || 
      message.includes('permission') ||
      message.includes('access denied')
    ) {
      return 'PERMISSION_DENIED';
    }
    
    // Not Found
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
    
    // Rate Limiting
    if (
      message.includes('rate limit') || 
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return 'RATE_LIMITED';
    }
    
    // 서버 에러
    if (
      message.includes('server error') || 
      message.includes('internal error') ||
      message.includes('500')
    ) {
      return 'SERVER_ERROR';
    }
    
    // 검증 에러
    if (
      message.includes('validation') || 
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return 'VALIDATION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 🔍 객체에서 에러 코드 추론
   */
  private static inferErrorCodeFromObject(errorObj: any): ErrorCode {
    // HTTP 상태 코드 기반
    if (errorObj.status || errorObj.statusCode) {
      const status = errorObj.status || errorObj.statusCode;
      
      if (status === 401) return 'AUTH_ERROR';
      if (status === 403) return 'PERMISSION_DENIED';
      if (status === 404) return 'NOT_FOUND';
      if (status === 429) return 'RATE_LIMITED';
      if (status >= 500) return 'SERVER_ERROR';
      if (status >= 400) return 'VALIDATION_ERROR';
    }
    
    // 에러 코드 필드가 있는 경우
    if (errorObj.code) {
      const code = errorObj.code.toUpperCase();
      if (Object.values(this.ERROR_MESSAGES).includes(code)) {
        return code as ErrorCode;
      }
    }
    
    // 메시지 기반 추론
    if (errorObj.message) {
      const fakeError = new Error(errorObj.message);
      return this.inferErrorCode(fakeError);
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 🎯 AppError 타입 가드
   */
  private static isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'timestamp' in error &&
      'recoverable' in error
    );
  }

  /**
   * 📝 에러 로깅
   */
  private static logError(error: AppError): void {
    const logData = {
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp,
      recoverable: error.recoverable,
      stack: error.stack
    };
    
    if (error.recoverable) {
      Logger.warn('복구 가능한 에러 발생', logData);
    } else {
      Logger.error('심각한 에러 발생', logData);
    }
  }

  /**
   * 📡 원격 에러 리포팅
   */
  private static async reportError(error: AppError): Promise<void> {
    try {
      // 실제 프로덕션에서는 Sentry, LogRocket 등의 서비스 사용
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: error.code,
          message: error.message,
          context: error.context,
          timestamp: error.timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.getCurrentUserId()
        })
      });
    } catch (reportError) {
      Logger.error('에러 리포팅 실패', reportError);
    }
  }

  /**
   * 🔄 재시도 처리
   */
  private static handleRetry(error: AppError): void {
    Logger.info('사용자가 재시도 선택', { errorCode: error.code });
    
    // 재시도 로직은 각 컨텍스트에서 구현
    // 여기서는 페이지 새로고침 등의 기본 동작 수행
    if (error.code === 'NETWORK_ERROR') {
      // 네트워크 상태 확인 후 재시도
      window.location.reload();
    }
  }

  /**
   * 🛠️ 유틸리티 함수들
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static getCurrentUserId(): string | null {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || null;
    } catch {
      return null;
    }
  }
}

/**
 * 🎯 에러 핸들링 데코레이터 (클래스 메서드용)
 */
export function HandleErrors(context?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        throw ErrorHandler.handle(error, context || `${target.constructor.name}.${propertyKey}`);
      }
    };
    
    return descriptor;
  };
}

/**
 * 🎯 글로벌 에러 핸들러 설정
 */
export function setupGlobalErrorHandlers(): void {
  // Promise rejection 핸들러
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    ErrorHandler.handle(event.reason, 'Unhandled Promise Rejection');
  });
  
  // JavaScript 에러 핸들러
  window.addEventListener('error', (event) => {
    ErrorHandler.handle(event.error, 'Uncaught JavaScript Error');
  });
  
  Logger.info('글로벌 에러 핸들러 설정 완료');
}
