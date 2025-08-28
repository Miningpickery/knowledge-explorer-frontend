// 🔐 Authentication State Management
// 상용화 수준의 안전한 인증 상태 관리

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { User, AuthState } from '../types';

interface AuthStoreState extends AuthState {
  // 🔄 Loading States
  isLoading: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  
  // 🔧 Config
  rememberMe: boolean;
  tokenExpiry: number | null;
  refreshToken: string | null;
  
  // 🎯 UI State
  error: string | null;
  showProfile: boolean;
}

interface AuthActions {
  // 🔐 Authentication
  login: (user: User, token: string, refreshToken?: string, rememberMe?: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  
  // 🎫 Token Management
  setToken: (token: string, refreshToken?: string) => void;
  clearTokens: () => void;
  isTokenValid: () => boolean;
  refreshAuthToken: () => Promise<void>;
  
  // 🔄 Loading States
  setLoading: (loading: boolean) => void;
  setLoggingIn: (loggingIn: boolean) => void;
  setLoggingOut: (loggingOut: boolean) => void;
  
  // 🎯 UI Management
  setError: (error: string | null) => void;
  setShowProfile: (show: boolean) => void;
  
  // 💾 Persistence
  hydrate: () => void;
  persist: () => void;
  
  // 🛡️ Security
  validateSession: () => Promise<boolean>;
  secureLogout: () => void;
  
  // 📊 Utilities
  getUserInfo: () => User | null;
  hasRole: (role: string) => boolean;
  isExpired: () => boolean;
}

const initialState: AuthStoreState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  tokenExpiry: null,
  isLoading: false,
  isLoggingIn: false,
  isLoggingOut: false,
  rememberMe: false,
  error: null,
  showProfile: false,
};

