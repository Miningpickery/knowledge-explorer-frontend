// 🎨 UI State Management
// 상용화 수준의 사용자 인터페이스 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Notification, ThemeConfig } from '../types';

interface UIState {
  // 🎨 Theme & Layout
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // 🔄 Loading States
  globalLoading: boolean;
  loadingMessage: string | null;
  
  // 🚨 Notifications
  notifications: Notification[];
  maxNotifications: number;
  
  // 🎯 Modal States
  modals: {
    settings: boolean;
    profile: boolean;
    confirmDelete: boolean;
    about: boolean;
  };
  
  // 📱 Responsive
  isMobile: boolean;
  isTablet: boolean;
  windowWidth: number;
  windowHeight: number;
  
  // 🔍 Search
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  
  // 🎛️ Settings
  settings: {
    autoSave: boolean;
    soundEnabled: boolean;
    animationsEnabled: boolean;
    compactMode: boolean;
    fontSize: 'small' | 'medium' | 'large';
    language: 'ko' | 'en';
  };
  
  // 🎯 Focus Management
  focusedElement: string | null;
  keyboardNavigation: boolean;
  
  // 📊 Performance
  performanceMetrics: {
    loadTime: number;
    renderTime: number;
    lastUpdate: number;
  };
}

interface UIActions {
  // 🎨 Theme & Layout
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // 🔄 Loading
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // 🚨 Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationAsRead: (id: string) => void;
  
  // 🎯 Modals
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  closeAllModals: () => void;
  
  // 📱 Responsive
  updateWindowSize: (width: number, height: number) => void;
  setDevice: (isMobile: boolean, isTablet: boolean) => void;
  
  // 🔍 Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: any[]) => void;
  setSearching: (searching: boolean) => void;
  clearSearch: () => void;
  
  // 🎛️ Settings
  updateSettings: (settings: Partial<UIState['settings']>) => void;
  resetSettings: () => void;
  
  // 🎯 Focus Management
  setFocusedElement: (element: string | null) => void;
  enableKeyboardNavigation: () => void;
  disableKeyboardNavigation: () => void;
  
  // 📊 Performance
  updatePerformanceMetrics: (metrics: Partial<UIState['performanceMetrics']>) => void;
  
  // 🔧 Utilities
  reset: () => void;
  getThemeConfig: () => ThemeConfig;
}

const defaultSettings: UIState['settings'] = {
  autoSave: true,
  soundEnabled: true,
  animationsEnabled: true,
  compactMode: false,
  fontSize: 'medium',
  language: 'ko',
};

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarCollapsed: false,
  globalLoading: false,
  loadingMessage: null,
  notifications: [],
  maxNotifications: 5,
  modals: {
    settings: false,
    profile: false,
    confirmDelete: false,
    about: false,
  },
  isMobile: false,
  isTablet: false,
  windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
  windowHeight: typeof window !== 'undefined' ? window.innerHeight : 1080,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  settings: defaultSettings,
  focusedElement: null,
  keyboardNavigation: false,
  performanceMetrics: {
    loadTime: 0,
    renderTime: 0,
    lastUpdate: Date.now(),
  },
};

