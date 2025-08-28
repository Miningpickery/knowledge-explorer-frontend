/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      // 🎨 색상 시스템 (디자인 가이드 준수: 3-5개 색상)
      colors: {
        // 주요 브랜드 색상 (모던한 블루)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#eff6ff',
          100: '#dbeafe', 
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // 주요 브랜드 색상
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // 중성색 시스템
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        // 액센트 색상 (성공/긍정적 액션용)
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          500: '#10b981', // 에메랄드 그린
        },
        // 기능적 색상
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      // 📝 폰트 시스템 (최대 2개)
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], // 본문용
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'], // 코드용
      },
      // 📐 간격 시스템 (일관된 스케일)
      spacing: {
        '18': '4.5rem',  // 72px
        '88': '22rem',   // 352px
      },
      // 📱 반응형 브레이크포인트 (모바일 우선)
      screens: {
        'xs': '475px',   // 추가 작은 화면
        'sm': '640px',   // 작은 태블릿
        'md': '768px',   // 태블릿
        'lg': '1024px',  // 작은 데스크톱
        'xl': '1280px',  // 데스크톱
        '2xl': '1536px', // 큰 데스크톱
      },
      // 🎭 애니메이션 시스템
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'typing': 'typing 1s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        typing: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      // 📏 텍스트 크기 시스템
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],     // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }], // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],    // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],     // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
      },
    },
  },
  plugins: [],
}
