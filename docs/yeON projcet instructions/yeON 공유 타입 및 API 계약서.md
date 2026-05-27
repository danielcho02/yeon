# yeON 공유 타입 및 API 계약서

> **목적**: Codex(백엔드)와 Claude Code(프론트엔드) 간의 데이터 교환 규약  
> **규칙**: 모든 타입은 `types/` 디렉토리에서만 정의하고, 양쪽 모두 이 파일에서 import

---

## 1. 개요

이 문서는 두 에이전트가 독립적으로 개발하면서도 통합 시 충돌이 발생하지 않도록, 데이터 교환의 계약(Contract)을 명확히 정의합니다. 프론트엔드는 이 타입을 기반으로 Mock 데이터를 생성하여 UI를 개발하고, 백엔드는 동일한 타입을 반환하는 실제 API를 구현합니다.

## 2. 공유 타입 정의

### 2.1 types/common.ts

```typescript
// 모든 Server Action의 공용 응답 래퍼
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// 페이지네이션
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// 정렬
export type SortDirection = 'asc' | 'desc';
```

### 2.2 types/user.ts

```typescript
export type UserRole = 'USER' | 'VENDOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
}

export interface VendorProfileData {
  id: string;
  userId: string;
  businessNumber: string;
  companyName: string;
  category: string;
  description: string | null;
  location: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
```

### 2.3 types/plan.ts

```typescript
export type EventType = 'WEDDING' | 'FUNERAL';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export interface EventPlanData {
  id: string;
  userId: string;
  eventType: EventType;
  title: string | null;
  eventDate: string | null;
  location: string | null;
  guestCount: number | null;
  budget: number | null;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanPayload {
  eventType: EventType;
  title?: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
}

export interface UpdatePlanPayload {
  title?: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
}

// 플랜 + 관계 데이터 (상세 조회용)
export interface EventPlanWithDetails extends EventPlanData {
  quoteRequests: QuoteRequestWithResponses[];
  reservations: ReservationData[];
  transactions: TransactionData[];
  invitation: InvitationData | null;
}
```

### 2.4 types/vendor-module.ts

```typescript
export type ModuleCategory =
  // 웨딩
  | 'VENUE' | 'PHOTO' | 'DRESS' | 'MAKEUP' | 'DECORATION' | 'CATERING' | 'INVITATION'
  // 장례
  | 'FUNERAL_HALL' | 'WREATH' | 'TRANSPORT' | 'CEREMONY' | 'MEAL' | 'OBITUARY';

export interface VendorServiceModuleData {
  id: string;
  vendorId: string;
  name: string;
  category: ModuleCategory;
  price: number;
  description: string | null;
  isBaseIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
}

// 견적 빌더에서 사용하는 간소화된 모듈
export interface QuoteModule {
  id: string;
  name: string;
  category: ModuleCategory;
  price: number;
  description?: string;
  isSelected?: boolean;
}
```

### 2.5 types/quote.ts

```typescript
export type QuoteStatus = 'PENDING' | 'RESPONDED' | 'ACCEPTED' | 'CANCELED';

export interface BasePackage {
  name: string;
  price: number;
  description: string;
}

// 견적 응답의 JSON 구조 (QuoteResponse.modules 필드)
export interface QuoteResponseModules {
  basePackage: BasePackage;
  includedModules: QuoteModule[];
  optionalModules: QuoteModule[];
  excludedModules: { id: string; name: string; reason: string }[];
}

// 견적 요청 데이터
export interface QuoteRequestData {
  id: string;
  planId: string;
  vendorId: string;
  requirements: string;
  selectedModules: string[];
  preferredDate: string | null;
  budget: number | null;
  status: QuoteStatus;
  createdAt: string;
}

// 견적 응답 데이터
export interface QuoteResponseData {
  id: string;
  requestId: string;
  vendorId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note: string | null;
  createdAt: string;
  vendor?: VendorProfileData;
}

// 견적 요청 + 응답 (조회용)
export interface QuoteRequestWithResponses extends QuoteRequestData {
  responses: QuoteResponseData[];
}

// 견적 요청 생성 페이로드
export interface CreateQuoteRequestPayload {
  planId: string;
  vendorId: string;
  requirements: string;
  selectedModuleIds: string[];
  preferredDate?: string;
  budget?: number;
}

// 견적 응답 제출 페이로드
export interface SubmitQuoteResponsePayload {
  requestId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note?: string;
}
```

### 2.6 types/reservation.ts

```typescript
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CHANGED' | 'CANCELED';

export interface ReservationData {
  id: string;
  planId: string;
  vendorId: string;
  quoteResponseId: string | null;
  reservedDate: string;
  totalAmount: number;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  vendor?: VendorProfileData;
  quoteResponse?: QuoteResponseData;
}

export interface CreateReservationPayload {
  planId: string;
  vendorId: string;
  quoteResponseId?: string;
  reservedDate: string;
  totalAmount: number;
}
```

### 2.7 types/transaction.ts

```typescript
export type TransactionType = 'ONLINE' | 'OFFLINE';

export interface TransactionData {
  id: string;
  planId: string;
  senderName: string;
  amount: number;
  relation: string | null;
  message: string | null;
  type: TransactionType;
  createdAt: string;
}

export interface CreateTransactionPayload {
  planId: string;
  senderName: string;
  amount: number;
  relation?: string;
  message?: string;
  type: TransactionType;
}

// 정산 통계 (프론트엔드 대시보드용)
export interface TransactionSummary {
  totalAmount: number;
  totalCount: number;
  onlineAmount: number;
  offlineAmount: number;
  byRelation: { relation: string; amount: number; count: number }[];
}
```

### 2.8 types/invitation.ts

