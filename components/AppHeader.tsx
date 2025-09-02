import React from 'react';
import { User, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { Button } from './ui/Button';

interface AppHeaderProps {
  projectTitle: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
  onProfileClick?: () => void;
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogin?: () => void;
  chatTitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  projectTitle,
  user,
  onLogout,
  onProfileClick,
  onMenuToggle,
  isSidebarOpen,
  isDarkMode = false,
  onToggleDarkMode,
  onLogin,
  chatTitle
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-soft">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* 왼쪽: 메뉴 버튼 + 프로젝트 제목 */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* 모바일 메뉴 버튼 */}
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuToggle}
              className="p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
              aria-label={isSidebarOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          )}
          
          {/* 프로젝트 제목 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shadow-soft">
              <span className="text-primary-foreground font-bold text-sm sm:text-base">
                {projectTitle.charAt(0)}
              </span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                {chatTitle || projectTitle}
              </h1>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                {chatTitle ? '채팅 중' : 'AI 상담 어시스턴트'}
              </p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-sm sm:text-base font-semibold text-foreground leading-tight">
                {chatTitle || projectTitle}
              </h1>
            </div>
          </div>
        </div>

        {/* 오른쪽: 컨트롤 버튼들 */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 다크모드 토글 */}
          {onToggleDarkMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleDarkMode}
              className="p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
              aria-label={isDarkMode ? "라이트모드로 전환" : "다크모드로 전환"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
          
          {/* 사용자 프로필 또는 로그인 */}
          {user ? (
            <div className="flex items-center gap-2">
              {/* 프로필 버튼 (동그라미) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onProfileClick}
                className="p-2 text-foreground hover:bg-secondary rounded-full transition-colors"
                aria-label="프로필 설정"
              >
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="w-6 h-6 rounded-full" 
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </Button>
              
              {/* 로그아웃 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
                aria-label="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={onLogin}
              variant="primary"
              size="sm"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="hidden sm:inline">로그인</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
