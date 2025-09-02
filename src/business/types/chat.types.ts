/**
 * 🏷️ 채팅 시스템 타입 정의 - 상용화 수준
 * @description 완전한 타입 안정성을 위한 포괄적 타입 시스템
 */

// ============================================================================
// 🔐 사용자 및 인증 타입
// ============================================================================

export interface User {
  readonly user_id: number;
  readonly email: string;
  readonly name: string;
  readonly profilePicture?: string;
  readonly googleId?: string;
  readonly customerId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt: string;
}

export interface AuthState {
  readonly user: User | null;
  readonly tokens: AuthTokens | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
}

// ============================================================================
// 💬 채팅 및 메시지 타입
// ============================================================================

export type MessageSender = 'user' | 'assistant' | 'system';

export type MessageStatus = 
  | 'sending'    // 전송 중
  | 'sent'       // 전송 완료
  | 'delivered'  // 전달됨
  | 'failed'     // 전송 실패
  | 'streaming'; // 스트리밍 중

export interface BaseMessage {
  readonly message_id: string;
  readonly text: string;
  readonly sender: MessageSender;
  readonly timestamp: string;
  readonly status: MessageStatus;
}

export interface UserMessage extends BaseMessage {
  readonly sender: 'user';
  readonly attachments?: MessageAttachment[];
}

export interface AssistantMessage extends BaseMessage {
  readonly sender: 'assistant';
  readonly context?: string;
  readonly sources?: MessageSource[];
  readonly followUpQuestions?: string[];
  readonly isStreaming?: boolean;
  readonly streamingComplete?: boolean;
}

export interface SystemMessage extends BaseMessage {
  readonly sender: 'system';
  readonly type: 'info' | 'warning' | 'error' | 'success';
}

export type ChatMessage = UserMessage | AssistantMessage | SystemMessage;

export interface MessageAttachment {
  readonly attachment_id: string;
  readonly type: 'image' | 'file' | 'audio';
  readonly url: string;
  readonly name: string;
  readonly size: number;
  readonly mimeType: string;
}

export interface MessageSource {
  readonly source_id: string;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly confidence: number;
}

// ============================================================================
// 💬 채팅 세션 타입
// ============================================================================

export type ChatType = 'conversation' | 'support' | 'inquiry';

export interface ChatMetadata {
  readonly totalMessages: number;
  readonly lastActivity: string;
  readonly topics: string[];
  readonly sentiment?: 'positive' | 'neutral' | 'negative';
  readonly priority?: 'low' | 'medium' | 'high';
}

export interface ChatSession {
  readonly chat_id: string;  // 백엔드 Key와 통일
  readonly title: string;
  readonly type: ChatType;
  readonly userId?: number; // 익명 채팅의 경우 undefined
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: ChatMetadata;
  readonly isActive: boolean;
  readonly isArchived: boolean;
}

export interface ChatWithMessages extends ChatSession {
  readonly messages: ChatMessage[];
}

// ============================================================================
// 🗄️ 저장소 및 어댑터 타입
// ============================================================================

export type StorageType = 'local' | 'server' | 'cache';

export interface StorageAdapter<T = any> {
  readonly type: StorageType;
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface ChatStorageData {
  readonly chats: ChatSession[];
  readonly messages: Record<string, ChatMessage[]>; // chatId -> messages
  readonly user?: User;
  readonly lastSync: string;
}

// ============================================================================
// 🌐 API 및 네트워크 타입
// ============================================================================

export interface ApiResponse<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly metadata?: ResponseMetadata;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly timestamp: string;
  readonly requestId?: string;
}

