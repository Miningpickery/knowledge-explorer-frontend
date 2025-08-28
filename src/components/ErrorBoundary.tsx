// 🛡️ React Error Boundary with Recovery
// 상용화 수준의 에러 경계 컴포넌트

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorHandler, ErrorFactory, ErrorSeverity } from '../utils/errorHandler';
import type { DetailedError } from '../utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: (error: DetailedError, retry: () => void) => ReactNode;
  onError?: (error: DetailedError, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // If true, only catches errors from direct children
}

interface State {
  hasError: boolean;
  error: DetailedError | null;
  errorId: string | null;
  retryCount: number;
}

/**
 * 🛡️ Advanced Error Boundary with automatic recovery
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryDelay = 2000;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Convert to DetailedError
    const detailedError = ErrorFactory.createClientError(
      `React component error: ${error.message}`
    );
    
    detailedError.severity = ErrorSeverity.HIGH;
    detailedError.context = {
      stack: error.stack,
      componentStack: true,
    };

    return {
      hasError: true,
      error: detailedError,
      errorId: `boundary_${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const detailedError = this.state.error;
    
    if (detailedError) {
      // Add React-specific context
      detailedError.context = {
        ...detailedError.context,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      };

      // Handle the error
      ErrorHandler.handle(detailedError, {
        type: 'React Error Boundary',
        componentStack: errorInfo.componentStack,
      });

      // Call custom error handler
      this.props.onError?.(detailedError, errorInfo);

      // Attempt automatic recovery for recoverable errors
      if (detailedError.recoverable && this.state.retryCount < this.maxRetries) {
        this.scheduleRetry();
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private scheduleRetry = () => {
    this.retryTimeoutId = setTimeout(() => {
      this.retry();
    }, this.retryDelay * Math.pow(2, this.state.retryCount)); // Exponential backoff
  };

  private retry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: prevState.retryCount + 1,
    }));

    console.log(`🔄 Error Boundary 자동 복구 시도 ${this.state.retryCount + 1}/${this.maxRetries}`);
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0, // Reset retry count on manual retry
    });

    console.log('🔄 Error Boundary 수동 복구');
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleManualRetry);
      }

      // Default error UI
      return (
        <DefaultErrorFallback 
          error={this.state.error}
          retry={this.handleManualRetry}
          retryCount={this.state.retryCount}
          maxRetries={this.maxRetries}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 🎨 Default Error Fallback Component
 */
interface DefaultErrorFallbackProps {
  error: DetailedError;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  retry,
  retryCount,
  maxRetries,
}) => {
  const getSeverityColor = () => {
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case ErrorSeverity.MEDIUM:
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case ErrorSeverity.HIGH:
        return 'bg-red-50 border-red-200 text-red-800';
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = () => {
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return '⚠️';
      case ErrorSeverity.MEDIUM:
        return '🔶';
      case ErrorSeverity.HIGH:
        return '🚨';
      case ErrorSeverity.CRITICAL:
        return '💥';
      default:
        return '❓';
    }
  };

  const canRetry = retryCount < maxRetries && error.recoverable;

  return (
    <div className={`p-6 rounded-lg border-2 m-4 ${getSeverityColor()}`}>
      <div className="flex items-start space-x-3">
        <span className="text-2xl">{getSeverityIcon()}</span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">
            문제가 발생했습니다
          </h3>
          
          <p className="text-sm mb-4">
            {error.userMessage}
          </p>

          {error.severity === ErrorSeverity.CRITICAL && (
            <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
              <p className="text-sm font-medium text-red-800">
                심각한 오류가 발생했습니다. 페이지를 새로고침하거나 관리자에게 문의해주세요.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canRetry && (
              <button
                onClick={retry}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                다시 시도 ({maxRetries - retryCount}번 남음)
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
            >
              페이지 새로고침
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
            >
              이전 페이지
            </button>
          </div>

          {/* Development info */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                개발자 정보 (개발 환경에서만 표시)
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
                <p><strong>Error Code:</strong> {error.code}</p>
                <p><strong>Category:</strong> {error.category}</p>
                <p><strong>Severity:</strong> {error.severity}</p>
                <p><strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}</p>
                {error.context && (
                  <div>
                    <strong>Context:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </div>
                )}
                <p><strong>Technical Message:</strong> {error.technicalMessage}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 Specialized Error Boundaries
 */

// For wrapping individual features
export const FeatureErrorBoundary: React.FC<{ children: ReactNode; featureName: string }> = ({ 
  children, 
  featureName 
}) => (
  <ErrorBoundary
    fallback={(error, retry) => (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <strong>{featureName}</strong> 기능에서 오류가 발생했습니다.
        </p>
        <button
          onClick={retry}
          className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
        >
          다시 시도
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

// For wrapping async operations
export const AsyncErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={(error, retry) => (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <p className="text-gray-600 mb-4">데이터를 불러오는 중 오류가 발생했습니다.</p>
          <button
            onClick={retry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
