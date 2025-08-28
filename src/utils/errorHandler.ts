// 🚨 Advanced Error Handling System
// 상용화 수준의 중앙 집중식 에러 처리 및 복구 시스템

import type { ApiError } from '../types';
import { useUIStore } from '../stores/uiStore';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown',
}

export interface DetailedError extends Error {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: number;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  retryable: boolean;
  reportable: boolean;
}

export interface ErrorRecoveryStrategy {
  action: 'retry' | 'fallback' | 'redirect' | 'ignore' | 'logout';
  params?: Record<string, any>;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ErrorMetrics {
  errorId: string;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  error: DetailedError;
  recovery?: ErrorRecoveryStrategy;
}

/**
 * 🏭 Error Factory - 표준화된 에러 생성
 */
export class ErrorFactory {
  static createNetworkError(
    message: string, 
    status?: number, 
    response?: any
  ): DetailedError {
    return this.createError({
      name: 'NetworkError',
      message,
      code: `NETWORK_${status || 'UNKNOWN'}`,
      category: ErrorCategory.NETWORK,
      severity: status === 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      context: { status, response },
      userMessage: this.getUserMessage('network', status),
      technicalMessage: message,
      recoverable: true,
      retryable: status !== 400 && status !== 401 && status !== 403,
      reportable: status === 500 || !status,
    });
  }

  static createAuthError(message: string, code: string = 'AUTH_FAILED'): DetailedError {
    return this.createError({
      name: 'AuthenticationError',
      message,
      code,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      userMessage: '인증에 실패했습니다. 다시 로그인해주세요.',
      technicalMessage: message,
      recoverable: true,
      retryable: false,
      reportable: false,
    });
  }

  static createValidationError(
    message: string, 
    field?: string, 
    value?: any
  ): DetailedError {
    return this.createError({
      name: 'ValidationError',
      message,
      code: 'VALIDATION_FAILED',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      context: { field, value },
      userMessage: '입력값을 확인해주세요.',
      technicalMessage: message,
      recoverable: true,
      retryable: false,
      reportable: false,
    });
  }

  static createServerError(message: string, status: number = 500): DetailedError {
    return this.createError({
      name: 'ServerError',
      message,
      code: `SERVER_${status}`,
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.CRITICAL,
      userMessage: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      technicalMessage: message,
      recoverable: true,
      retryable: true,
      reportable: true,
    });
  }

  static createClientError(message: string): DetailedError {
    return this.createError({
      name: 'ClientError',
      message,
      code: 'CLIENT_ERROR',
      category: ErrorCategory.CLIENT,
      severity: ErrorSeverity.MEDIUM,
      userMessage: '요청을 처리하는 중 오류가 발생했습니다.',
      technicalMessage: message,
      recoverable: true,
      retryable: true,
      reportable: true,
    });
  }

  private static createError(config: {
    name: string;
    message: string;
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    context?: Record<string, any>;
    userMessage: string;
    technicalMessage: string;
    recoverable: boolean;
    retryable: boolean;
    reportable: boolean;
  }): DetailedError {
    const error = new Error(config.message) as DetailedError;
    error.name = config.name;
    error.code = config.code;
    error.category = config.category;
    error.severity = config.severity;
    error.context = config.context;
    error.timestamp = Date.now();
    error.userMessage = config.userMessage;
    error.technicalMessage = config.technicalMessage;
    error.recoverable = config.recoverable;
    error.retryable = config.retryable;
    error.reportable = config.reportable;
    
    return error;
  }

  private static getUserMessage(type: string, status?: number): string {
    switch (type) {
      case 'network':
        if (status === 0) return '인터넷 연결을 확인해주세요.';
        if (status === 404) return '요청한 리소스를 찾을 수 없습니다.';
        if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        if (status && status >= 500) return '서버에 문제가 발생했습니다.';
        return '네트워크 오류가 발생했습니다.';
      default:
        return '알 수 없는 오류가 발생했습니다.';
    }
  }
}

/**
 * 🔄 Error Recovery Manager - 에러 복구 전략 관리
 */
export class ErrorRecoveryManager {
  private static retryAttempts = new Map<string, number>();
  private static retryTimeouts = new Map<string, NodeJS.Timeout>();

  static async executeWithRecovery<T>(
    operation: () => Promise<T>,
    errorKey: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    try {
      const result = await operation();
      this.clearRetryState(errorKey);
      return result;
    } catch (error) {
      const attempts = this.retryAttempts.get(errorKey) || 0;
      
      if (attempts < maxRetries && this.shouldRetry(error)) {
        this.retryAttempts.set(errorKey, attempts + 1);
        
        console.log(`🔄 재시도 ${attempts + 1}/${maxRetries} - ${errorKey}`);
        
        await this.delay(retryDelay * Math.pow(2, attempts)); // Exponential backoff
        return this.executeWithRecovery(operation, errorKey, maxRetries, retryDelay);
      } else {
        this.clearRetryState(errorKey);
        throw error;
      }
    }
  }

  private static shouldRetry(error: any): boolean {
    if (error instanceof Error && 'retryable' in error) {
      return (error as DetailedError).retryable;
    }
    
    // Default retry logic for network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }
    
    return false;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static clearRetryState(errorKey: string): void {
    this.retryAttempts.delete(errorKey);
    const timeout = this.retryTimeouts.get(errorKey);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(errorKey);
    }
  }
}

/**
 * 📊 Error Reporter - 에러 보고 및 분석
 */
export class ErrorReporter {
  private static errorBuffer: ErrorMetrics[] = [];
  private static maxBufferSize = 50;

