# yeON Claude Code 프론트엔드 작업지시서

> **대상 에이전트**: Claude Code (Anthropic)  
> **역할**: Frontend & UX/UI Specialist  
> **담당 디렉토리**: `app/` (페이지), `components/`, `hooks/`, CSS/Tailwind 설정

---

## 1. 역할 정의

Claude Code는 yeON 프로젝트의 사용자 접점(Client-side) 전체를 전담합니다. 현재 정적이고 폼 위주인 UI를 인터랙티브하고 감성적인 경험으로 탈바꿈시키는 것이 핵심 미션입니다. Framer Motion 기반의 마이크로 인터랙션, 행사 유형별 동적 테마 시스템, 모듈형 견적 빌더의 시각적 UI, 그리고 다단계 마법사 폼을 구현합니다.

## 2. 절대 규칙

Claude Code가 작업할 때 반드시 지켜야 할 규칙은 다음과 같습니다. 첫째, `prisma/`, `lib/state-machine.ts`, `app/actions/` 디렉토리의 파일은 직접 수정하지 않습니다. 이 영역은 Codex가 전담합니다. 둘째, 모든 데이터 타입은 반드시 `types/` 디렉토리에서 import합니다. 컴포넌트 내부에서 인라인으로 타입을 정의하는 것은 금지됩니다. 셋째, 백엔드 API가 준비되기 전에는 Mock 데이터를 사용하여 UI를 먼저 개발하되, Mock 데이터는 `__mocks__/` 디렉토리에 분리하여 나중에 쉽게 교체할 수 있도록 합니다.

## 3. 신규 패키지 설치

작업 시작 전 아래 패키지를 설치합니다.

```bash
npm install framer-motion react-hook-form @hookform/resolvers zod
```

## 4. Task 목록 (우선순위 순)

### Task 1: 테마 시스템 구축

웨딩과 장례라는 두 가지 전혀 다른 감성을 하나의 앱에서 자연스럽게 전환하는 테마 시스템을 구축합니다.

**파일**: `hooks/use-theme.ts`

```typescript
'use client';
import { createContext, useContext } from 'react';

export type EventTheme = 'wedding' | 'funeral';

interface ThemeConfig {
  primary: string;
  background: string;
  accent: string;
  fontWeight: string;
  borderRadius: string;
  transitionDuration: string;
  transitionType: 'spring' | 'tween';
}

const THEMES: Record<EventTheme, ThemeConfig> = {
  wedding: {
    primary: 'rose-500',
    background: 'orange-50',
    accent: 'amber-600',
    fontWeight: 'font-medium',
    borderRadius: 'rounded-2xl',
    transitionDuration: '0.2',
    transitionType: 'spring',
  },
  funeral: {
    primary: 'slate-600',
    background: 'slate-50',
    accent: 'blue-900',
    fontWeight: 'font-light',
    borderRadius: 'rounded-lg',
    transitionDuration: '0.4',
    transitionType: 'tween',
  },
};

// Context와 Provider 구현...
```

**Tailwind 확장** (`tailwind.config.ts`): 웨딩/장례 테마 컬러를 커스텀 컬러로 등록합니다.

```typescript
// tailwind.config.ts에 추가
theme: {
  extend: {
    colors: {
      wedding: {
        primary: '#F43F5E',
        bg: '#FFF7ED',
        accent: '#D97706',
      },
      funeral: {
        primary: '#475569',
        bg: '#F8FAFC',
        accent: '#1E3A5F',
      },
    },
  },
},
```

### Task 2: 공용 애니메이션 컴포넌트 (components/ui/motion/)

6개의 공용 모션 컴포넌트를 구현합니다. 모든 컴포넌트는 `'use client'` 지시문을 포함하고, `useTheme` 훅에서 현재 테마의 트랜지션 설정을 가져와 적용합니다.

**FadeIn** (`components/ui/motion/fade-in.tsx`): 요소가 투명에서 불투명으로 나타나는 래퍼입니다. 웨딩 테마에서는 빠르고 경쾌하게(0.2s, spring), 장례 테마에서는 느리고 차분하게(0.4s, ease) 동작합니다.

```tsx
'use client';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

**SlideUp** (`components/ui/motion/slide-up.tsx`): 아래에서 위로 슬라이드하며 나타나는 래퍼입니다. 리스트 아이템이나 알림 카드에 사용합니다.

**SwipeTransition** (`components/ui/motion/swipe-transition.tsx`): 다단계 마법사에서 화면 전환 시 좌우 스와이프 효과를 적용합니다. `AnimatePresence`와 `mode="wait"`을 사용하여 이전 화면이 완전히 사라진 후 다음 화면이 나타나도록 합니다.

```tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface SwipeTransitionProps {
  children: ReactNode;
  stepKey: string | number;
  direction: 'forward' | 'backward';
}

