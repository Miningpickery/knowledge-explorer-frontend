// 📜 Virtualized Message List
// 상용화 수준의 가상화된 메시지 목록 (대용량 메시지 처리)

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useVirtualList, usePerformanceMonitor, useIntersectionObserver } from '../hooks/usePerformance';
import type { ChatMessage } from '../types';

interface VirtualizedMessageListProps {
  messages: ChatMessage[];
  containerHeight: number;
  renderMessage: (message: ChatMessage, index: number) => React.ReactNode;
  onScrollToBottom?: () => void;
  onScrollToTop?: () => void;
  className?: string;
  autoScrollToBottom?: boolean;
  estimatedItemHeight?: number;
  overscan?: number;
}

/**
 * 🚀 High-Performance Virtualized Message List
 * 
 * Features:
 * - Virtual scrolling for thousands of messages
 * - Auto-scroll to bottom on new messages
 * - Smooth scrolling animations
 * - Performance monitoring
 * - Intersection observer for scroll events
 * - Dynamic height estimation
 */
export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  containerHeight,
  renderMessage,
  onScrollToBottom,
  onScrollToTop,
  className = '',
  autoScrollToBottom = true,
  estimatedItemHeight = 80,
  overscan = 5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastMessageCountRef = useRef(messages.length);

  // Performance monitoring
  usePerformanceMonitor('VirtualizedMessageList');

  // Intersection observer for bottom detection
  const [bottomSentinelRef, isBottomVisible] = useIntersectionObserver({
    threshold: 0.5,
  });

  // Dynamic height calculation
  const getItemHeight = useCallback((index: number) => {
    return itemHeights.get(index) || estimatedItemHeight;
  }, [itemHeights, estimatedItemHeight]);

  // Virtual list calculation
  const { visibleItems, totalHeight } = useMemo(() => {
    const startIndex = Math.floor(scrollTop / estimatedItemHeight);
    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight) + overscan * 2;
    const endIndex = Math.min(startIndex + visibleCount, messages.length);
    const actualStartIndex = Math.max(0, startIndex - overscan);

    let currentTop = 0;
    const items = [];

    for (let i = actualStartIndex; i < endIndex; i++) {
      const height = getItemHeight(i);
      items.push({
        message: messages[i],
        index: i,
        top: currentTop,
        height,
      });
      currentTop += height;
    }

    // Calculate total height
    let calculatedTotalHeight = 0;
    for (let i = 0; i < messages.length; i++) {
      calculatedTotalHeight += getItemHeight(i);
    }

    return {
      visibleItems: items,
      totalHeight: calculatedTotalHeight,
      startIndex: actualStartIndex,
      endIndex,
    };
  }, [messages, scrollTop, containerHeight, getItemHeight, overscan, estimatedItemHeight]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    
    setScrollTop(newScrollTop);
    setIsUserScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set user scrolling to false after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);

    // Trigger scroll callbacks
    const scrollPercentage = newScrollTop / (target.scrollHeight - target.clientHeight);
    
    if (scrollPercentage > 0.95 && onScrollToBottom) {
      onScrollToBottom();
    }
    
    if (scrollPercentage < 0.05 && onScrollToTop) {
      onScrollToTop();
    }
  }, [onScrollToBottom, onScrollToTop]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (
      autoScrollToBottom &&
      !isUserScrolling &&
      messages.length > lastMessageCountRef.current &&
      containerRef.current
    ) {
      const container = containerRef.current;
      const shouldAutoScroll = 
        container.scrollTop >= container.scrollHeight - container.clientHeight - 100;
      
      if (shouldAutoScroll || lastMessageCountRef.current === 0) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages.length, autoScrollToBottom, isUserScrolling]);

  // Measure item heights for better virtualization
  const measureItemHeight = useCallback((index: number, element: HTMLElement) => {
    const height = element.getBoundingClientRect().height;
    setItemHeights(prev => {
      const newMap = new Map(prev);
      newMap.set(index, height);
      return newMap;
    });
  }, []);

  // Scroll to specific message
  const scrollToMessage = useCallback((index: number) => {
    if (!containerRef.current) return;

    let targetScrollTop = 0;
    for (let i = 0; i < index; i++) {
      targetScrollTop += getItemHeight(i);
    }

    containerRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, [getItemHeight]);

  // Scroll to bottom method
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // Scroll to top method
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Virtualized container */}
      <div
        ref={containerRef}
        className={`h-full overflow-auto ${className}`}
        onScroll={handleScroll}
        style={{ height: containerHeight }}
      >
        {/* Virtual space before visible items */}
        <div style={{ height: visibleItems[0]?.top || 0 }} />
        
        {/* Visible messages */}
        <div className="relative">
          {visibleItems.map(({ message, index, height }) => (
            <MessageWrapper
              key={message.id || index}
              message={message}
              index={index}
              height={height}
              onMeasure={measureItemHeight}
              renderMessage={renderMessage}
            />
          ))}
        </div>
        
        {/* Virtual space after visible items */}
        <div 
          style={{ 
            height: Math.max(0, totalHeight - (visibleItems[visibleItems.length - 1]?.top || 0) - estimatedItemHeight) 
          }} 
        />
        
        {/* Bottom sentinel for intersection observer */}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>

      {/* Scroll controls */}
      <ScrollControls
        onScrollToTop={scrollToTop}
        onScrollToBottom={scrollToBottom}
        isAtBottom={isBottomVisible}
        messageCount={messages.length}
        className="absolute bottom-4 right-4"
      />

      {/* Performance indicators (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceIndicator
          messageCount={messages.length}
          visibleCount={visibleItems.length}
          totalHeight={totalHeight}
          scrollTop={scrollTop}
        />
      )}
    </div>
  );
};

/**
 * 📦 Message Wrapper Component
 */
interface MessageWrapperProps {
  message: ChatMessage;
  index: number;
  height: number;
  onMeasure: (index: number, element: HTMLElement) => void;
  renderMessage: (message: ChatMessage, index: number) => React.ReactNode;
}

const MessageWrapper: React.FC<MessageWrapperProps> = React.memo(({
  message,
  index,
  height,
  onMeasure,
  renderMessage,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      onMeasure(index, elementRef.current);
    }
  }, [index, onMeasure]);

  return (
    <div
      ref={elementRef}
      className="message-wrapper"
      style={{ minHeight: height }}
    >
      {renderMessage(message, index)}
    </div>
  );
});

