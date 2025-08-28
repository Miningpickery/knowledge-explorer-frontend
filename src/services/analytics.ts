// 📊 User Analytics & Behavior Tracking
// 상용화 수준의 사용자 행동 분석 시스템

interface AnalyticsEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: string;
  lastActivity: string;
  pageViews: number;
  events: AnalyticsEvent[];
  deviceInfo: DeviceInfo;
  location?: LocationInfo;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  viewport: string;
  timezone: string;
  isMobile: boolean;
  isTablet: boolean;
  browser: string;
  os: string;
}

interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

/**
 * 📈 Analytics Service
 */
class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private session: UserSession;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: number = 30000; // 30초
  private maxQueueSize: number = 50;
  private enabled: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeSession();
    this.setupEventListeners();
    this.startPeriodicFlush();
  }

  /**
   * 🔧 초기화
   */
  private initializeSession(): void {
    this.session = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      pageViews: 0,
      events: [],
      deviceInfo: this.getDeviceInfo(),
    };

    // 위치 정보 수집 (사용자 동의 시)
    this.collectLocationInfo();
  }

  /**
   * 📱 디바이스 정보 수집
   */
  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    
    return {
      userAgent: ua,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isMobile: /Mobile|Android|iPhone|iPad/.test(ua),
      isTablet: /iPad|Android(?=.*Tablet)/.test(ua),
      browser: this.getBrowserName(ua),
      os: this.getOSName(ua),
    };
  }

  private getBrowserName(ua: string): string {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOSName(ua: string): string {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  /**
   * 🌍 위치 정보 수집
   */
  private async collectLocationInfo(): Promise<void> {
    try {
      // IP 기반 위치 정보 (개인정보 보호 고려)
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      this.session.location = {
        country: data.country_name,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
      };
    } catch (error) {
      console.warn('Failed to collect location info:', error);
    }
  }

  /**
   * 🎯 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 페이지 뷰 추적
    window.addEventListener('load', () => {
      this.trackPageView();
    });

    // 페이지 이탈 추적
    window.addEventListener('beforeunload', () => {
      this.flushEvents(true); // 동기 전송
    });

    // 활동 추적
    ['click', 'scroll', 'keydown', 'mousemove'].forEach(event => {
      document.addEventListener(event, this.throttle(() => {
        this.updateLastActivity();
      }, 5000));
    });

    // 에러 추적
    window.addEventListener('error', (event) => {
      this.trackError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Promise 거부 추적
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(event.reason, {
        type: 'unhandled_promise_rejection',
      });
    });
  }

  /**
   * 📊 이벤트 추적
   */
  track(event: string, properties: Record<string, any> = {}): void {
    if (!this.enabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      category: properties.category || 'general',
      action: properties.action || event,
      label: properties.label,
      value: properties.value,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    this.eventQueue.push(analyticsEvent);
    this.session.events.push(analyticsEvent);
    this.updateLastActivity();

    // 큐가 가득 차면 즉시 전송
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.flushEvents();
    }
  }

  /**
   * 📄 페이지 뷰 추적
   */
  trackPageView(path?: string): void {
    this.session.pageViews++;
    
    this.track('page_view', {
      category: 'navigation',
      action: 'page_view',
      path: path || window.location.pathname,
      title: document.title,
      search: window.location.search,
      hash: window.location.hash,
    });
  }

  /**
   * 👤 사용자 식별
   */
  identify(userId: string, traits: Record<string, any> = {}): void {
    this.userId = userId;
    this.session.userId = userId;
    
    this.track('user_identify', {
      category: 'user',
      action: 'identify',
      userId,
      traits,
    });
  }

  /**
   * 💬 채팅 이벤트 추적
   */
  trackChatEvent(action: string, properties: Record<string, any> = {}): void {
    this.track('chat_interaction', {
      category: 'chat',
      action,
      ...properties,
    });
  }

  /**
   * 🔐 인증 이벤트 추적
   */
  trackAuthEvent(action: string, properties: Record<string, any> = {}): void {
    this.track('auth_event', {
      category: 'authentication',
      action,
      ...properties,
    });
  }

  /**
   * 🎛️ UI 상호작용 추적
   */
  trackUIInteraction(element: string, action: string, properties: Record<string, any> = {}): void {
    this.track('ui_interaction', {
      category: 'ui',
      action,
      element,
      ...properties,
    });
  }

  /**
   * 🚨 에러 추적
   */
  trackError(error: Error | any, context: Record<string, any> = {}): void {
    this.track('error', {
      category: 'error',
      action: 'javascript_error',
      error_message: error?.message || String(error),
      error_stack: error?.stack,
      error_name: error?.name,
      ...context,
    });
  }

  /**
   * ⚡ 성능 메트릭 추적
   */
  trackPerformance(metric: string, value: number, properties: Record<string, any> = {}): void {
    this.track('performance', {
      category: 'performance',
      action: metric,
      value,
      ...properties,
    });
  }

  /**
   * 🎯 변환 이벤트 추적
   */
  trackConversion(goal: string, value?: number, properties: Record<string, any> = {}): void {
    this.track('conversion', {
      category: 'conversion',
      action: goal,
      value,
      ...properties,
    });
  }

  /**
   * 📤 이벤트 전송
   */
  private async flushEvents(isSync: boolean = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    const payload = {
      session: this.session,
      events: eventsToSend,
      timestamp: new Date().toISOString(),
    };

    try {
      if (isSync && navigator.sendBeacon) {
        // 동기 전송 (페이지 이탈 시)
        navigator.sendBeacon('/api/analytics', JSON.stringify(payload));
      } else {
        // 비동기 전송
        await fetch('/api/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
      // 실패한 이벤트를 다시 큐에 추가
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  /**
   * ⏰ 정기 전송 시작
   */
  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  /**
   * 📅 마지막 활동 시간 업데이트
   */
  private updateLastActivity(): void {
    this.session.lastActivity = new Date().toISOString();
  }

  /**
   * 🎲 세션 ID 생성
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 🚦 스로틀링 함수
   */
  private throttle(func: Function, limit: number): Function {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 🔧 설정 메서드
   */
  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getSession(): UserSession {
    return this.session;
  }

  // 개인정보 보호
  clearSession(): void {
    this.eventQueue = [];
    this.session.events = [];
    this.userId = undefined;
    this.session.userId = undefined;
  }
}

/**
 * 🎯 A/B 테스트 관리자
 */
class ABTestManager {
  private experiments: Map<string, any> = new Map();
  private userVariants: Map<string, string> = new Map();

  /**
   * 실험 등록
   */
  registerExperiment(name: string, variants: string[], weights?: number[]): void {
    this.experiments.set(name, {
      variants,
      weights: weights || variants.map(() => 1 / variants.length),
    });
  }

  /**
   * 사용자 변형 할당
   */
  getVariant(experimentName: string, userId?: string): string {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return 'control';

    const key = `${experimentName}_${userId || 'anonymous'}`;
    
    if (this.userVariants.has(key)) {
      return this.userVariants.get(key)!;
    }

    // 가중치 기반 무작위 할당
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.weights[i];
      if (random <= cumulative) {
        const variant = experiment.variants[i];
        this.userVariants.set(key, variant);
        
        // 할당 이벤트 추적
        analytics.track('ab_test_assignment', {
          category: 'ab_test',
          action: 'assignment',
          experiment: experimentName,
          variant,
          userId,
        });
        
        return variant;
      }
    }

    return experiment.variants[0]; // 기본값
  }

  /**
   * 변환 추적
   */
  trackConversion(experimentName: string, userId?: string, goal: string = 'conversion'): void {
    const variant = this.getVariant(experimentName, userId);
    
    analytics.track('ab_test_conversion', {
      category: 'ab_test',
      action: 'conversion',
      experiment: experimentName,
      variant,
      goal,
      userId,
    });
  }
}

// 싱글톤 인스턴스 생성
const analytics = new AnalyticsService();
const abTestManager = new ABTestManager();

// 글로벌 객체에 등록 (개발용)
if (typeof window !== 'undefined') {
  (window as any).analytics = analytics;
  (window as any).abTestManager = abTestManager;
}

export {
  AnalyticsService,
  ABTestManager,
  analytics,
  abTestManager,
  type AnalyticsEvent,
  type UserSession,
  type DeviceInfo,
};