export const useUIStore = create<UIState & UIActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // 🎨 Theme & Layout
      setTheme: (theme) => set((state) => {
        state.theme = theme;
        // Persist theme preference
        localStorage.setItem('theme', theme);
      }),

      toggleSidebar: () => set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      }),

      setSidebarOpen: (open) => set((state) => {
        state.sidebarOpen = open;
      }),

      setSidebarCollapsed: (collapsed) => set((state) => {
        state.sidebarCollapsed = collapsed;
      }),

      // 🔄 Loading
      setGlobalLoading: (loading, message) => set((state) => {
        state.globalLoading = loading;
        state.loadingMessage = message || null;
      }),

      // 🚨 Notifications
      addNotification: (notification) => set((state) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: new Date().toISOString(),
        };
        
        state.notifications.unshift(newNotification);
        
        // Limit number of notifications
        if (state.notifications.length > state.maxNotifications) {
          state.notifications = state.notifications.slice(0, state.maxNotifications);
        }
        
        // Auto-remove notification after duration
        if (notification.duration && notification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration);
        }
      }),

      removeNotification: (notificationId) => set((state) => {
        state.notifications = state.notifications.filter(n => n.notification_id !== notificationId);
      }),

      clearNotifications: () => set((state) => {
        state.notifications = [];
      }),

      markNotificationAsRead: (notificationId) => set((state) => {
        const notification = state.notifications.find(n => n.notification_id === notificationId);
        if (notification) {
          // In a more complex app, you might have a 'read' property
          // For now, we'll just remove it
          state.notifications = state.notifications.filter(n => n.notification_id !== notificationId);
        }
      }),

      // 🎯 Modals
      openModal: (modal) => set((state) => {
        state.modals[modal] = true;
      }),

      closeModal: (modal) => set((state) => {
        state.modals[modal] = false;
      }),

      closeAllModals: () => set((state) => {
        Object.keys(state.modals).forEach(key => {
          state.modals[key as keyof UIState['modals']] = false;
        });
      }),

      // 📱 Responsive
      updateWindowSize: (width, height) => set((state) => {
        state.windowWidth = width;
        state.windowHeight = height;
        
        // Update device type based on width
        state.isMobile = width < 768;
        state.isTablet = width >= 768 && width < 1024;
        
        // Auto-collapse sidebar on mobile
        if (state.isMobile && state.sidebarOpen) {
          state.sidebarOpen = false;
        }
      }),

      setDevice: (isMobile, isTablet) => set((state) => {
        state.isMobile = isMobile;
        state.isTablet = isTablet;
      }),

      // 🔍 Search
      setSearchQuery: (query) => set((state) => {
        state.searchQuery = query;
      }),

      setSearchResults: (results) => set((state) => {
        state.searchResults = results;
      }),

      setSearching: (searching) => set((state) => {
        state.isSearching = searching;
      }),

      clearSearch: () => set((state) => {
        state.searchQuery = '';
        state.searchResults = [];
        state.isSearching = false;
      }),

      // 🎛️ Settings
      updateSettings: (settings) => set((state) => {
        Object.assign(state.settings, settings);
        // Persist settings
        localStorage.setItem('uiSettings', JSON.stringify(state.settings));
      }),

      resetSettings: () => set((state) => {
        state.settings = { ...defaultSettings };
        localStorage.setItem('uiSettings', JSON.stringify(defaultSettings));
      }),

      // 🎯 Focus Management
      setFocusedElement: (element) => set((state) => {
        state.focusedElement = element;
      }),

      enableKeyboardNavigation: () => set((state) => {
        state.keyboardNavigation = true;
      }),

      disableKeyboardNavigation: () => set((state) => {
        state.keyboardNavigation = false;
      }),

      // 📊 Performance
      updatePerformanceMetrics: (metrics) => set((state) => {
        Object.assign(state.performanceMetrics, metrics);
        state.performanceMetrics.lastUpdate = Date.now();
      }),

      // 🔧 Utilities
      reset: () => set((state) => {
        Object.assign(state, initialState);
      }),

      getThemeConfig: (): ThemeConfig => {
        // This would return the current theme configuration
        // For now, returning a basic config
        return {
          colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            accent: '#06b6d4',
            background: '#ffffff',
            surface: '#f8fafc',
            text: '#1f2937',
            textSecondary: '#6b7280',
            border: '#e5e7eb',
            error: '#ef4444',
            warning: '#f59e0b',
            success: '#10b981',
            info: '#3b82f6',
          },
          spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
          },
          typography: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: {
              xs: '0.75rem',
              sm: '0.875rem',
              base: '1rem',
              lg: '1.125rem',
              xl: '1.25rem',
            },
          },
        };
      },
    }))
  )
);

// 🎣 Convenient Hooks
export const useTheme = () => useUIStore(state => state.theme);
export const useSidebar = () => useUIStore(state => ({
  isOpen: state.sidebarOpen,
  isCollapsed: state.sidebarCollapsed,
}));
export const useNotifications = () => useUIStore(state => state.notifications);
export const useModals = () => useUIStore(state => state.modals);
export const useResponsive = () => useUIStore(state => ({
  isMobile: state.isMobile,
  isTablet: state.isTablet,
  windowWidth: state.windowWidth,
  windowHeight: state.windowHeight,
}));

// 🔄 Auto-hydration and event listeners
if (typeof window !== 'undefined') {
  // Hydrate theme preference
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
  if (savedTheme) {
    useUIStore.getState().setTheme(savedTheme);
  }
  
  // Hydrate UI settings
  const savedSettings = localStorage.getItem('uiSettings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      useUIStore.getState().updateSettings(parsedSettings);
    } catch (error) {
      console.warn('Failed to parse saved UI settings:', error);
    }
  }
  
  // Window resize listener
  const handleResize = () => {
    useUIStore.getState().updateWindowSize(window.innerWidth, window.innerHeight);
  };
  
  window.addEventListener('resize', handleResize);
  
  // Initial size update
  handleResize();
  
  // Keyboard navigation detection
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      useUIStore.getState().enableKeyboardNavigation();
    }
  };
  
  const handleMouseDown = () => {
    useUIStore.getState().disableKeyboardNavigation();
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mousedown', handleMouseDown);
  
  // Performance monitoring
  const startTime = performance.now();
  window.addEventListener('load', () => {
    const loadTime = performance.now() - startTime;
    useUIStore.getState().updatePerformanceMetrics({ loadTime });
  });
}

export default useUIStore;