  static reportError(error: DetailedError, context?: Record<string, any>): void {
    if (!error.reportable) return;

    const metrics: ErrorMetrics = {
      errorId: this.generateErrorId(error),
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.getSessionId(),
      error,
      ...context,
    };

    this.errorBuffer.push(metrics);
    
    // Maintain buffer size
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.shift();
    }

    // Report critical errors immediately
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.sendErrorReport(metrics);
    }

    console.error('🚨 Error Reported:', {
      id: metrics.errorId,
      category: error.category,
      severity: error.severity,
      message: error.technicalMessage,
      context: error.context,
    });
  }

  private static generateErrorId(error: DetailedError): string {
    const hash = this.simpleHash(error.code + error.message + error.timestamp);
    return `ERR_${hash}`;
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private static getSessionId(): string {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  private static async sendErrorReport(metrics: ErrorMetrics): Promise<void> {
    try {
      // In a real application, send to error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metrics),
      // });
      
      console.log('📤 Error report sent:', metrics.errorId);
    } catch (error) {
      console.warn('Failed to send error report:', error);
    }
  }

  static getErrorStats() {
    const categories = this.errorBuffer.reduce((acc, metrics) => {
      const category = metrics.error.category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severities = this.errorBuffer.reduce((acc, metrics) => {
      const severity = metrics.error.severity;
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.errorBuffer.length,
      categories,
      severities,
      recent: this.errorBuffer.slice(-10),
    };
  }
}

/**
 * 🎯 Main Error Handler - 통합 에러 처리
 */
export class ErrorHandler {
  static handle(error: unknown, context?: Record<string, any>): DetailedError {
    let detailedError: DetailedError;

    // Convert unknown error to DetailedError
    if (error instanceof Error && 'code' in error) {
      detailedError = error as DetailedError;
    } else if (error instanceof Error) {
      detailedError = this.convertToDetailedError(error);
    } else {
      detailedError = ErrorFactory.createClientError(String(error));
    }

    // Add context if provided
    if (context) {
      detailedError.context = { ...detailedError.context, ...context };
    }

    // Report error
    ErrorReporter.reportError(detailedError, context);

    // Show user notification
    this.showUserNotification(detailedError);

    // Execute recovery strategy if available
    this.executeRecoveryStrategy(detailedError);

    return detailedError;
  }

  private static convertToDetailedError(error: Error): DetailedError {
    // Detect error type and convert appropriately
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return ErrorFactory.createNetworkError(error.message);
    }
    
    return ErrorFactory.createClientError(error.message);
  }

  private static showUserNotification(error: DetailedError): void {
    const { addNotification } = useUIStore.getState();
    
    let notificationType: 'error' | 'warning' | 'info' = 'error';
    if (error.severity === ErrorSeverity.LOW) notificationType = 'warning';
    if (error.severity === ErrorSeverity.MEDIUM) notificationType = 'info';

    addNotification({
      type: notificationType,
      title: this.getNotificationTitle(error),
      message: error.userMessage,
      duration: error.severity === ErrorSeverity.CRITICAL ? 0 : 5000, // Critical errors persist
      action: error.recoverable ? {
        label: '다시 시도',
        callback: () => this.executeRecoveryStrategy(error),
      } : undefined,
    });
  }

  private static getNotificationTitle(error: DetailedError): string {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return '연결 오류';
      case ErrorCategory.AUTHENTICATION:
        return '인증 오류';
      case ErrorCategory.AUTHORIZATION:
        return '권한 오류';
      case ErrorCategory.VALIDATION:
        return '입력 오류';
      case ErrorCategory.SERVER:
        return '서버 오류';
      default:
        return '오류 발생';
    }
  }

  private static executeRecoveryStrategy(error: DetailedError): void {
    if (!error.recoverable) return;

    switch (error.category) {
      case ErrorCategory.AUTHENTICATION:
        // Redirect to login
        window.location.href = '/auth/login';
        break;
      case ErrorCategory.NETWORK:
        if (error.retryable) {
          // Retry will be handled by the calling code
          console.log('🔄 네트워크 오류 재시도 가능');
        }
        break;
      default:
        console.log('🔧 복구 전략 없음');
    }
  }

  // Utility methods
  static isNetworkError(error: unknown): boolean {
    return error instanceof Error && 
           ('category' in error && (error as DetailedError).category === ErrorCategory.NETWORK);
  }

  static isAuthError(error: unknown): boolean {
    return error instanceof Error && 
           ('category' in error && (error as DetailedError).category === ErrorCategory.AUTHENTICATION);
  }

  static isCritical(error: unknown): boolean {
    return error instanceof Error && 
           ('severity' in error && (error as DetailedError).severity === ErrorSeverity.CRITICAL);
  }
}

// Global error handlers
if (typeof window !== 'undefined') {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
    ErrorHandler.handle(event.reason, { type: 'unhandledRejection' });
    event.preventDefault(); // Prevent default browser error reporting
  });

  // Catch global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
    ErrorHandler.handle(event.error, { 
      type: 'globalError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

export default ErrorHandler;
