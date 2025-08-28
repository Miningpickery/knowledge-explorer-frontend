// 🌐 Advanced HTTP Client
// 상용화 수준의 HTTP 클라이언트 with 에러 처리, 재시도, 인터셉터

import { ErrorHandler, ErrorFactory, ErrorRecoveryManager } from '../utils/errorHandler';
import { useAuthStore } from '../stores/authStore';
import { CSRFProtection, RateLimiter, SecureTokenManager } from '../utils/security';
import type { ApiResponse, ApiError } from '../types';

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipAuth?: boolean;
  skipErrorHandling?: boolean;
  responseType?: 'json' | 'text' | 'blob' | 'stream';
}

export interface RequestInterceptor {
  onRequest?: (url: string, config: RequestConfig) => Promise<{ url: string; config: RequestConfig }>;
  onResponse?: <T>(response: Response, data: T) => Promise<T>;
  onError?: (error: any) => Promise<any>;
}

/**
 * 🚀 Advanced HTTP Client with comprehensive error handling
 */
export class HttpClient {
  private baseURL: string;
  private defaultConfig: RequestConfig;
  private interceptors: RequestInterceptor[] = [];
  private abortControllers = new Map<string, AbortController>();

  constructor(baseURL: string = 'http://localhost:3001', defaultConfig: RequestConfig = {}) {
    this.baseURL = baseURL;
    this.defaultConfig = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      responseType: 'json',
      ...defaultConfig,
    };
  }

  /**
   * 📥 Add request interceptor
   */
  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * 🔥 Main request method
   */
  async request<T = any>(
    endpoint: string, 
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const requestId = this.generateRequestId();
    const fullConfig = { ...this.defaultConfig, ...config };
    const url = this.buildURL(endpoint);

    // Rate limiting check
    const rateLimitKey = `${fullConfig.method || 'GET'}_${endpoint}`;
    const { allowed, remainingRequests } = RateLimiter.checkLimit(rateLimitKey, 100, 60000); // 100 requests per minute
    
    if (!allowed) {
      throw ErrorFactory.createNetworkError('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    try {
      // Apply request interceptors
      let processedUrl = url;
      let processedConfig = fullConfig;
      
      for (const interceptor of this.interceptors) {
        if (interceptor.onRequest) {
          const result = await interceptor.onRequest(processedUrl, processedConfig);
          processedUrl = result.url;
          processedConfig = result.config;
        }
      }

      // Execute with retry logic
      const result = await ErrorRecoveryManager.executeWithRecovery(
        () => this.executeRequest<T>(requestId, processedUrl, processedConfig),
        `http_request_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
        processedConfig.retries,
        processedConfig.retryDelay
      );

      return result;
    } catch (error) {
      this.cleanup(requestId);
      
      if (!fullConfig.skipErrorHandling) {
        const detailedError = ErrorHandler.handle(error, {
          endpoint,
          method: fullConfig.method || 'GET',
          requestId,
          remainingRequests,
        });
        throw detailedError;
      }
      
      throw error;
    }
  }

  /**
   * 🔧 Execute single request
   */
  private async executeRequest<T>(
    requestId: string,
    url: string,
    config: RequestConfig
  ): Promise<ApiResponse<T>> {
    // Setup abort controller
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Setup timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, config.timeout);

    try {
      // Prepare headers
      const headers = await this.buildHeaders(config);

      // Prepare body
      const body = this.buildBody(config.body, headers);

      // Make request
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      // Parse response
      let data: T;
      switch (config.responseType) {
        case 'text':
          data = await response.text() as T;
          break;
        case 'blob':
          data = await response.blob() as T;
          break;
        case 'stream':
          data = response as T;
          break;
        default:
          data = await response.json();
      }

      // Apply response interceptors
      for (const interceptor of this.interceptors) {
        if (interceptor.onResponse) {
          data = await interceptor.onResponse(response, data);
        }
      }

      const apiResponse: ApiResponse<T> = {
        data,
        message: 'Success',
        timestamp: new Date().toISOString(),
      };

      return apiResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw ErrorFactory.createNetworkError('요청이 시간 초과되었습니다.', 408);
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw ErrorFactory.createNetworkError('네트워크 연결을 확인해주세요.', 0);
      }
      
      throw error;
    } finally {
      this.cleanup(requestId);
    }
  }

  /**
   * 🔑 Build headers with authentication and security
   */
  private async buildHeaders(config: RequestConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Add CSRF protection for state-changing operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method || 'GET')) {
      CSRFProtection.addTokenToHeaders(headers);
    }

    // Add security headers
    headers['X-Requested-With'] = 'XMLHttpRequest';
    headers['X-Content-Type-Options'] = 'nosniff';

    // Add authentication if not skipped
    if (!config.skipAuth) {
      // Try secure token first
      let token = SecureTokenManager.getSecureToken();
      
      // Fallback to auth store
      if (!token) {
        const authState = useAuthStore.getState();
        token = authState.token;
      }
      
      if (token) {
        // Check if token is expired
        if (SecureTokenManager.isTokenExpired(token)) {
          try {
            const { refreshAuthToken } = useAuthStore.getState();
            await refreshAuthToken();
            token = useAuthStore.getState().token;
            
            // Update secure storage
            if (token) {
              SecureTokenManager.setSecureToken(token);
            }
          } catch (error) {
            console.warn('Failed to refresh token:', error);
            // Clear invalid tokens
            SecureTokenManager.clearTokens();
          }
        }
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }

    return headers;
  }

  /**
   * 📦 Build request body
   */
  private buildBody(body: any, headers: Record<string, string>): string | FormData | null {
    if (!body) return null;

    // Handle FormData
    if (body instanceof FormData) {
      delete headers['Content-Type']; // Let browser set it
      return body;
    }

    // Handle JSON
    if (headers['Content-Type']?.includes('application/json')) {
      return JSON.stringify(body);
    }

    // Handle URL encoded
    if (headers['Content-Type']?.includes('application/x-www-form-urlencoded')) {
      return new URLSearchParams(body).toString();
    }

    return String(body);
  }

  /**
   * 🚨 Handle HTTP errors
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const apiError: ApiError = {
      code: errorData.error?.code || `HTTP_${response.status}`,
      message: errorData.error?.message || errorData.message || response.statusText,
      details: errorData.error?.details || errorData.details,
    };

    // Create appropriate error based on status
    switch (response.status) {
      case 400:
        throw ErrorFactory.createValidationError(apiError.message);
      case 401:
        throw ErrorFactory.createAuthError(apiError.message, 'UNAUTHORIZED');
      case 403:
        throw ErrorFactory.createAuthError(apiError.message, 'FORBIDDEN');
      case 404:
        throw ErrorFactory.createNetworkError('리소스를 찾을 수 없습니다.', 404, errorData);
      case 429:
        throw ErrorFactory.createNetworkError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429, errorData);
      case 500:
      case 502:
      case 503:
      case 504:
        throw ErrorFactory.createServerError(apiError.message, response.status);
      default:
        throw ErrorFactory.createNetworkError(apiError.message, response.status, errorData);
    }
  }

  /**
   * 🔗 Build full URL
   */
  private buildURL(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    
    const cleanBase = this.baseURL.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    
    return `${cleanBase}/${cleanEndpoint}`;
  }

  /**
   * 🆔 Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 🧹 Cleanup request resources
   */
  private cleanup(requestId: string): void {
    this.abortControllers.delete(requestId);
  }

  /**
   * ❌ Cancel specific request
   */
  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.cleanup(requestId);
    }
  }

  /**
   * 🛑 Cancel all pending requests
   */
  cancelAllRequests(): void {
    for (const [requestId, controller] of this.abortControllers) {
      controller.abort();
      this.cleanup(requestId);
    }
  }

  // Convenience methods
  async get<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  async put<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  async patch<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  async delete<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

// Global HTTP client instance
export const httpClient = new HttpClient();

// Add default interceptors
httpClient.addInterceptor({
  onRequest: async (url, config) => {
    console.log(`🌐 HTTP Request: ${config.method || 'GET'} ${url}`);
    return { url, config };
  },
  
  onResponse: async (response, data) => {
    console.log(`✅ HTTP Response: ${response.status} ${response.url}`);
    return data;
  },
  
  onError: async (error) => {
    console.error(`❌ HTTP Error:`, error);
    throw error;
  },
});

export default httpClient;
