// 🏗️ Core Application Types
// 상용화 수준의 타입 안전성을 위한 핵심 타입 정의

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
}

export enum ChatStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  PREMIUM = 'premium',
}

// 📝 Message Types
export interface ChatMessage {
  message_id: string;  // 🚨 id → message_id로 변경
  text: string;
  sender: MessageSender;
  timestamp: string;
  sources?: string[];
  followUpQuestions?: string[];
  context?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string;
}

// 💬 Chat Session Types
export interface ChatSession {
  chat_id: string;  // 백엔드 Key와 통일
  user_id?: number; // Optional for anonymous chats
  title: string;
  status: ChatStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  messages?: ChatMessage[];
  context?: string;
  tags?: string[];
  messageCount?: number;
}

// 👤 User Types
export interface User {
  user_id: number;  // 🚨 id → user_id로 변경
  email: string;
  name: string;
  username?: string;
  profile_picture?: string;
  google_id?: string;
  company?: string;
  role: UserRole;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'ko' | 'en';
  notifications: boolean;
  autoSave: boolean;
}

// 🔐 Auth Types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken?: string | null;
  tokenExpiry?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// 📡 API Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string | string[];
  field?: string; // For field-specific validation errors
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 📤 Request Types
export interface SendMessageRequest {
  message: string;
  context?: string;
  attachments?: File[];
}

export interface CreateChatRequest {
  title?: string;
  context?: string;
  tags?: string[];
}

export interface UpdateChatRequest {
  title?: string;
  tags?: string[];
  status?: ChatStatus;
}

// 📥 Streaming Types
export interface StreamingMessageData {
  type: 'streaming' | 'paragraph' | 'followUp' | 'error' | 'complete' | 'refresh';
  message: ChatMessage;
  paragraphIndex?: number;
  totalParagraphs?: number;
  wordIndex?: number;
  totalWords?: number;
  followUpQuestions?: string[];
  progress?: number; // 0-100
}

// 🎯 Application State Types
export interface AppState {
  // Chat State
  chats: ChatSession[];
  activeChatId: string | null;
  messages: ChatMessage[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  
  // Auth State
  auth: AuthState;
  
  // UI State
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark' | 'system';
    loading: boolean;
    error: string | null;
    notifications: Notification[];
  };
  
  // Settings
  settings: UserPreferences;
}

// 🔔 Notification Types
export interface Notification {
  notification_id: string;  // 🚨 id → notification_id로 변경
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = persistent
  action?: {
    label: string;
    callback: () => void;
  };
  timestamp: string;
}

// 🛡️ Security Types
export interface SecurityConfig {
  maxFileSize: number; // bytes
  allowedFileTypes: string[];
  maxMessageLength: number;
  rateLimitWindow: number; // milliseconds
  rateLimitMaxRequests: number;
}

// 📊 Analytics Types
export interface UserActivity {
  action: string;
  timestamp: string;
  metadata?: Record<string, any>;
  sessionId: string;
  user_id?: number;  // 🚨 userId → user_id로 변경
}

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  apiResponseTime: number;
  errorCount: number;
  timestamp: string;
}

// 🔄 Hook Types
export interface UseChatOptions {
  autoLoad?: boolean;
  enableLocalStorage?: boolean;
  maxRetries?: number;
}

export interface UseAuthOptions {
  redirectOnLogin?: string;
  redirectOnLogout?: string;
  persistSession?: boolean;
}

// 📦 Component Props Types
export interface ChatInterfaceProps {
  className?: string;
  onMessageSent?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export interface MessageItemProps {
  message: ChatMessage;
  className?: string;
  onEdit?: (messageId: string, newText: string) => void;
  onDelete?: (messageId: string) => void;
  showActions?: boolean;
}

export interface ChatHistoryProps {
  className?: string;
  onChatSelect?: (chatId: string) => void;
  onChatDelete?: (chatId: string) => void;
  showSearch?: boolean;
}

// 🎨 Theme Types
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
  };
}

// 🔧 Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 📋 Form Types
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  disabled?: boolean;
}

export interface FormState<T extends Record<string, any>> {
  fields: {
    [K in keyof T]: FormField<T[K]>;
  };
  isValid: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// 🌐 Internationalization Types
export interface Translation {
  [key: string]: string | Translation;
}

export interface LanguageConfig {
  code: string;
  name: string;
  rtl?: boolean;
  translations: Translation;
}
