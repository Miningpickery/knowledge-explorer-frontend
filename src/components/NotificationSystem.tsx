// 🔔 Advanced Notification System
// 상용화 수준의 알림 시스템 with 애니메이션 및 상호작용

import React, { useEffect, useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import type { Notification } from '../types';

/**
 * 🎯 Main Notification System Component
 */
export const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

/**
 * 🎨 Individual Notification Item
 */
interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-dismiss after duration
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Animation duration
  };

  const getNotificationStyles = () => {
    const baseStyles = "transform transition-all duration-300 ease-in-out";
    const visibilityStyles = isVisible && !isLeaving
      ? "translate-x-0 opacity-100"
      : "translate-x-full opacity-0";

    const typeStyles = {
      success: "bg-green-50 border-green-200 text-green-800",
      error: "bg-red-50 border-red-200 text-red-800",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
      info: "bg-blue-50 border-blue-200 text-blue-800",
    };

    return `${baseStyles} ${visibilityStyles} ${typeStyles[notification.type]} border rounded-lg shadow-lg p-4 max-w-sm`;
  };

  const getIcon = () => {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };
    return icons[notification.type];
  };

  const getProgressColor = () => {
    const colors = {
      success: "bg-green-500",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      info: "bg-blue-500",
    };
    return colors[notification.type];
  };

  return (
    <div className={getNotificationStyles()}>
      {/* Progress bar for timed notifications */}
      {notification.duration && notification.duration > 0 && (
        <NotificationProgress
          duration={notification.duration}
          color={getProgressColor()}
          onComplete={handleDismiss}
        />
      )}

      <div className="flex items-start space-x-3">
        <span className="text-lg flex-shrink-0">{getIcon()}</span>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{notification.title}</h4>
          {notification.message && (
            <p className="text-sm mt-1 opacity-90">{notification.message}</p>
          )}
          
          {notification.action && (
            <button
              onClick={() => {
                notification.action!.callback();
                handleDismiss();
              }}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-lg opacity-50 hover:opacity-100 transition-opacity"
          aria-label="알림 닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
};

/**
 * ⏱️ Progress Bar for Timed Notifications
 */
interface NotificationProgressProps {
  duration: number;
  color: string;
  onComplete: () => void;
}

const NotificationProgress: React.FC<NotificationProgressProps> = ({ 
  duration, 
  color, 
  onComplete 
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = 50; // Update every 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - step;
        if (newProgress <= 0) {
          onComplete();
          return 0;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, onComplete, isPaused]);

  return (
    <div 
      className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`h-full transition-all duration-75 ease-linear ${color}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/**
 * 🎮 Notification Hook for easy usage
 */
export const useNotifications = () => {
  const { addNotification, removeNotification, clearNotifications } = useUIStore();

  const showSuccess = (title: string, message?: string, options?: Partial<Notification>) => {
    addNotification({
      type: 'success',
      title,
      message,
      duration: 5000,
      ...options,
    });
  };

  const showError = (title: string, message?: string, options?: Partial<Notification>) => {
    addNotification({
      type: 'error',
      title,
      message,
      duration: 0, // Errors persist until dismissed
      ...options,
    });
  };

  const showWarning = (title: string, message?: string, options?: Partial<Notification>) => {
    addNotification({
      type: 'warning',
      title,
      message,
      duration: 7000,
      ...options,
    });
  };

  const showInfo = (title: string, message?: string, options?: Partial<Notification>) => {
    addNotification({
      type: 'info',
      title,
      message,
      duration: 5000,
      ...options,
    });
  };

  const showLoadingWithAction = (
    title: string,
    actionLabel: string,
    actionCallback: () => void,
    message?: string
  ) => {
    addNotification({
      type: 'info',
      title,
      message,
      duration: 0,
      action: {
        label: actionLabel,
        callback: actionCallback,
      },
    });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoadingWithAction,
    dismiss: removeNotification,
    clearAll: clearNotifications,
  };
};

/**
 * 🎭 Specialized Notification Components
 */

// Network status notification
export const NetworkStatusNotification: React.FC = () => {
  const { showWarning, showSuccess } = useNotifications();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showSuccess('연결 복구', '인터넷 연결이 복구되었습니다.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showWarning(
        '연결 끊어짐', 
        '인터넷 연결을 확인해주세요. 일부 기능이 제한될 수 있습니다.',
        { duration: 0 }
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showWarning, showSuccess]);

  return null; // This component only manages notifications
};

// API error notification
export const ApiErrorNotification: React.FC<{ error: Error; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => {
  const { showError } = useNotifications();

  useEffect(() => {
    showError(
      'API 오류',
      error.message,
      onRetry ? {
        action: {
          label: '다시 시도',
          callback: onRetry,
        },
      } : undefined
    );
  }, [error, onRetry, showError]);

  return null;
};

export default NotificationSystem;