export function SwipeTransition({ children, stepKey, direction }: SwipeTransitionProps) {
  const xOffset = direction === 'forward' ? 300 : -300;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ x: xOffset, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -xOffset, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**CountUp** (`components/ui/motion/count-up.tsx`): 숫자가 이전 값에서 새로운 값으로 카운트업 애니메이션을 수행합니다. 모듈형 견적 빌더의 총액 표시에 사용합니다.

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useSpring, useMotionValue, motion } from 'framer-motion';

interface CountUpProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function CountUp({ value, className, prefix = '', suffix = '' }: CountUpProps) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 20 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(latest).toLocaleString()}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix]);

  return <span ref={ref} className={className} />;
}
```

**Confetti** (`components/ui/motion/confetti.tsx`): 웨딩 예약 확정 시 화면에 파스텔 톤의 파티클이 뿌려지는 축하 효과입니다. canvas-confetti 라이브러리를 활용하거나, Framer Motion으로 직접 파티클을 생성합니다.

**ProgressBar** (`components/ui/motion/progress-bar.tsx`): 다단계 마법사 상단에 표시되는 진행률 바입니다. 현재 단계에 따라 부드럽게 채워집니다.

```tsx
'use client';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function ProgressBar({ currentStep, totalSteps, className }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className={`h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}
```

### Task 3: 다단계 마법사 폼 (Multi-Step Wizard)

현재의 한 화면에 모든 필드를 나열하는 방식을 대체하는 핵심 컴포넌트입니다.

**파일**: `components/features/planning/multi-step-wizard.tsx`

**설계 요구사항**:

| 요소 | 설명 |
|---|---|
| 상단 ProgressBar | 현재 단계 / 전체 단계를 시각적으로 표시 |
| SwipeTransition | 단계 전환 시 좌우 스와이프 애니메이션 |
| useWizardStep 훅 | 현재 단계, 방향(forward/backward), 입력 데이터를 관리 |
| 유효성 검사 | 각 단계별 Zod 스키마로 검증, 통과 시에만 다음 단계 활성화 |
| 최종 확인 | 마지막 단계에서 전체 입력 내용을 요약 표시 후 제출 |

**웨딩 마법사 단계 구성**:

| 단계 | 화면 내용 | 입력 컴포넌트 |
|---|---|---|
| 1 | "결혼식 예정일이 언제인가요?" | 캘린더 날짜 피커 |
| 2 | "어느 지역에서 진행하시나요?" | 시/도 → 구/군 계단식 드롭다운 |
| 3 | "예상 하객 수는 몇 명인가요?" | 슬라이더 + 숫자 직접 입력 |
| 4 | "총 예산은 어느 정도인가요?" | 범위 슬라이더 (최소~최대) |
| 5 | "어떤 서비스가 필요하신가요?" | 모듈 타일 멀티 선택 |

**장례 마법사 단계 구성**:

| 단계 | 화면 내용 | 입력 컴포넌트 |
|---|---|---|
| 1 | "장례 일정은 어떻게 되나요?" | 날짜 피커 + 기간 선택 (3일/5일) |
| 2 | "어느 지역에서 진행하시나요?" | 지역 선택 드롭다운 |
| 3 | "예상 조문객 수는 몇 명인가요?" | 슬라이더 + 숫자 입력 |
| 4 | "필요한 서비스를 선택해주세요" | 모듈 타일 멀티 선택 |

### Task 4: 모듈형 견적 빌더 UI

사용자가 업체에 견적을 요청할 때, 텍스트 입력 대신 시각적인 타일을 클릭하여 원하는 서비스를 선택하는 핵심 인터랙티브 컴포넌트입니다.

**파일**: `components/features/planning/modular-quote-builder.tsx`

**레이아웃 설계**:

```
┌─────────────────────────────────────────────────────────┐
│  [카테고리 탭: 전체 | 촬영 | 드레스 | 메이크업 | 장식]    │
├───────────────────────────────┬─────────────────────────┤
│                               │  📋 견적 요약            │
│  ┌─────┐ ┌─────┐ ┌─────┐    │                         │
│  │ 📸  │ │ 👗  │ │ 💄  │    │  기본 패키지: ₩3,500,000│
│  │스냅 │ │드레스│ │메이크│    │  + 스냅 촬영: ₩1,200,000│
│  │₩1.2M│ │₩800K│ │₩500K│    │  + 드레스:   ₩800,000  │
│  │ [✓] │ │ [✓] │ │ [ ] │    │  ─────────────────────  │
│  └─────┘ └─────┘ └─────┘    │  총 견적: ₩5,500,000   │
│  ┌─────┐ ┌─────┐ ┌─────┐    │         ↑ CountUp 애니   │
│  │ 🌸  │ │ 🍽️  │ │ 💌  │    │                         │
│  │장식 │ │식사 │ │초대장│    │  [견적 요청하기] 버튼    │
│  │₩800K│ │₩50K │ │₩100K│    │                         │
│  │ [ ] │ │ [ ] │ │ [ ] │    │                         │
│  └─────┘ └─────┘ └─────┘    │                         │
│                               │                         │
│  모듈 타일 그리드 (좌측)       │  Sticky Summary (우측)  │
└───────────────────────────────┴─────────────────────────┘
```

**인터랙션 상세**:

모듈 타일을 클릭하면 선택 상태가 토글됩니다. 선택된 타일은 테두리 색상이 primary 컬러로 변경되고, 체크 아이콘이 부드럽게 나타납니다. 동시에 우측 Sticky Summary 패널에 해당 항목이 `AnimatePresence`를 통해 부드럽게 추가됩니다. 항목이 제거될 때도 마찬가지로 부드럽게 사라집니다. 총액 표시부에는 `CountUp` 컴포넌트를 적용하여 금액 변경 시 숫자가 굴러가듯 업데이트됩니다.

모바일 환경에서는 Sticky Summary가 화면 하단에 고정된 바(Bottom Bar) 형태로 변경되며, 탭하면 전체 요약이 바텀 시트(Bottom Sheet)로 올라옵니다.

**훅**: `hooks/use-quote-builder.ts`

```typescript
interface QuoteBuilderState {
  selectedModules: QuoteModule[];
  basePackage: BasePackage | null;
  totalPrice: number;
  toggleModule: (module: QuoteModule) => void;
  setBasePackage: (pkg: BasePackage) => void;
  reset: () => void;
}
```

### Task 5: 견적 비교 테이블

여러 업체의 견적 응답을 나란히 비교하는 테이블 컴포넌트입니다.

**파일**: `components/features/planning/quote-comparison.tsx`

**레이아웃**: 각 업체의 견적을 컬럼으로 배치하고, 행(Row)은 카테고리별 모듈 항목입니다. 가격 차이가 큰 항목은 하이라이트 처리합니다. 최저가 항목에는 "최저가" 배지를 표시합니다.

### Task 6: 업체 견적 에디터

업체가 고객의 견적 요청에 응답하는 화면입니다.

**파일**: `components/features/planning/vendor-quote-editor.tsx`

상단에 프리셋 드롭다운(자주 쓰는 패키지 조합)을 배치하고, 중앙에는 드래그 앤 드롭 영역을 배치합니다. 좌측의 "제공 가능한 모듈" 목록에서 우측의 "이 견적에 포함" 영역으로 모듈을 드래그하여 견적을 구성합니다.

### Task 7: 랜딩 페이지 리디자인

현재의 단순한 랜딩 페이지를 풀스크린 히어로 섹션, 서비스 소개 섹션, 사용 방법(How it works) 섹션으로 재구성합니다. 스크롤 기반 패럴랙스 효과와 FadeIn/SlideUp 애니메이션을 적용합니다.

### Task 8: 워크스페이스 리팩토링

현재 1009줄짜리 `event-planning-workspace.tsx`를 새로 만든 컴포넌트들(MultiStepWizard, ModularQuoteBuilder, QuoteComparison)을 조합하는 형태로 리팩토링합니다. 4단계 스테퍼(기본 정보 → 업체 탐색 → 견적 비교 → 예약 확정)의 각 단계가 독립적인 컴포넌트로 분리되어야 합니다.

## 5. 검증 체크리스트

| 항목 | 확인 방법 | 기대 결과 |
|---|---|---|
| 테마 전환 | 웨딩/장례 전환 시 컬러/애니메이션 변경 | 즉각적이고 자연스러운 전환 |
| 마법사 폼 | 각 단계 이동 시 스와이프 애니메이션 | 끊김 없는 전환 |
| 견적 빌더 | 모듈 타일 클릭 시 요약 패널 업데이트 | 실시간 반영 + 카운트업 |
| 반응형 | 모바일(375px) ~ 데스크톱(1440px) | 모든 브레이크포인트에서 정상 |
| 타입 검사 | `npx tsc --noEmit` | 에러 0 |
| 빌드 | `npm run build` | 성공 |
