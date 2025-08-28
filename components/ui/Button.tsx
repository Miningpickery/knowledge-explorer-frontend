import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // 🎯 기본 스타일 (디자인 가이드 준수)
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // 텍스트 최적화
        "text-balance",
        // 접근성 강화
        "touch-manipulation select-none",
        
        // 📱 모바일 우선 크기별 스타일
        {
          // 작은 버튼 (모바일 터치 최적화)
          "h-9 px-3 text-sm min-w-[2.25rem] sm:h-8": size === 'sm',
          // 기본 버튼 (44px 높이 - 터치 접근성 최소 기준)
          "h-11 px-4 text-sm min-w-[2.75rem] sm:h-10": size === 'md',
          // 큰 버튼
          "h-12 px-6 text-base min-w-[3rem] sm:h-11 sm:px-5": size === 'lg',
        },
        
        // 🎨 변형별 스타일 (시맨틱 색상 토큰 사용)
        {
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95": variant === 'primary',
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90": variant === 'secondary',
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/90": variant === 'outline',
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/90": variant === 'ghost',
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95": variant === 'destructive',
        },
        
        className
      )}
      disabled={disabled || loading}
      // 접근성 속성 추가
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
