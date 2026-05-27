# yeON Codex 백엔드 작업지시서

> **대상 에이전트**: Codex (OpenAI)  
> **역할**: Backend & Data Logic Specialist  
> **담당 디렉토리**: `prisma/`, `app/actions/`, `lib/`, `types/`

---

## 1. 역할 정의

Codex는 yeON 프로젝트의 서버 측 로직과 데이터 파이프라인을 전담합니다. Prisma ORM을 통한 데이터베이스 스키마 관리, Next.js Server Actions를 통한 비즈니스 로직 구현, 그리고 상태 머신(State Machine) 패턴을 적용한 견적/예약 상태 전이 로직이 핵심 업무입니다.

## 2. 절대 규칙

Codex가 작업할 때 반드시 지켜야 할 규칙은 다음과 같습니다. 첫째, `components/` 및 `hooks/` 디렉토리의 파일은 직접 수정하지 않습니다. 이 영역은 Claude Code가 전담합니다. 둘째, 모든 Server Action의 입출력 타입은 반드시 `types/` 디렉토리에 정의된 공유 인터페이스를 사용합니다. 셋째, 상태 변경 로직은 반드시 `lib/state-machine.ts`의 전이 검증 함수를 거쳐야 하며, 직접 status 필드를 업데이트하는 것은 금지됩니다.

## 3. Task 목록 (우선순위 순)

### Task 1: 공유 TypeScript 인터페이스 정의

`types/` 디렉토리에 두 에이전트가 공유할 인터페이스를 정의합니다. 이 작업은 Claude Code와 협업하여 최우선으로 완료해야 합니다.

**파일**: `types/quote.ts`

```typescript
export interface QuoteModule {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  isSelected?: boolean;
}

export interface BasePackage {
  name: string;
  price: number;
  description: string;
}

export interface QuoteResponseData {
  basePackage: BasePackage;
  includedModules: QuoteModule[];
  optionalModules: QuoteModule[];
  excludedModules: { id: string; name: string; reason: string }[];
  totalPrice: number;
}

export interface QuoteRequestPayload {
  planId: string;
  vendorId: string;
  requirements: string;
  selectedModuleIds: string[];
  preferredDate?: string;
  budget?: number;
}

export type QuoteStatus = 'PENDING' | 'RESPONDED' | 'ACCEPTED' | 'CANCELED';
```

**파일**: `types/reservation.ts`

```typescript
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CHANGED' | 'CANCELED';

export interface ReservationPayload {
  planId: string;
  vendorId: string;
  quoteResponseId?: string;
  reservedDate: string;
  totalAmount: number;
}
```

**파일**: `types/plan.ts`

```typescript
export type EventType = 'WEDDING' | 'FUNERAL';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export interface CreatePlanPayload {
  eventType: EventType;
  title?: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
}
```

### Task 2: Prisma Schema 작성

종합 기초문서(01번)의 10장에 정의된 전체 Prisma Schema를 `prisma/schema.prisma`에 적용합니다. 특히 `VendorServiceModule` 모델이 모듈형 가격 견적의 핵심이므로 반드시 포함되어야 합니다.

**검증 명령어**:
```bash
npx prisma format
npx prisma db push
npx prisma generate
```

### Task 3: 상태 머신 유틸리티 구현

`lib/state-machine.ts`에 견적 및 예약 상태 전이를 검증하는 함수를 구현합니다.

