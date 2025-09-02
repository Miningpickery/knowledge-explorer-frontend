# 🎨 지식 탐험가 모노 스타일 디자인 시스템

## 📋 개요

지식 탐험가는 **모노 스타일 디자인 시스템**을 기반으로 하며, **단일 색상 팔레트**와 **일관된 시각적 언어**를 통해 깔끔하고 전문적인 챗봇 경험을 제공합니다. 이 시스템은 모던한 미니멀리즘과 우수한 접근성을 동시에 달성합니다.

---

## 🎨 모노 스타일 색상 시스템

### 핵심 디자인 원칙
- **단일 색상 기반**: 모든 색상이 네이비(#2c3e50)에서 파생
- **일관된 대비**: 최소 4.5:1 대비 비율 보장
- **시맨틱 의미**: 색상만으로 정보를 전달하지 않음

### 🎯 브랜드 색상 팔레트

#### 1. 주요 색상 (Primary)
- **라이트모드**: `#2c3e50` (진한 네이비)
- **다크모드**: `#ecf0f1` (밝은 네이비)
- **용도**: 주요 액션, 사용자 메시지, 강조 요소

#### 2. 액센트 색상 (Accent)
- **라이트모드**: `#34495e` (밝은 네이비)
- **다크모드**: `#bdc3c7` (중간 밝기 네이비)
- **용도**: 호버 상태, 보조 액션

#### 3. 위험 색상 (Destructive)
- **통일색**: `#ef4444` (레드)
- **용도**: 삭제, 오류, 경고 상태

#### 4. 중성색 시스템 (모노크롬 기반)
- **배경**: `#ffffff` (라이트) / `#1a1a1a` (다크)
- **전경**: `#2c3e50` (라이트) / `#ecf0f1` (다크)
- **카드**: `#ffffff` (라이트) / `#2a2a2a` (다크)
- **보조**: `#f8f9fa` (라이트) / `#333333` (다크)
- **음소거**: `#e9ecef` (라이트) / `#404040` (다크)

### 색상 사용 가이드라인

```css
/* 시맨틱 색상 토큰 사용 */
--primary: hsl(220 13% 18%);           /* 브랜드 색상 */
--accent: hsl(220 13% 25%);            /* 액센트 */
--destructive: hsl(0 84% 60%);         /* 위험 */
--background: hsl(0 0% 100%);          /* 메인 배경 */
--foreground: hsl(220 13% 18%);        /* 메인 텍스트 */
```

---

## 📝 타이포그래피 시스템

### 단일 폰트 패밀리 원칙
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```
- **용도**: 모든 텍스트 요소 (본문, 버튼, 코드 포함)
- **특징**: 가독성 최적화, 모던한 산세리프

### 텍스트 크기 시스템

```css
/* 모바일 우선 텍스트 크기 */
font-size: 14px;          /* 기본 (모바일) */
font-size: 16px;          /* 기본 (데스크톱) */

/* 텍스트 크기 스케일 */
text-xs:   0.75rem;       /* 12px - 캡션 */
text-sm:   0.875rem;      /* 14px - 본문 */
text-base: 1rem;          /* 16px - 기본 */
text-lg:   1.125rem;      /* 18px - 부제목 */
text-xl:   1.25rem;       /* 20px - 제목 */
text-2xl:  1.5rem;        /* 24px - 큰 제목 */
text-3xl:  1.875rem;      /* 30px - 헤더 */
```

### 텍스트 최적화

```css
/* 텍스트 렌더링 최적화 */
font-feature-settings: "rlig" 1, "calt" 1;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
text-rendering: optimizeLegibility;

/* 텍스트 줄바꿈 최적화 */
text-wrap: balance;      /* 제목용 */
text-wrap: pretty;       /* 본문용 */
```

---

## 📱 반응형 디자인 시스템

### 브레이크포인트 (모바일 우선)

```css
/* 모바일 우선 접근법 */
xs:   '475px'    /* 초소형 모바일 */
sm:   '640px'    /* 모바일 */
md:   '768px'    /* 태블릿 */
lg:   '1024px'   /* 소형 데스크톱 */
xl:   '1280px'   /* 데스크톱 */
2xl:  '1536px'   /* 대형 데스크톱 */
```

### 터치 인터페이스 가이드라인

```css
/* 최소 터치 타겟 크기 */
button, [role="button"] {
  min-height: 44px;    /* iOS 권장 */
  min-width: 44px;     /* iOS 권장 */
}

/* 터치 최적화 */
touch-action: manipulation;
```

---

## 🧩 컴포넌트 시스템

### 버튼 컴포넌트

#### 변형 (Variants)
- `primary`: 주요 액션 (진한 네이비 배경, 흰색 텍스트)
- `secondary`: 보조 액션 (연한 네이비 배경, 진한 네이비 텍스트)
- `outline`: 테두리 버튼 (흰색 배경, 진한 네이비 테두리)
- `ghost`: 투명 버튼 (호버 시에만 배경색)
- `destructive`: 위험 액션 (레드 배경, 흰색 텍스트)

#### 크기 (Sizes)
- `sm`: 작은 버튼 (36px)
- `md`: 기본 버튼 (44px) - 터치 최적화
- `lg`: 큰 버튼 (48px)

```tsx
<Button variant="primary" size="md" loading={false}>
  제출하기
</Button>
```

### 카드 컴포넌트

```tsx
<Card>
  <CardHeader>
    <CardTitle>카드 제목</CardTitle>
    <CardDescription>카드 설명</CardDescription>
  </CardHeader>
  <CardContent>카드 내용</CardContent>
  <CardFooter>카드 하단</CardFooter>
</Card>
```

### 채팅 메시지 버블

#### 사용자 메시지
```css
.bubble-user {
  background-color: hsl(var(--primary));     /* 진한 네이비 */
  color: hsl(var(--primary-foreground));     /* 흰색 텍스트 */
  border-bottom-right-radius: 6px;
  margin-left: auto;
}
```

#### AI 답변
```css
.bubble-model {
  background-color: hsl(var(--card));        /* 흰색 배경 */
  color: hsl(var(--card-foreground));        /* 진한 네이비 텍스트 */
  border: 1px solid hsl(var(--border));      /* 연한 네이비 테두리 */
  border-bottom-left-radius: 6px;
  margin-right: auto;
}
```

---

## 🎭 애니메이션 시스템

### 기본 애니메이션

```css
/* 페이드 인 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 타이핑 커서 */
@keyframes typing {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 부드러운 펄스 */
@keyframes pulseSoft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 애니메이션 클래스

```css
.animate-fade-in: fadeIn 0.5s ease-in-out
.animate-slide-up: slideUp 0.3s ease-out
.animate-slide-down: slideDown 0.3s ease-out
.animate-typing: typing 1s infinite
.animate-pulse-soft: pulseSoft 2s ease-in-out infinite
```

---

## 🌙 다크모드 지원

### CSS 변수 시스템

```css
/* 라이트모드 */
:root {
  --background: 0 0% 100%;      /* 흰색 */
  --foreground: 220 13% 18%;    /* 진한 네이비 */
  --primary: 220 13% 18%;       /* 진한 네이비 */
}

/* 다크모드 */
.dark {
  --background: 220 13% 8%;     /* 매우 진한 네이비 */
  --foreground: 220 13% 95%;    /* 매우 밝은 네이비 */
  --primary: 220 13% 85%;       /* 밝은 네이비 */
}
```

### 자동 다크모드 전환

```css
/* 시스템 설정 감지 */
@media (prefers-color-scheme: dark) {
  .dark .chat-container::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.4);
  }
}
```

---

## ♿ 접근성 가이드라인

### 키보드 네비게이션

```css
/* 포커스 표시 */
.focus-visible:outline-none {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### 스크린 리더 지원

```tsx
// 스크린 리더 전용 텍스트
<span className="sr-only">새 대화</span>

// ARIA 라벨
<button aria-label="대화 선택: 새 대화">
  새 대화
</button>
```

### 색상 대비

- **최소 대비 비율**: 4.5:1 (일반 텍스트)
- **권장 대비 비율**: 7:1 (강조 텍스트)
- **시맨틱 색상**: 색상만으로 정보를 전달하지 않음

---

## 📐 간격 및 레이아웃

### 간격 시스템

```css
/* Tailwind 기본 간격 + 커스텀 */
spacing: {
  '18': '4.5rem',    /* 72px */
  '88': '22rem',     /* 352px */
}
```

### 컨테이너 최대 너비

```css
/* 반응형 컨테이너 */
max-w-4xl mx-auto    /* 채팅 인터페이스 */
max-w-7xl mx-auto    /* 전체 레이아웃 */
```

### 둥근 모서리 시스템

```css
/* 일관된 둥근 모서리 */
border-radius: {
  'sm': '0.375rem',    /* 작은 요소 */
  DEFAULT: '0.75rem',  /* 기본 */
  'md': '1rem',        /* 중간 */
  'lg': '1.5rem',      /* 큰 */
  'xl': '2rem',        /* 매우 큰 */
}
```

---

## 🎯 사용성 가이드라인

### 로딩 상태

- **스켈레톤 UI**: 콘텐츠 로딩 중
- **스피너**: 작업 진행 중
- **타이핑 애니메이션**: AI 응답 생성 중

### 오류 처리

```tsx
// 오류 상태 표시
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <h3 className="text-red-800 font-medium">오류 발생</h3>
  <p className="text-red-600 mt-1">{error}</p>
</div>
```

### 성공 피드백

```tsx
// 성공 상태 표시
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <h3 className="text-green-800 font-medium">성공</h3>
  <p className="text-green-600 mt-1">작업이 완료되었습니다.</p>
</div>
```

---

## 🔧 개발 가이드라인

### CSS 클래스 네이밍

- **BEM 방식 사용**: `.block__element--modifier`
- **Tailwind 클래스 우선**: 유틸리티 클래스 활용
- **커스텀 CSS 최소화**: CSS 변수 시스템 활용

### 컴포넌트 구조

```tsx
// 일관된 컴포넌트 구조
interface ComponentProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const Component: React.FC<ComponentProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "base-styles",
      variantStyles[variant],
      sizeStyles[size],
      className
    )}>
      {children}
    </div>
  );
};
```

### 성능 최적화

- **CSS-in-JS 지양**: 스타일 성능 최적화
- **애니메이션 최적화**: `transform`과 `opacity` 사용
- **이미지 최적화**: WebP 포맷, 지연 로딩

---

## 📋 체크리스트

### 새로운 컴포넌트 개발 시
- [ ] 모노 스타일 색상 시스템 준수
- [ ] 단일 폰트 패밀리 사용
- [ ] 반응형 디자인 적용
- [ ] 접근성 가이드라인 준수
- [ ] 다크모드 지원
- [ ] 애니메이션 일관성
- [ ] 터치 인터페이스 최적화
- [ ] 색상 대비 검증 (4.5:1 이상)

### 디자인 리뷰 시
- [ ] 모노 스타일 일관성 확인
- [ ] 색상 대비 검증
- [ ] 반응형 동작 테스트
- [ ] 접근성 검증
- [ ] 성능 최적화 확인
- [ ] 하드코딩된 색상 제거 확인

---

## 🚫 금지 사항

### 색상 사용 금지
- ❌ 하드코딩된 색상 값 사용 (`#B0E0E6`, `#374151` 등)
- ❌ 색상만으로 정보 전달
- ❌ 대비 비율 4.5:1 미만
- ❌ 여러 색상 팔레트 혼용

### 디자인 금지
- ❌ 귀여운 캐릭터나 일러스트 사용
- ❌ 과도한 그림자나 그라데이션
- ❌ 둥근 모서리 일관성 위반
- ❌ 폰트 패밀리 혼용

---

## 📚 참고 자료

- [Tailwind CSS 공식 문서](https://tailwindcss.com/docs)
- [Inter 폰트](https://rsms.me/inter/)
- [WCAG 2.1 가이드라인](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design 가이드라인](https://material.io/design)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

*이 가이드는 모노 스타일 디자인 시스템의 일관성을 유지하기 위해 지속적으로 업데이트됩니다.*
