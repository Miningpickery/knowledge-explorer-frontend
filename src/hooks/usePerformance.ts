// ⚡ Performance Optimization Hooks
// 상용화 수준의 React 성능 최적화 유틸리티

import { 
  useCallback, 
  useMemo, 
  useRef, 
  useEffect, 
  useState,
  DependencyList,
  EffectCallback
} from 'react';
import { useUIStore } from '../stores/uiStore';

/**
 * 🔄 Advanced Debounced Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 🎯 Throttled Hook
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * 💾 Memoized Callback with Deep Dependency Comparison
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T {
  const ref = useRef<T>();
  const depsRef = useRef<DependencyList>();

  // Deep compare dependencies
  const depsChanged = useMemo(() => {
    if (!depsRef.current) return true;
    if (depsRef.current.length !== deps.length) return true;
    
    return deps.some((dep, index) => {
      const prevDep = depsRef.current![index];
      return !Object.is(dep, prevDep);
    });
  }, deps);

  if (depsChanged) {
    ref.current = callback;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return ref.current!(...args);
  }, []) as T;
}

/**
 * 🔄 Async Operation with Cancellation
 */
export function useAsyncOperation<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  cancel: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      
      // Check if operation was cancelled
      if (!currentController.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (!currentController.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!currentController.signal.aborted) {
        setLoading(false);
      }
    }
  }, deps);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    execute();
    
    return () => {
      cancel();
    };
  }, [execute, cancel]);

  return {
    data,
    loading,
    error,
    retry: execute,
    cancel,
  };
}

/**
 * 📊 Performance Monitor Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const { updatePerformanceMetrics } = useUIStore();

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;

    updatePerformanceMetrics({
      renderTime,
      lastUpdate: Date.now(),
    });

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`);
      
      // Warn about slow renders
      if (renderTime > 16) { // 60fps = 16.67ms per frame
        console.warn(`⚠️ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    }
  });

  return {
    renderCount: renderCount.current,
    renderTime: performance.now() - renderStartTime.current,
  };
}

/**
 * 📱 Intersection Observer Hook for Lazy Loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * 🎭 Virtual List Hook for Large Data Sets
 */
interface VirtualListOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions
) {
  const [scrollTop, setScrollTop] = useState(0);
  const { itemHeight, containerHeight, overscan = 3 } = options;

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    const actualStartIndex = Math.max(0, startIndex - overscan);

    return {
      items: items.slice(actualStartIndex, endIndex).map((item, index) => ({
        item,
        index: actualStartIndex + index,
        top: (actualStartIndex + index) * itemHeight,
      })),
      totalHeight: items.length * itemHeight,
      startIndex: actualStartIndex,
      endIndex,
    };
  }, [items, scrollTop, itemHeight, containerHeight, overscan]);

  const scrollElementProps = useMemo(() => ({
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
    style: {
      height: containerHeight,
      overflow: 'auto' as const,
    },
  }), [containerHeight]);

  return {
    visibleItems,
    scrollElementProps,
    totalHeight: visibleItems.totalHeight,
  };
}

/**
 * 🔄 Optimized Effect Hook (runs only when dependencies actually change)
 */
export function useOptimizedEffect(
  effect: EffectCallback,
  deps: DependencyList
): void {
  const prevDepsRef = useRef<DependencyList>();
  const cleanupRef = useRef<(() => void) | void>();

  useEffect(() => {
    // Deep compare dependencies
    const depsChanged = !prevDepsRef.current || 
      prevDepsRef.current.length !== deps.length ||
      deps.some((dep, index) => !Object.is(dep, prevDepsRef.current![index]));

    if (depsChanged) {
      // Cleanup previous effect
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Run new effect
      cleanupRef.current = effect();
      prevDepsRef.current = deps;
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  });
}

/**
 * 💨 Lazy Component Loading Hook
 */
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): {
  Component: T | null;
  loading: boolean;
  error: Error | null;
} {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    importFn()
      .then((module) => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [importFn]);

  return { Component, loading, error };
}

/**
 * 🎯 Resource Preloader Hook
 */
export function useResourcePreloader() {
  const preloadedResources = useRef(new Set<string>());

  const preloadImage = useCallback((src: string): Promise<void> => {
    if (preloadedResources.current.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        preloadedResources.current.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const preloadScript = useCallback((src: string): Promise<void> => {
    if (preloadedResources.current.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => {
        preloadedResources.current.add(src);
        resolve();
      };
      script.onerror = reject;
      script.src = src;
      document.head.appendChild(script);
    });
  }, []);

  const preloadComponent = useCallback((importFn: () => Promise<any>): Promise<void> => {
    const key = importFn.toString();
    if (preloadedResources.current.has(key)) {
      return Promise.resolve();
    }

    return importFn().then(() => {
      preloadedResources.current.add(key);
    });
  }, []);

  return {
    preloadImage,
    preloadScript,
    preloadComponent,
    isPreloaded: (src: string) => preloadedResources.current.has(src),
  };
}

/**
 * 🧠 Memoized Selector Hook (for complex state selections)
 */
export function useMemoizedSelector<TState, TSelected>(
  selector: (state: TState) => TSelected,
  state: TState,
  equalityFn?: (a: TSelected, b: TSelected) => boolean
): TSelected {
  const previousValueRef = useRef<TSelected>();
  const previousStateRef = useRef<TState>();

  const currentValue = useMemo(() => {
    // If state hasn't changed, return previous value
    if (Object.is(state, previousStateRef.current) && previousValueRef.current !== undefined) {
      return previousValueRef.current;
    }

    const newValue = selector(state);

    // If we have a custom equality function, use it
    if (equalityFn && previousValueRef.current !== undefined) {
      if (equalityFn(previousValueRef.current, newValue)) {
        return previousValueRef.current;
      }
    }

    previousValueRef.current = newValue;
    previousStateRef.current = state;
    return newValue;
  }, [state, selector, equalityFn]);

  return currentValue;
}

export default {
  useDebounce,
  useThrottle,
  useStableCallback,
  useAsyncOperation,
  usePerformanceMonitor,
  useIntersectionObserver,
  useVirtualList,
  useOptimizedEffect,
  useLazyComponent,
  useResourcePreloader,
  useMemoizedSelector,
};