export const useAuthStore = create<AuthStoreState & AuthActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // 🔐 Authentication
      login: (user, token, refreshToken, rememberMe = false) => set((state) => {
        state.isAuthenticated = true;
        state.user = user;
        state.token = token;
        state.refreshToken = refreshToken || null;
        state.rememberMe = rememberMe;
        state.isLoggingIn = false;
        state.error = null;
        
        // Calculate token expiry (assuming JWT with standard exp claim)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          state.tokenExpiry = payload.exp ? payload.exp * 1000 : null;
        } catch (error) {
          console.warn('Failed to parse token expiry:', error);
          state.tokenExpiry = null;
        }
        
        // Persist to storage
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', token);
        if (refreshToken) {
          storage.setItem('refreshToken', refreshToken);
        }
        storage.setItem('user', JSON.stringify(user));
        storage.setItem('rememberMe', String(rememberMe));
        
        console.log('✅ 사용자 로그인 완료:', user.name);
      }),

      logout: () => set((state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.tokenExpiry = null;
        state.rememberMe = false;
        state.isLoggingOut = false;
        state.error = null;
        state.showProfile = false;
        
        // Clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('rememberMe');
        
        console.log('✅ 사용자 로그아웃 완료');
      }),

      updateUser: (updates) => set((state) => {
        if (state.user) {
          Object.assign(state.user, updates);
          
          // Update in storage
          const storage = state.rememberMe ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(state.user));
        }
      }),

      // 🎫 Token Management
      setToken: (token, refreshToken) => set((state) => {
        state.token = token;
        if (refreshToken) {
          state.refreshToken = refreshToken;
        }
        
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          state.tokenExpiry = payload.exp ? payload.exp * 1000 : null;
        } catch (error) {
          console.warn('Failed to parse token expiry:', error);
        }
        
        const storage = state.rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', token);
        if (refreshToken) {
          storage.setItem('refreshToken', refreshToken);
        }
      }),

      clearTokens: () => set((state) => {
        state.token = null;
        state.refreshToken = null;
        state.tokenExpiry = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
      }),

      isTokenValid: () => {
        const { token, tokenExpiry } = get();
        if (!token) return false;
        if (!tokenExpiry) return true; // Assume valid if no expiry info
        return Date.now() < tokenExpiry;
      },

      refreshAuthToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          set((state) => { state.isLoading = true; });
          
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to refresh token');
          }
          
          const { token, refreshToken: newRefreshToken } = await response.json();
          
          set((state) => {
            state.token = token;
            if (newRefreshToken) {
              state.refreshToken = newRefreshToken;
            }
            state.isLoading = false;
          });
          
          console.log('✅ 토큰 갱신 완료');
        } catch (error) {
          console.error('❌ 토큰 갱신 실패:', error);
          set((state) => {
            state.isLoading = false;
            state.error = '인증이 만료되었습니다. 다시 로그인해주세요.';
          });
          get().logout();
          throw error;
        }
      },

      // 🔄 Loading States
      setLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      setLoggingIn: (loggingIn) => set((state) => {
        state.isLoggingIn = loggingIn;
      }),

      setLoggingOut: (loggingOut) => set((state) => {
        state.isLoggingOut = loggingOut;
      }),

      // 🎯 UI Management
      setError: (error) => set((state) => {
        state.error = error;
      }),

      setShowProfile: (show) => set((state) => {
        state.showProfile = show;
      }),

      // 💾 Persistence
      hydrate: () => {
        try {
          // Try localStorage first, then sessionStorage
          let token = localStorage.getItem('token') || sessionStorage.getItem('token');
          let refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
          let userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
          let rememberMeStr = localStorage.getItem('rememberMe') || sessionStorage.getItem('rememberMe');
          
          if (token && userStr) {
            const user: User = JSON.parse(userStr);
            const rememberMe = rememberMeStr === 'true';
            
            set((state) => {
              state.isAuthenticated = true;
              state.user = user;
              state.token = token;
              state.refreshToken = refreshToken;
              state.rememberMe = rememberMe;
              
              // Parse token expiry
              try {
                const payload = JSON.parse(atob(token!.split('.')[1]));
                state.tokenExpiry = payload.exp ? payload.exp * 1000 : null;
              } catch (error) {
                console.warn('Failed to parse token expiry during hydration:', error);
              }
            });
            
            console.log('✅ 인증 상태 복원 완료:', user.name);
          }
        } catch (error) {
          console.error('❌ 인증 상태 복원 실패:', error);
          get().logout();
        }
      },

      persist: () => {
        const { user, token, refreshToken, rememberMe } = get();
        if (user && token) {
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('token', token);
          if (refreshToken) {
            storage.setItem('refreshToken', refreshToken);
          }
          storage.setItem('user', JSON.stringify(user));
          storage.setItem('rememberMe', String(rememberMe));
        }
      },

      // 🛡️ Security
      validateSession: async () => {
        const { token } = get();
        if (!token) return false;
        
        try {
          const response = await fetch('/api/auth/validate', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (!response.ok) {
            get().logout();
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('❌ 세션 검증 실패:', error);
          get().logout();
          return false;
        }
      },

      secureLogout: () => {
        const { token } = get();
        
        // Call logout endpoint to invalidate token on server
        if (token) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          }).catch(error => {
            console.warn('Failed to notify server of logout:', error);
          });
        }
        
        get().logout();
      },

      // 📊 Utilities
      getUserInfo: () => {
        return get().user;
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      isExpired: () => {
        const { tokenExpiry } = get();
        return tokenExpiry ? Date.now() >= tokenExpiry : false;
      },
    }))
  )
);

// 🎣 Convenient Hooks
export const useAuth = () => useAuthStore(state => ({
  isAuthenticated: state.isAuthenticated,
  user: state.user,
  isLoading: state.isLoading,
  error: state.error,
}));

export const useUser = () => useAuthStore(state => state.user);
export const useAuthLoading = () => useAuthStore(state => ({
  isLoading: state.isLoading,
  isLoggingIn: state.isLoggingIn,
  isLoggingOut: state.isLoggingOut,
}));

// 🔄 Auto-hydration on module load
if (typeof window !== 'undefined') {
  useAuthStore.getState().hydrate();
  
  // Auto-validate session every 5 minutes
  setInterval(() => {
    const { isAuthenticated, isTokenValid } = useAuthStore.getState();
    if (isAuthenticated && !isTokenValid()) {
      console.log('🔄 토큰 만료 감지, 갱신 시도 중...');
      useAuthStore.getState().refreshAuthToken().catch(() => {
        console.log('🔄 토큰 갱신 실패, 로그아웃 처리');
      });
    }
  }, 5 * 60 * 1000); // 5 minutes
}

export default useAuthStore;
