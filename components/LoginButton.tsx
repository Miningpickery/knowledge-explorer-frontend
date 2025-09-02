import React from 'react';
import { Button } from './ui/Button';
import { API_CONFIG } from '../src/utils/apiConfig';

interface LoginButtonProps {
  onLoginSuccess?: (user: any) => void;
  onLoginError?: (error: string) => void;
}

const LoginButton: React.FC<LoginButtonProps> = ({ onLoginSuccess, onLoginError }) => {
  const handleGoogleLogin = async () => {
    try {
      console.log('🔐 Google 로그인 시작...');
      
      const googleAuthUrl = API_CONFIG.getApiUrl('/api/auth/google');
      console.log('🔐 Google OAuth URL:', googleAuthUrl);
      
      // 먼저 OAuth 설정 상태 확인
      console.log('🔐 OAuth 설정 확인 중...');
      const response = await fetch(googleAuthUrl, { method: 'HEAD' });
      
      console.log('🔐 OAuth 설정 응답:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      if (!response.ok && response.status === 500) {
        alert('Google OAuth 설정이 완료되지 않았습니다.\n\n' + 
              '🔧 개발자 설정 필요:\n' +
              '1. Google Cloud Console에서 프로젝트 생성\n' +
              '2. OAuth 2.0 클라이언트 ID 생성\n' +
              '3. 환경 변수 설정\n\n' +
              '임시로 테스트 계정으로 우회할 수 있습니다.');
        
        // 임시 해결책 제안
        const shouldContinue = confirm('그래도 시도해보시겠습니까?');
        if (!shouldContinue) return;
      }
      
      // OAuth 로그인 진행 (직접 리다이렉션)
      console.log('🔐 Google OAuth 리다이렉션 시작...');
      console.log('🔐 리다이렉션 URL:', googleAuthUrl);
      
      // CORS 오류를 피하기 위해 현재 창에서 리다이렉션
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('🔐 Google 로그인 오류:', error);
      alert('Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      variant="outline"
      size="md"
      className="flex items-center gap-3 bg-background border-border hover:bg-accent hover:text-accent-foreground"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span className="font-medium">Google로 로그인</span>
    </Button>
  );
};

export default LoginButton;
