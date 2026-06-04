# U07 Congratulatory / Condolence Money Settlement Branch Status

> Branch: `agy/u07-money-settlement`
> Owner/Agent: AGY
> Scope: Congratulatory/condolence money settlement MVP

## Goal

Implement manual settlement ledger MVP for congratulatory/condolence money.

## Product Rules

- MVP should use manual ledger entry first.
- Do not implement real bank/PG integration.
- Support name, amount, relationship, memo, event type, and summary totals.
- Wedding uses congratulatory money language.
- Funeral uses condolence money language.
- Keep privacy-sensitive information minimal.

## Expected Areas

- `prisma/schema.prisma`
- `prisma/migrations/`
- `app/actions/settlement.ts`
- `app/actions/transaction.ts` if reused
- `types/settlement.ts`
- `types/transaction.ts`
- `app/settlement/`
- `components/features/settlement/`
- settlement verification script

## Must Not Touch

- Reservation change/cancel action logic
- Mobile invitation/obituary UI except optional link placeholders
- Notification/alarm integration beyond TODO notes

## 추가한 스키마 및 모델 / Enum (Schema & Model Changes)

- **Prisma Schema**: 이번 MVP에서는 기존 `Transaction` 모델의 필드(`senderName`, `amount`, `relation`, `message`, `type`, `paidAt`)가 장부 요구사항을 완벽히 만족하므로 스키마 자체를 수정하거나 마이그레이션을 새로 추가하지 않고 기존 리소스를 재사용하였습니다.

## 추가한 Server Action (Server Actions)

- **`app/actions/settlement.ts`**:
  - `createSettlementEntry(payload)`: 수동 정산 장부 내역 등록
  - `updateSettlementEntry(id, payload)`: 등록된 정산 내역 수정
  - `deleteSettlementEntry(id)`: 등록된 정산 내역 삭제
  - `getSettlementEntries(planId)`: 특정 행사의 정산 내역 리스트 조회
  - `getSettlementSummary(planId)`: 총액, 건수, 평균액, 관계별/수단별 요약 정보 계산

## 추가한 Route / Component (Routes & Components)

- **Routes**:
  - `/plans/[id]/support`: 예약 확정 이후 행사 운영 지원을 통합 관리하는 서비스 허브 페이지 (신설)
  - `/plans/[id]/settlement`: 독립 정산 장부 대시보드 및 수동 입력 페이지 (유지)
- **Components** (`components/features/settlement/`):
  - `SettlementDashboard.tsx`: 정산 요약 및 관계별/수단별 통계 정보 컴포넌트
  - `SettlementLedger.tsx`: 검색, 필터링 및 리스트 뷰 테이블 컴포넌트
  - `SettlementFormModal.tsx`: 신규 등록, 수정 및 삭제 확인 UX 모달 컴포넌트
- **Page Integrations**:
  - `app/plans/[id]/page.tsx`: WEDDING/FUNERAL 타입 행사인 경우 직접 정산 장부로 가던 단추를 제거하고, 행사 지원 서비스 허브 페이지(`/plans/[id]/support`)로 연결되는 "행사 운영 지원 서비스 →" CTA 버튼으로 교체 통합 완료 (PASS)
  - **Planner Step 4 CTA**: planner Step 4에는 행사 운영 지원 허브로 이동하는 CTA만 추가했고, 정산 UI 자체는 삽입하지 않았다. (PASS)

## 검증 명령 결과 (Validation Log)

- **검증 스크립트 실행 (`npx tsx scripts/verify-money-settlement.ts`)**:
  - EventPlan 생성, Transaction 생성/수정/삭제, 총액/평균/건수 연산, 행사별(EventType) 텍스트 분리 및 cleanup 프로세스 자동 검증 완료 (통과)
  - **격리성 검증 통과**: 예약 결제 시뮬레이션용 데이터(`reservationId` 값 존재)가 동일한 `planId` 하위에 생성된 상태에서도, 수동 장부 정산 및 대시보드 통계 조회 결과에서 이 결제 건이 완전히 필터링되어 완벽히 분격 격리됨을 검증했습니다 (통과)
- **타입 검사 (`npx tsc --noEmit`)**:
  - 빌드 전 정적 타입 체크 통과 (통과)
- **린트 검사 (`npm run lint`)**:
  - ESLint 린트 오류 및 경고 없음 (통과)
- **빌드 테스트 (`npm run build`)**:
  - Next.js 최적화 프로덕션 빌드 성공 (통과)
- **Git 포맷 및 상태 검사**:
  - `git diff --check`: 오류 없음
  - `git status`: 변경 대상 파일들만 유효하게 추적됨

## 남은 이슈 & 알람 탭 연동 hook / TODO

- **알람 탭 연동 Hook (TODO)**:
  - 알림 및 활동 내역은 `support` 허브 페이지 내부가 아니라 별도의 알림 탭 또는 `/notifications` 계열 기능으로 분리되어 서비스될 예정입니다.
  - 수동 정산 내역이 추가/수정되거나, 향후 자동 이체 정산 기능이 확장될 시 알람 센터에 이벤트를 발행해야 합니다.
  - 이를 위해 `app/actions/settlement.ts` 내의 `createSettlementEntry` 수행 직후 `app/actions/notification.ts`의 `createNotification` 액션을 호출하는 이벤트 훅 연동 설계가 요구됩니다:
    ```typescript
    // TODO: 알람 탭 연동 시 추가할 코드 예시
    // await createNotification({
    //   userId: user.id,
    //   type: "SETTLEMENT_RECORDED",
    //   title: "정산 등록 완료",
    //   message: `${parsed.data.senderName}님의 ${isWedding ? '축의금' : '조의금'} ${parsed.data.amount.toLocaleString()}원이 등록되었습니다.`
    // });
    ```

## Merge Risks

- **Transaction 데이터 간섭**:
  - 기존에 `Transaction` 모델이 견적(Reservation) 등의 결제와 간섭이 생길 위험을 차단하기 위해, 예약 건에 연결되지 않은 수동 정산 트랜잭션은 `reservationId`를 `null`로 유지하며 `planId`를 필수 외래키 관계로써 안전하게 바인딩하여 처리했습니다.
  - 따라서 기존 PG 결제 트랜잭션 흐름과의 충돌 위험성은 극히 낮습니다.
