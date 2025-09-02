// ============================================================================
// PERFORMANCE SERVICE - 성능 최적화 및 모니터링
// ============================================================================

export interface PerformanceMetrics {
  apiResponseTime: number;
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  cacheHitRate: number;
}

export interface CacheConfig {
  maxSize: number;
  ttl: number; // milliseconds
  enableCompression: boolean;
}

export class PerformanceService {
  private static instance: PerformanceService;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private metrics: PerformanceMetrics = {
    apiResponseTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0
  };

  private config: CacheConfig = {
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5분
    enableCompression: false
  };

  private cacheHits = 0;
  private cacheMisses = 0;

  private constructor() {
    this.initializePerformanceMonitoring();
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  // 성능 모니터링 초기화
  private initializePerformanceMonitoring(): void {
    // 메모리 사용량 모니터링
    if ('memory' in performance) {
      setInterval(() => {
        this.updateMemoryUsage();
      }, 30000); // 30초마다
    }

    // 캐시 정리
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // 1분마다
  }

  // 캐시 설정
  setCacheConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 캐시에 데이터 저장
  setCache(key: string, data: any, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldestCache();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl
    });
  }

  // 캐시에서 데이터 조회
  getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.cacheMisses++;
      this.updateCacheHitRate();
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      this.updateCacheHitRate();
      return null;
    }

    this.cacheHits++;
    this.updateCacheHitRate();
    return cached.data as T;
  }

  // 캐시에서 데이터 삭제
  deleteCache(key: string): boolean {
    return this.cache.delete(key);
  }

  // 캐시 전체 삭제
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.updateCacheHitRate();
  }

  // 가장 오래된 캐시 제거
  private evictOldestCache(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 만료된 캐시 정리
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // 캐시 히트율 업데이트
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  // 메모리 사용량 업데이트
  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100;
    }
  }

  // API 응답 시간 측정
  async measureApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const endTime = performance.now();
      
      this.metrics.apiResponseTime = endTime - startTime;
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.metrics.apiResponseTime = endTime - startTime;
      throw error;
    }
  }

  // 렌더링 시간 측정
  measureRenderTime(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      this.metrics.renderTime = endTime - startTime;
      
      console.log(`${componentName} render time: ${this.metrics.renderTime.toFixed(2)}ms`);
    };
  }

  // 네트워크 지연 시간 측정
  async measureNetworkLatency(url: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      await fetch(url, { method: 'HEAD' });
      const endTime = performance.now();
      
      this.metrics.networkLatency = endTime - startTime;
      return this.metrics.networkLatency;
    } catch (error) {
      console.error('Failed to measure network latency:', error);
      return -1;
    }
  }

  // 성능 메트릭 조회
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // 캐시 통계 조회
  getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.metrics.cacheHitRate
    };
  }

  // 성능 최적화 권장사항
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.apiResponseTime > 1000) {
      recommendations.push('API 응답 시간이 느립니다. 서버 성능을 확인해주세요.');
    }

    if (this.metrics.renderTime > 100) {
      recommendations.push('렌더링 시간이 느립니다. 컴포넌트 최적화를 고려해주세요.');
    }

    if (this.metrics.memoryUsage > 80) {
      recommendations.push('메모리 사용량이 높습니다. 메모리 누수를 확인해주세요.');
    }

    if (this.metrics.cacheHitRate < 50) {
      recommendations.push('캐시 히트율이 낮습니다. 캐시 전략을 개선해주세요.');
    }

    return recommendations;
  }

  // 성능 리포트 생성
  generatePerformanceReport(): any {
    return {
      metrics: this.getMetrics(),
      cacheStats: this.getCacheStats(),
      recommendations: this.getOptimizationRecommendations(),
      timestamp: new Date().toISOString()
    };
  }
}

// 편의 함수들
export const performanceService = PerformanceService.getInstance();

// 성능 측정 데코레이터
export const measurePerformance = (operationName: string) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      
      try {
        const result = await method.apply(this, args);
        const endTime = performance.now();
        
        console.log(`${operationName} took ${(endTime - startTime).toFixed(2)}ms`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        console.error(`${operationName} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
        throw error;
      }
    };
  };
};

// 캐시 데코레이터
export const cacheResult = (ttl?: number) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyName}_${JSON.stringify(args)}`;
      
      // 캐시에서 조회
      const cached = performanceService.getCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 메서드 실행
      const result = await method.apply(this, args);
      
      // 결과 캐시
      performanceService.setCache(cacheKey, result, ttl);
      
      return result;
    };
  };
};
