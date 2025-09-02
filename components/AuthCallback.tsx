import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('인증 처리 중...');
  const [hasRedirected, setHasRedirected] = useState(false);

    useEffect(() => {
    let redirectTimer: NodeJS.Timeout | null = null;

    const handleCallback = async () => {
      try {
        console.log('🔐 AuthCallback 시작 - URL:', window.location.href);

        // URL에서 토큰 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        console.log('🔐 URL 파라미터:', {
          hasToken: !!token,
          tokenLength: token?.length,
          error
        });

        if (error) {
          console.error('❌ 인증 오류:', error);
          setStatus('error');
          setMessage(`인증에 실패했습니다: ${  error}`);
          return;
        }

                if (token) {
          // 토큰을 로컬 스토리지와 세션 스토리지에 모두 저장 (지속성 향상)
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token);
          console.log('✅ 토큰 저장 완료:', {
            tokenLength: token.length,
            tokenPrefix: `${token.substring(0, 20)  }...`,
            storage: 'localStorage + sessionStorage'
          });

          // 저장된 토큰 확인
          const localToken = localStorage.getItem('token');
          const sessionToken = sessionStorage.getItem('token');
          console.log('🔍 저장된 토큰 확인:', {
            localStorage: !!localToken && localToken === token,
            sessionStorage: !!sessionToken && sessionToken === token,
            bothMatch: localToken === sessionToken && localToken === token
          });

          if (!localToken || !sessionToken || localToken !== token || sessionToken !== token) {
            console.error('❌ 토큰 저장 실패!');
            setStatus('error');
            setMessage('토큰 저장에 실패했습니다. 다시 시도해주세요.');
            return;
          }

          setStatus('success');
          setMessage('인증이 완료되었습니다. 잠시 후 메인 페이지로 이동합니다.');

          // 무한 루프 방지
          if (hasRedirected) {
            console.log('⚠️ 이미 리다이렉트됨, 중복 방지');
            return;
          }

          // 리다이렉션 타이머 설정
          redirectTimer = setTimeout(() => {
            console.log('🔄 메인 페이지로 리다이렉트');
            setHasRedirected(true);
            // 단순히 메인 페이지로 이동 (새로고침 없이)
            window.location.replace('/');
          }, 1500);
        } else {
          console.error('❌ 토큰 없음');
          setStatus('error');
          setMessage('인증 토큰을 받지 못했습니다.');
        }
      } catch (error) {
        console.error('❌ 인증 콜백 처리 오류:', error);
        setStatus('error');
        setMessage('인증 처리 중 오류가 발생했습니다.');
      }
    };

    handleCallback();

    // cleanup 함수
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <div className="mb-6">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            </div>
          )}
          
          {status === 'success' && (
            <div className="mb-6">
              <CheckCircle className="w-12 h-12 mx-auto text-accent" />
            </div>
          )}
          
          {status === 'error' && (
            <div className="mb-6">
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
            </div>
          )}
          
          <h2 className="text-xl font-semibold text-card-foreground mb-2 text-balance">
            {status === 'loading' && '인증 처리 중'}
            {status === 'success' && '인증 완료'}
            {status === 'error' && '인증 실패'}
          </h2>
          
          <p className="text-muted-foreground text-pretty">{message}</p>
          
          {status === 'error' && (
            <Button
              onClick={() => window.location.href = '/'}
              className="mt-6 w-full"
            >
              메인 페이지로 돌아가기
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
