// ============================================================================
// ERROR HANDLER SERVICE - 통합 에러 처리 및 복구 메커니즘
// ============================================================================

export interface ErrorInfo {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
  retryable: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // 네트워크 에러 처리
  async handleNetworkError(error: any, operation: string): Promise<ErrorInfo> {
    const errorInfo: ErrorInfo = {
      code: 'NETWORK_ERROR',
      message: '네트워크 연결에 문제가 발생했습니다.',
      details: error.message,
      timestamp: new Date().toISOString(),
      retryable: true,
      severity: 'HIGH'
    };

    console.error(`Network error in ${operation}:`, errorInfo);
    return errorInfo;
  }

  // API 에러 처리
  async handleApiError(response: Response, operation: string): Promise<ErrorInfo> {
    let errorInfo: ErrorInfo;

    switch (response.status) {
      case 400:
        errorInfo = {
          code: 'BAD_REQUEST',
          message: '잘못된 요청입니다.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'MEDIUM'
        };
        break;
      case 401:
        errorInfo = {
          code: 'UNAUTHORIZED',
          message: '인증이 필요합니다.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'HIGH'
        };
        break;
      case 403:
        errorInfo = {
          code: 'FORBIDDEN',
          message: '접근 권한이 없습니다.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'HIGH'
        };
        break;
      case 404:
        errorInfo = {
          code: 'NOT_FOUND',
          message: '요청한 리소스를 찾을 수 없습니다.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'MEDIUM'
        };
        break;
      case 429:
        errorInfo = {
          code: 'RATE_LIMITED',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: true,
          severity: 'MEDIUM'
        };
        break;
      case 500:
        errorInfo = {
          code: 'SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: `Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: true,
          severity: 'HIGH'
        };
        break;
      default:
        errorInfo = {
          code: 'UNKNOWN_ERROR',
          message: '알 수 없는 오류가 발생했습니다.',
          details: `Status: ${response.status}, Operation: ${operation}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'MEDIUM'
        };
    }

    console.error(`API error in ${operation}:`, errorInfo);
    return errorInfo;
  }

  // 재시도 로직
  async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.retryConfig, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === finalConfig.maxRetries) {
          throw error;
        }

        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        );

        console.warn(`Retry attempt ${attempt + 1}/${finalConfig.maxRetries} for ${operationName} in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  // 지연 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 사용자 친화적 에러 메시지 생성
  getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    switch (errorInfo.code) {
      case 'NETWORK_ERROR':
        return '인터넷 연결을 확인해주세요.';
      case 'UNAUTHORIZED':
        return '로그인이 필요합니다.';
      case 'FORBIDDEN':
        return '접근 권한이 없습니다.';
      case 'NOT_FOUND':
        return '요청한 내용을 찾을 수 없습니다.';
      case 'RATE_LIMITED':
        return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      case 'SERVER_ERROR':
        return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
  }

  // 에러 로깅
  logError(errorInfo: ErrorInfo, context?: any): void {
    const logEntry = {
      ...errorInfo,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    console.error('Error logged:', logEntry);
    
    // 프로덕션에서는 외부 로깅 서비스로 전송
    if (process.env.NODE_ENV === 'production') {
      // Sentry, LogRocket 등으로 전송
      this.sendToLoggingService(logEntry);
    }
  }

  private sendToLoggingService(logEntry: any): void {
    // 외부 로깅 서비스 전송 로직
    // 실제 구현에서는 Sentry, LogRocket 등을 사용
    console.log('Sending to logging service:', logEntry);
  }
}

// 편의 함수들
export const errorHandler = ErrorHandler.getInstance();

export const handleApiCall = async <T>(
  apiCall: () => Promise<T>,
  operationName: string
): Promise<T> => {
  try {
    return await errorHandler.retryOperation(apiCall, operationName);
  } catch (error) {
    const errorInfo = await errorHandler.handleNetworkError(error, operationName);
    errorHandler.logError(errorInfo);
    throw new Error(errorHandler.getUserFriendlyMessage(errorInfo));
  }
};

export const handleResponse = async <T>(
  response: Response,
  operationName: string
): Promise<T> => {
  if (!response.ok) {
    const errorInfo = await errorHandler.handleApiError(response, operationName);
    errorHandler.logError(errorInfo);
    throw new Error(errorHandler.getUserFriendlyMessage(errorInfo));
  }
  
  return response.json();
};