```typescript
// lib/state-machine.ts
import { QuoteStatus } from '@/types/quote';
import { ReservationStatus } from '@/types/reservation';

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  PENDING:   ['RESPONDED', 'CANCELED'],
  RESPONDED: ['ACCEPTED', 'CANCELED'],
  ACCEPTED:  [],
  CANCELED:  [],
};

const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING:   ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['CHANGED', 'CANCELED'],
  REJECTED:  [],
  CHANGED:   ['CONFIRMED'],
  CANCELED:  [],
};

export function assertQuoteTransition(current: QuoteStatus, next: QuoteStatus): void {
  if (!QUOTE_TRANSITIONS[current]?.includes(next)) {
    throw new InvalidTransitionError('QuoteRequest', current, next);
  }
}

export function assertReservationTransition(current: ReservationStatus, next: ReservationStatus): void {
  if (!RESERVATION_TRANSITIONS[current]?.includes(next)) {
    throw new InvalidTransitionError('Reservation', current, next);
  }
}

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`[${entity}] 상태 전이 불가: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
```

### Task 4: Server Actions 구현

각 Server Action은 `'use server'` 지시문으로 시작하며, Zod를 사용하여 입력을 검증하고, Prisma 트랜잭션 내에서 상태 변경을 수행합니다.

**파일**: `app/actions/quote.ts`

핵심 함수 목록:

| 함수명 | 설명 | 입력 | 출력 |
|---|---|---|---|
| `createQuoteRequest` | 견적 요청 생성 | `QuoteRequestPayload` | `QuoteRequest` |
| `submitQuoteResponse` | 업체 견적 응답 제출 | `QuoteResponseData + requestId` | `QuoteResponse` |
| `acceptQuote` | 사용자 견적 수락 | `requestId` | 상태 변경 결과 |
| `cancelQuote` | 견적 취소 | `requestId` | 상태 변경 결과 |
| `calculateQuoteTotal` | 서버 측 가격 재계산 | `moduleIds[]` | `{ totalPrice: number }` |

`submitQuoteResponse` 구현 시 반드시 다음 순서를 따릅니다:
1. `requestId`로 기존 QuoteRequest를 조회하여 현재 상태가 `PENDING`인지 확인
2. `assertQuoteTransition('PENDING', 'RESPONDED')` 호출
3. Prisma 트랜잭션 내에서 QuoteResponse 생성 + QuoteRequest 상태를 `RESPONDED`로 변경

**파일**: `app/actions/reservation.ts`

| 함수명 | 설명 | 입력 | 출력 |
|---|---|---|---|
| `createReservation` | 예약 생성 (견적 수락 후) | `ReservationPayload` | `Reservation` |
| `confirmReservation` | 업체 예약 확정 | `reservationId` | 상태 변경 결과 |
| `cancelReservation` | 예약 취소 | `reservationId + reason` | 상태 변경 결과 |
| `requestChange` | 예약 변경 요청 | `reservationId + changes` | 상태 변경 결과 |

**파일**: `app/actions/plan.ts`

| 함수명 | 설명 | 입력 | 출력 |
|---|---|---|---|
| `createPlan` | 행사 플랜 생성 | `CreatePlanPayload` | `EventPlan` |
| `updatePlan` | 플랜 정보 수정 | `planId + partial data` | `EventPlan` |
| `getPlanWithDetails` | 플랜 + 견적 + 예약 조회 | `planId` | 전체 관계 포함 |

### Task 5: Seed 데이터 생성

`prisma/seed.ts`에 다양한 상태의 더미 데이터를 생성하는 스크립트를 작성합니다. 최소 요구사항은 업체 프로필 3개(예식장, 스튜디오, 케이터링), 업체별 서비스 모듈 5~8개, 행사 플랜 2개(웨딩 1, 장례 1), 견적 요청 5개(각기 다른 상태), 예약 2개(PENDING, CONFIRMED)입니다.

### Task 6: 에러 핸들링 유틸리티

`lib/errors.ts`에 공용 에러 클래스와 Server Action 응답 래퍼를 구현합니다.

```typescript
// lib/errors.ts
export type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionError(error: string, code: string = 'UNKNOWN'): ActionResult<never> {
  return { success: false, error, code };
}
```

## 4. 검증 체크리스트

작업 완료 후 아래 항목을 모두 확인합니다.

| 항목 | 명령어 | 기대 결과 |
|---|---|---|
| Prisma Schema 유효성 | `npx prisma format` | 에러 없음 |
| DB 마이그레이션 | `npx prisma db push` | 성공 |
| 타입 검사 | `npx tsc --noEmit` | 에러 0 |
| 린트 | `npm run lint` | 경고 0 |
| 빌드 | `npm run build` | 성공 |
| Seed 실행 | `npx prisma db seed` | 데이터 삽입 성공 |