```typescript
export interface InvitationData {
  id: string;
  planId: string;
  templateId: string;
  shareUrl: string;
  content: Record<string, unknown>;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 3. Server Actions API 계약

아래 표는 Codex가 구현하고 Claude Code가 호출하는 Server Actions의 전체 목록입니다. 각 함수의 입력과 출력 타입이 명확히 정의되어 있으므로, Claude Code는 이 계약을 기반으로 Mock 데이터를 생성하여 UI를 먼저 개발할 수 있습니다.

### 3.1 Plan Actions (`app/actions/plan.ts`)

| 함수명 | 입력 타입 | 출력 타입 | 설명 |
|---|---|---|---|
| `createPlan` | `CreatePlanPayload` | `ActionResult<EventPlanData>` | 새 행사 플랜 생성 |
| `updatePlan` | `string, UpdatePlanPayload` | `ActionResult<EventPlanData>` | 플랜 정보 수정 |
| `getPlanById` | `string` | `ActionResult<EventPlanWithDetails>` | 플랜 상세 조회 (관계 포함) |
| `getUserPlans` | `void` | `ActionResult<EventPlanData[]>` | 현재 사용자의 플랜 목록 |

### 3.2 Quote Actions (`app/actions/quote.ts`)

| 함수명 | 입력 타입 | 출력 타입 | 설명 |
|---|---|---|---|
| `createQuoteRequest` | `CreateQuoteRequestPayload` | `ActionResult<QuoteRequestData>` | 견적 요청 생성 |
| `submitQuoteResponse` | `SubmitQuoteResponsePayload` | `ActionResult<QuoteResponseData>` | 업체 견적 응답 |
| `acceptQuote` | `string (requestId)` | `ActionResult<QuoteRequestData>` | 견적 수락 |
| `cancelQuote` | `string (requestId)` | `ActionResult<QuoteRequestData>` | 견적 취소 |
| `getQuotesByPlan` | `string (planId)` | `ActionResult<QuoteRequestWithResponses[]>` | 플랜의 견적 목록 |
| `getVendorQuoteRequests` | `void` | `ActionResult<QuoteRequestData[]>` | 업체의 수신 견적 |
| `calculateQuoteTotal` | `string[] (moduleIds)` | `ActionResult<{ totalPrice: number }>` | 서버 측 가격 계산 |

### 3.3 Reservation Actions (`app/actions/reservation.ts`)

| 함수명 | 입력 타입 | 출력 타입 | 설명 |
|---|---|---|---|
| `createReservation` | `CreateReservationPayload` | `ActionResult<ReservationData>` | 예약 생성 |
| `confirmReservation` | `string (reservationId)` | `ActionResult<ReservationData>` | 업체 예약 확정 |
| `cancelReservation` | `string, string (id, reason)` | `ActionResult<ReservationData>` | 예약 취소 |
| `requestChange` | `string, Partial<ReservationData>` | `ActionResult<ReservationData>` | 예약 변경 요청 |

### 3.4 Transaction Actions (`app/actions/transaction.ts`)

| 함수명 | 입력 타입 | 출력 타입 | 설명 |
|---|---|---|---|
| `createTransaction` | `CreateTransactionPayload` | `ActionResult<TransactionData>` | 정산 내역 추가 |
| `bulkCreateTransactions` | `CreateTransactionPayload[]` | `ActionResult<TransactionData[]>` | 엑셀 일괄 등록 |
| `getTransactionSummary` | `string (planId)` | `ActionResult<TransactionSummary>` | 정산 통계 조회 |

## 4. Mock 데이터 가이드 (Claude Code용)

백엔드 API가 준비되기 전, Claude Code가 UI 개발에 사용할 Mock 데이터의 구조입니다. `__mocks__/` 디렉토리에 파일을 생성합니다.

```typescript
// __mocks__/quote-modules.ts
import { VendorServiceModuleData } from '@/types/vendor-module';

export const MOCK_WEDDING_MODULES: VendorServiceModuleData[] = [
  {
    id: 'mod-1', vendorId: 'v1', name: '본식 스냅 (2인 작가)',
    category: 'PHOTO', price: 1200000, description: '본식 전체 촬영',
    isBaseIncluded: false, isActive: true, sortOrder: 1,
  },
  {
    id: 'mod-2', vendorId: 'v1', name: '웨딩드레스 대여',
    category: 'DRESS', price: 800000, description: '프리미엄 드레스 1벌',
    isBaseIncluded: false, isActive: true, sortOrder: 2,
  },
  {
    id: 'mod-3', vendorId: 'v1', name: '신부 메이크업',
    category: 'MAKEUP', price: 500000, description: '본식 + 리허설',
    isBaseIncluded: true, isActive: true, sortOrder: 3,
  },
  // ... 추가 모듈
];

export const MOCK_BASE_PACKAGE = {
  name: '프리미엄 웨딩 패키지',
  price: 3500000,
  description: '대관료 + 기본 생화 장식 + 음향/조명',
};
```

## 5. 통합 체크리스트

Mock에서 실제 API로 전환할 때 확인해야 할 항목입니다.

| 항목 | 확인 내용 |
|---|---|
| 타입 일치 | Mock 데이터의 구조와 실제 API 응답의 구조가 동일한지 확인 |
| 에러 처리 | `ActionResult`의 `success: false` 케이스에 대한 UI 처리 존재 여부 |
| 로딩 상태 | API 호출 중 스켈레톤 UI 또는 로딩 스피너 표시 여부 |
| 빈 상태 | 데이터가 없을 때의 Empty State UI 존재 여부 |
| 낙관적 업데이트 | 모듈 선택/해제 시 서버 응답 전 UI 즉시 반영 여부 |
