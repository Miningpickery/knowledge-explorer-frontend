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
  // props에서 disabled 제거하여 중복 방지
  const { disabled: propsDisabled, ...restProps } = props;
  return (
    <button
      className={cn(
        // 🎯 기본 스타일 (모노 스타일 일관성)
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200",
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
        
        // 🎨 변형별 스타일 (모노 스타일 색상 시스템)
        {
          // 주요 액션 - 진한 네이비 배경, 흰색 텍스트
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-soft": variant === 'primary',
          // 보조 액션 - 연한 네이비 배경, 진한 네이비 텍스트
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90": variant === 'secondary',
          // 테두리 버튼 - 흰색 배경, 진한 네이비 테두리
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/90": variant === 'outline',
          // 투명 버튼 - 호버 시에만 배경색
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/90": variant === 'ghost',
          // 위험 액션 - 레드 배경, 흰색 텍스트
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95": variant === 'destructive',
        },
        
        className
      )}
      disabled={disabled || loading}
      // 접근성 속성 추가
      aria-disabled={disabled || loading}
      {...restProps}
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