MessageWrapper.displayName = 'MessageWrapper';

/**
 * 🎮 Scroll Controls Component
 */
interface ScrollControlsProps {
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  isAtBottom: boolean;
  messageCount: number;
  className?: string;
}

const ScrollControls: React.FC<ScrollControlsProps> = ({
  onScrollToTop,
  onScrollToBottom,
  isAtBottom,
  messageCount,
  className = '',
}) => {
  if (messageCount === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {!isAtBottom && (
        <button
          onClick={onScrollToBottom}
          className="p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="맨 아래로"
        >
          ⬇️
        </button>
      )}
      
      <button
        onClick={onScrollToTop}
        className="p-2 bg-gray-600 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="맨 위로"
      >
        ⬆️
      </button>
    </div>
  );
};

/**
 * 📊 Performance Indicator (Development Only)
 */
interface PerformanceIndicatorProps {
  messageCount: number;
  visibleCount: number;
  totalHeight: number;
  scrollTop: number;
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  messageCount,
  visibleCount,
  totalHeight,
  scrollTop,
}) => (
  <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded font-mono">
    <div>Total: {messageCount}</div>
    <div>Visible: {visibleCount}</div>
    <div>Height: {totalHeight.toFixed(0)}px</div>
    <div>Scroll: {scrollTop.toFixed(0)}px</div>
    <div>Ratio: {((visibleCount / messageCount) * 100).toFixed(1)}%</div>
  </div>
);

export default VirtualizedMessageList;