export interface ResponseMetadata {
  readonly requestId: string;
  readonly timestamp: string;
  readonly processingTime: number;
  readonly version: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

// ============================================================================
// 🔄 실시간 이벤트 타입
// ============================================================================

export type StreamingEventType = 
  | 'message_start'
  | 'message_chunk'
  | 'message_complete'
  | 'error'
  | 'connection_lost'
  | 'reconnected';

export interface StreamingEvent {
  readonly type: StreamingEventType;
  readonly chatId: string;
  readonly messageId?: string;
  readonly data?: any;
  readonly timestamp: string;
}

export interface MessageStreamChunk {
  readonly messageId: string;
  readonly content: string;
  readonly isComplete: boolean;
  readonly metadata?: Record<string, any>;
}

// ============================================================================
// 🎯 서비스 레이어 타입
// ============================================================================

export interface ChatServiceConfig {
  readonly storageType: StorageType;
  readonly apiBaseUrl: string;
  readonly enableStreaming: boolean;
  readonly enableCache: boolean;
  readonly retryAttempts: number;
  readonly requestTimeout: number;
}

export interface MessageSendOptions {
  readonly chatId: string;
  readonly userId?: string;
  readonly enableStreaming?: boolean;
  readonly context?: string[];
  readonly attachments?: MessageAttachment[];
}

export interface ChatCreateOptions {
  readonly title?: string;
  readonly userId?: number;
  readonly type?: ChatType;
  readonly initialMessage?: string;
}

export interface ChatListOptions {
  readonly userId?: number;
  readonly type?: ChatType;
  readonly includeArchived?: boolean;
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'title';
  readonly sortOrder?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}

// ============================================================================
// ❌ 에러 핸들링 타입
// ============================================================================

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, any>;
  readonly timestamp: string;
  readonly recoverable: boolean;
}

export interface ErrorState {
  readonly error: AppError | null;
  readonly isRetrying: boolean;
  readonly retryCount: number;
  readonly lastErrorTime?: string;
}

// ============================================================================
// 🎨 UI 상태 타입
// ============================================================================

export interface UIState {
  readonly isLoading: boolean;
  readonly isSidebarOpen: boolean;
  readonly activeView: 'chat' | 'profile' | 'settings';
  readonly theme: 'light' | 'dark' | 'auto';
  readonly notifications: Notification[];
}

export interface Notification {
  readonly notification_id: string;
  readonly type: 'info' | 'success' | 'warning' | 'error';
  readonly title: string;
  readonly message: string;
  readonly timestamp: string;
  readonly autoClose?: boolean;
  readonly duration?: number;
  readonly actions?: NotificationAction[];
}

export interface NotificationAction {
  readonly action_id: string;
  readonly label: string;
  readonly action: () => void;
  readonly style?: 'primary' | 'secondary' | 'destructive';
}

// ============================================================================
// 🔧 설정 및 환경 타입
// ============================================================================

export interface AppConfig {
  readonly api: {
    readonly baseUrl: string;
    readonly timeout: number;
    readonly retryAttempts: number;
  };
  readonly auth: {
    readonly provider: 'google' | 'oauth2';
    readonly clientId: string;
    readonly redirectUrl: string;
  };
  readonly features: {
    readonly enableStreaming: boolean;
    readonly enableVoice: boolean;
    readonly enableFileUpload: boolean;
    readonly maxFileSize: number;
  };
  readonly ui: {
    readonly defaultTheme: 'light' | 'dark' | 'auto';
    readonly animationsEnabled: boolean;
    readonly compactMode: boolean;
  };
}

export interface Environment {
  readonly mode: 'development' | 'production' | 'test';
  readonly version: string;
  readonly buildTime: string;
  readonly commitHash: string;
}

// ============================================================================
// 🧪 테스트 헬퍼 타입
// ============================================================================

export interface MockChatSession extends Partial<ChatSession> {
  readonly chat_id: string;
  readonly title: string;
}

export interface MockMessage {
  readonly message_id: string;
  readonly text: string;
  readonly sender: MessageSender;
  readonly timestamp?: string;
  readonly status?: MessageStatus;
}

export interface TestContext {
  readonly user?: User;
  readonly chats?: MockChatSession[];
  readonly messages?: MockMessage[];
  readonly config?: Partial<AppConfig>;
}

// ============================================================================
// 🎯 유틸리티 타입
// ============================================================================

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// 유니온 타입에서 특정 타입 추출
export type ExtractByType<T, U> = T extends { type: U } ? T : never;

// 함수의 반환 타입을 Promise로 래핑
export type Promisify<T> = T extends Promise<any> ? T : Promise<T>;

// 이벤트 핸들러 타입
export type EventHandler<T = any> = (event: T) => void | Promise<void>;

// 상태 업데이트 함수 타입
export type StateUpdater<T> = (prevState: T) => T;
export type StateSetter<T> = (value: T | StateUpdater<T>) => void;
