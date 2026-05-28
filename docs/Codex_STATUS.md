# Codex STATUS

작성 기준: 2026-05-28, `codex/step3-main-logic-rewrite` 브랜치 실제 코드와 로컬 검증 결과 기준. `docs/Claude_STATUS.md`는 읽기 전용으로만 확인했다. `PM-instruction.txt`는 repo root에 없어 확인하지 못했다.

## 1. 현재 백엔드 상태

Step 3 견적 요청의 표준 흐름은 다음 데이터 계약으로 정리되어 있다.

1. 일반 사용자가 Step 3에서 업체와 모듈을 선택한다.
2. `createQuoteRequest()`가 `QuoteRequest(PENDING)`와 `Reservation(PENDING, quoteRequestId)` placeholder를 함께 만든다.
3. 업체 dashboard는 로그인한 업체의 `Reservation`/`QuoteRequest` 연결 데이터를 조회해 요청을 본다.
4. 업체가 견적을 제출하면 `QuoteResponse`가 생성되고 `QuoteRequest.status=RESPONDED`가 된다.
5. 일반 사용자는 `getQuotesByPlan()`/`getQuoteRequestsByPlan()`으로 응답을 조회한다.
6. 일반 사용자가 `acceptQuoteResponse()`를 호출하면 `QuoteRequest.status=ACCEPTED`가 되고 기존 placeholder `Reservation(PENDING)`이 재사용된다.
7. 업체가 `confirmReservation()`을 호출해야 `Reservation(CONFIRMED)`가 된다.

중요한 상태 표현:

- 일반 사용자 액션은 “견적 수락”이다.
- 견적 수락 직후 상태는 “업체 최종 확정 대기”이며 `Reservation(PENDING)`이다.
- “예약 확정 완료”는 업체가 최종 확정한 `Reservation(CONFIRMED)`에서만 표시해야 한다.

## 2. 수정된 action 목록

- `app/actions/quote.ts createQuoteRequest(payload)`: active duplicate request 방지, `guestCount` 입력 지원, 선택 모듈의 인원 기반 예상금액 계산, base package 포함 모듈 저장.
- `app/actions/quote.ts getQuotesByPlan(planId)`: vendor, plan summary, selected module detail, reservation, responses를 포함한 DTO 반환.
- `app/actions/quote.ts getQuoteRequestsByPlan(planId)`: `getQuotesByPlan()` alias.
- `app/actions/quote.ts getQuoteRequestsForVendor()`: 로그인 업체 기준 요청/응답/플랜/모듈 detail 조회.
- `app/actions/quote.ts getVendorQuoteRequests()`: vendor 조회 alias.
- `app/actions/quote.ts getVendorServiceModules(vendorId)`: `pricingType` 포함 DTO 반환.
- `app/actions/quote.ts submitQuoteResponse(payload)`: 같은 `requestId + vendorId` 중복 응답 차단.
- `app/actions/quote.ts acceptQuoteResponse(payload)`: 이미 수락된 QuoteRequest 재수락 차단, 기존 reservation 재사용.
- `app/actions/reservation.ts confirmReservation(reservationId)`: 업체 최종 확정 표준 action으로 vendor dashboard에 연결됨.
- `app/api/reservations/[reservationId]/route.ts`: 일반 사용자 legacy `confirm` API가 `CONFIRMED`를 만들지 못하도록 차단.
- `app/api/vendor/reservations/[reservationId]/route.ts`, `app/vendor/actions.ts`: legacy vendor 응답 경로가 기존 QuoteResponse를 update하도록 보강.
- `app/api/reservations/route.ts`, `app/vendors/actions.ts`: legacy 견적 요청 경로도 active duplicate request를 차단.

## 3. 수정된 타입 목록

- `types/quote.ts`: `QuoteRequestDTO`, `QuoteResponseDTO`, `QuoteRequestWithResponsesDTO`, `QuoteRequestForVendorDTO`, `CreateQuoteRequestInput`, `SubmitQuoteResponseInput`, `AcceptQuoteResponseInput`, `QuoteLineItemDTO`, `VendorModuleDTO`, `QuoteRequestStatus`, `QuoteResponseStatus` alias 추가.
- `types/quote.ts`: `CreateQuoteRequestPayload.guestCount` 추가.
- `types/quote.ts`: `QuoteRequestWithResponses`에 `vendor`, `plan`, `selectedModuleDetails`, `reservation` optional field 추가.
- `types/vendor-module.ts`: `VendorServiceModuleData.pricingType` 추가.
- `types/reservation.ts`: `ReservationStatus`에 `COMPLETED` 포함.
- `components/features/planning/workspace-types.ts`: `ReservationItem`에 `quoteRequestId`, `quoteResponseId`, `quoteRequestStatus` 추가.

## 4. QuoteRequest 생성 흐름

`createQuoteRequest(payload)` 필수/주요 입력:

- `planId`
- `vendorId`
- `requirements`
- `selectedModuleIds`
- `guestCount`
- `preferredDate`
- `budget`

서버 동작:

- 로그인 사용자가 GENERAL인지 확인한다.
- plan owner와 `WEDDING | FUNERAL` plan인지 확인한다.
- vendor가 활성 승인 업체인지 확인한다.
- 같은 plan/vendor에 `PENDING | RESPONDED | ACCEPTED` 요청이 있으면 `QUOTE_REQUEST_ALREADY_EXISTS`를 반환한다.
- 선택 모듈이 해당 vendor의 active `VendorServiceModule`인지 검증한다.
- `CATERING`/`MEAL` 모듈 중 `1인`, `인당`, `/인`, `/명` 등 인원 기반 문구가 있는 항목은 `PER_GUEST`로 계산한다.
- `QuoteRequest(PENDING)`와 `Reservation(PENDING, quoteRequestId)` placeholder를 transaction으로 생성한다.

프론트 연결:

- `event-planning-workspace.tsx`가 `guestCount`를 action으로 전달한다.
- `modular-quote-builder.tsx`의 base package만 선택한 경우에도 `includedModuleKeys`가 `selectedModuleIds`에 포함된다.
- 모바일 하단 “견적 요청” 버튼도 동일한 `onRequestQuote` 경로를 사용한다.

## 5. Vendor QuoteRequest 조회 흐름

권장 action:

- `getQuoteRequestsForVendor()`

반환 DTO:

- `QuoteRequestWithResponsesDTO[]`
- 각 item에 request, vendor, plan summary, selected module detail, linked reservation, responses 포함.

현재 vendor dashboard:

- `/vendor/dashboard`는 기존 `Reservation` 기반 UI를 유지한다.
- page query에 `quoteRequest.status`, `quoteRequestId`, `quoteResponseId`를 포함해 업체가 “사용자 수락 대기”와 “예약 최종 확정”을 구분할 수 있다.

## 6. QuoteResponse 제출 흐름

표준 action:

- `submitQuoteResponse({ requestId, basePrice, modules, totalPrice, note })`

서버 동작:

- 로그인 사용자가 VENDOR인지 확인한다.
- 해당 요청이 로그인 업체의 `QuoteRequest(PENDING)`인지 확인한다.
- 이미 같은 `requestId + vendorId` 응답이 있으면 `QUOTE_RESPONSE_ALREADY_EXISTS`를 반환한다.
- `QuoteResponse`를 만들고 `QuoteRequest.status=RESPONDED`로 전이한다.
- 연결 placeholder reservation에 `quoteResponseId`, `quotedAmount`, 모듈 breakdown을 동기화한다. `confirmedAmount`는 업체 최종 확정 전까지 `null`로 유지한다.

DB 보강:

- `QuoteResponse(requestId, vendorId)` unique index 추가.
- `scripts/verify-quote-flow.ts`에 duplicate QuoteResponse 차단 smoke check 추가.

## 7. QuoteResponse 수락 흐름

표준 action:

- `acceptQuoteResponse({ quoteResponseId, reservedDate? })`

서버 동작:

- 로그인 사용자가 GENERAL인지 확인한다.
- 응답이 현재 사용자의 plan에 속하는지 확인한다.
- `QuoteRequest(RESPONDED)`만 `ACCEPTED`로 전이한다.
- 이미 `ACCEPTED`인 요청은 `QUOTE_ALREADY_ACCEPTED`를 반환한다.
- 기존 `Reservation(PENDING)` placeholder를 재사용하고 `quoteResponseId`를 연결한다.
- 반환 `nextAction`은 `reservation_pending` 또는 이미 확정된 경우 `confirmed`다.

## 8. Reservation 연결 흐름

`Reservation(PENDING)` 생성:

- `createQuoteRequest()` 시점에 placeholder로 생성된다.
- `acceptQuoteResponse()`는 새 reservation을 중복 생성하지 않고 placeholder를 재사용한다.

`Reservation(CONFIRMED)` 생성:

- 업체만 `confirmReservation(reservationId)`로 확정할 수 있다.
- vendor dashboard의 진행 중 제안 카드에서 `quoteRequestStatus === "ACCEPTED"`이면 “예약 최종 확정” 버튼이 표시된다.
- 일반 사용자 legacy confirm route는 더 이상 `CONFIRMED`를 만들 수 없다.

## 9. Seed 데이터 상태

`npm run db:seed` 후 확인된 상태:

- `users=6`
- `eventPlans=2`
- `reservations=4`
- `vendorServiceModules=16`
- `quoteRequests=5`
- `quoteResponses=3`

Demo 계정:

- 일반 사용자: `planner@yeon.local / demo1234`
- 업체 사용자: `venue@yeon.local / demo1234`
- 업체 사용자: `catering@yeon.local / demo1234`

## 10. 검증 결과

실행 완료:

- `npx prisma generate`: 통과.
- `npm run db:seed`: 통과.
- `node --import tsx scripts/verify-quote-flow.ts`: 통과.
- `npx tsc --noEmit --incremental false`: 통과.
- `npm run lint`: 통과, `✔ No ESLint warnings or errors`.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, `Database schema is up to date!`.
- `DATABASE_URL=file:/tmp/yeon-migrate-check-step3.db npx prisma migrate deploy`: 통과.

주의:

- 기존 로컬 DB는 이전 작업에서 `db push`로 이미 일부 schema가 반영된 상태였다.
- `npx prisma migrate dev`는 reset을 요구했으므로 실행하지 않았다.
- 대신 duplicate 데이터가 없음을 확인한 뒤 `QuoteResponse_requestId_vendorId_key`를 로컬 DB에 안전하게 추가하고 migration을 applied로 기록했다.

## 11. 수동 QA 시나리오

1. `planner@yeon.local / demo1234` 로그인.
2. `/planner` 또는 `/planner/wedding` 진입.
3. Step 3 “견적 요청”에서 업체 선택.
4. 모듈 또는 기본 패키지 선택.
5. 하객 수를 확인하고 견적 요청 제출.
6. 예상 데이터 변화: `QuoteRequest(PENDING)` 생성, `Reservation(PENDING, quoteRequestId, confirmedAmount=null)` 생성.
7. `venue@yeon.local / demo1234` 또는 `catering@yeon.local / demo1234` 로그인.
8. `/vendor/dashboard`에서 새 요청 확인.
9. 견적 금액/가능 일정/메모 입력 후 견적 제안 제출.
10. 예상 데이터 변화: `QuoteResponse` 생성, `QuoteRequest(RESPONDED)`, reservation에 `quoteResponseId`, `quotedAmount` 동기화. `confirmedAmount`는 아직 `null`.
11. `planner@yeon.local` 재로그인.
12. Step 4에서 견적 비교 및 응답 반영 확인.
13. “이 견적 수락하기” 클릭.
14. 예상 데이터 변화: `QuoteRequest(ACCEPTED)`, `Reservation(PENDING)` 유지, 화면 문구는 “업체 최종 확정 대기”.
15. 업체 계정으로 재로그인.
16. `/vendor/dashboard` 진행 중 제안에서 “예약 최종 확정” 클릭.
17. 예상 데이터 변화: `Reservation(CONFIRMED)`.
18. 일반 사용자 화면에서 “예약 확정 완료” 상태 확인.

## 12. 프론트가 의존해야 하는 DTO/action 목록

- Step 3 module load: `getVendorServiceModules(vendorId)` → `VendorModuleDTO[]`
- Step 3 submit: `createQuoteRequest(input)` → `QuoteRequestDTO`
- Step 4 quote list: `getQuotesByPlan(planId)` 또는 `getQuoteRequestsByPlan(planId)` → `QuoteRequestWithResponsesDTO[]`
- Step 4 accept: `acceptQuoteResponse(input)` → `AcceptQuoteResult`
- Vendor inbox/detail: `getQuoteRequestsForVendor()` → `QuoteRequestForVendorDTO[]`
- Vendor response: `submitQuoteResponse(input)` → `QuoteResponseDTO`
- Vendor final confirmation: `confirmReservation(reservationId)` → `ReservationData`

## 13. 남은 문제

- 실제 브라우저 클릭 QA는 아직 수동으로 필요하다.
- `VendorServiceModule.pricingType` 컬럼은 추가됐다. 운영 데이터 생성/관리 화면에서 이 값을 빠뜨리지 않게 하는 UI/운영 절차는 아직 필요하다.
- plan 단위로 하나의 업체만 최종 수락할지, 여러 업체/모듈 조합을 수락할 수 있게 둘지는 제품 정책 결정이 필요하다.
- `ReservationStatus`는 `CANCELED`로 단일화했다. `EventStatus`/`TransactionStatus`의 `CANCELLED`는 별도 도메인이므로 유지한다.

## 14. Claude/UI 담당자가 이어서 해야 할 작업

- 위 수동 QA 시나리오를 브라우저에서 끝까지 실행한다.
- Step 4에서 `ACCEPTED` 상태가 “예약 확정 완료”가 아니라 “업체 최종 확정 대기”로만 노출되는지 확인한다.
- Vendor dashboard에서 `quoteRequestStatus === "ACCEPTED"`인 진행 중 제안에만 “예약 최종 확정” 버튼이 보이는지 확인한다.
- base package만 선택한 Step 3 요청이 실제 DB에 생성되는지 UI에서 확인한다.

## 15. 2026-05-28 Step 3/4 UX 연결 보강

이번 보강은 디자인 개편이 아니라 실제 사용자 플로우의 끊김과 중복 액션 리스크를 줄이는 작업이다.

수정된 프론트 연결부:

- `components/features/planning/event-planning-workspace.tsx`
  - Step 3 견적 요청 성공 후 `getQuotesByPlan(planId)`를 즉시 재조회해 요청됨 상태와 Step 4 비교 데이터가 같은 클라이언트 상태를 바라보게 했다.
  - Step 4 `QuoteComparison`에 이미 보유한 `quoteRequestsData`를 DTO로 변환해 전달하도록 바꿔 중복 자동 fetch와 stale 화면 가능성을 줄였다.
  - 견적 요청/견적 수락 처리 중 `isQuoteActionPending`으로 버튼을 잠그고, 중복 클릭으로 같은 요청/수락이 반복 호출되지 않게 했다.
  - 성공 문구는 “견적 요청”, “업체 응답 대기”, “업체 최종 확정 대기” 흐름이 섞이지 않도록 조정했다.
- `components/features/planning/quote-comparison.tsx`
  - `mapQuoteRequestsToVendorQuotes()`를 export해 Step 4 parent 상태를 직접 표시할 수 있게 했다.
  - 비교 테이블의 수락 버튼이 `vendorId`가 아니라 실제 `quoteResponseId`를 넘기도록 정리했다.
  - 이미 수락된 응답은 `수락됨` badge와 disabled button으로 표시한다.
  - `quotes` prop이 있으면 내부 fetch를 하지 않아 parent와 child가 서로 다른 응답 목록을 보여주는 문제를 방지한다.
- `components/features/planning/modular-quote-builder.tsx`
  - 데스크톱 요약 패널, 모바일 하단 바, 모바일 bottom sheet의 견적 요청 버튼에 `isSubmitting` 상태를 연결했다.
  - 처리 중에는 “요청 보내는 중...”/“전송 중...” 문구와 disabled 상태로 중복 제출을 막는다.
- `components/features/planning/vendor-workspace.tsx`
  - 사용자가 수락한 제안(`quoteRequestStatus === "ACCEPTED"`)은 견적 금액/일정/메모 수정과 거절/재제안 버튼을 막았다.
  - 수락된 제안에는 “예약 최종 확정” callout과 CTA를 별도로 노출해 업체의 다음 액션을 명확히 했다.
  - 업체 견적 저장, 최종 확정, 완료 처리에는 reservation 단위 busy state를 적용해 중복 요청을 막았다.

추가 검증 결과:

- `npx tsc --noEmit --incremental false`: 통과.
- `npm run lint`: 통과, `✔ No ESLint warnings or errors`.
- `node --import tsx scripts/verify-quote-flow.ts`: 통과.
- `npm run build`: 통과.

남은 수동 QA:

- 브라우저에서 Step 3 요청 직후 같은 화면에서 요청됨 표시가 즉시 반영되는지 확인한다.
- 브라우저에서 Step 4 비교 테이블의 “이 견적 수락” 버튼이 실제 수락 후 즉시 `수락됨`으로 바뀌는지 확인한다.
- 업체 dashboard에서 수락된 제안을 수정하려 할 수 없고 “예약 최종 확정”만 가능한지 확인한다.
- 실제 세션 전환 후 planner/vendor 양쪽에서 같은 DB 상태가 일관되게 보이는지 확인한다.

## 16. 2026-05-28 런칭 페르소나 QA 및 추가 보강

이번 추가 작업은 실제 서비스 사용자 관점의 불편함을 기준으로 진행했다.

페르소나:

- 일반 사용자: `planner@yeon.local`. 행사 준비 경험이 많지 않고, “견적 요청을 보냈는지”, “업체가 답했는지”, “견적 수락 후 예약이 끝난 것인지”를 한눈에 알아야 한다.
- 업체 담당자: `venue@yeon.local`/`catering@yeon.local`. 새 요청을 빠르게 확인하고, 견적을 보낸 뒤 사용자가 수락하면 더 이상 견적을 수정하지 않고 “예약 최종 확정”만 해야 한다.

발견한 런칭 blocker:

- clean DB에서 `prisma migrate deploy` 후 `npm run db:seed`가 실패했다. 원인은 `schema.prisma`의 `Transaction`, `Invitation` 모델과 실제 migration SQL이 달라서 `Transaction.type`, `Invitation.isPublished` 등이 DB에 없던 migration drift였다.
- active QuoteRequest 중복 방지는 action의 사전 조회에 의존하고 있어 동시 클릭/race condition에서 중복 요청이 생길 수 있었다.
- legacy JSON/FormData 요청 경로는 DB unique 제약이 발생하면 사용자가 이해할 수 있는 409 메시지가 아니라 500으로 떨어질 수 있었다.
- 일반 사용자 Step 3 “보낸 요청 현황”은 서버 props 기반 reservation만 보여서 요청 직후 client refresh 전에는 최신 QuoteRequest 상태가 바로 보이지 않을 수 있었다.
- Step 4에는 “견적 수락”과 “업체 예약 확정”이 다른 단계라는 안내가 부족했다.
- 업체 dashboard는 사용자가 수락한 제안을 진행 중 제안과 같이 보여줘 최종 확정 필요 상태가 묻힐 수 있었다.

수정 내용:

- `prisma/migrations/20260528000000_launch_readiness_integrity/migration.sql`
  - `Transaction` 테이블을 현재 schema에 맞게 재구성했다. `reservationId`, `payerId`는 nullable로 맞추고 `planId`, `senderName`, `relation`, `message`, `type` 컬럼과 `Transaction_planId_type_idx`를 추가했다.
  - `Invitation` 테이블을 현재 schema에 맞게 재구성했다. `templateId`, `shareUrl`, `content`, `isPublished` 컬럼과 `Invitation_shareUrl_key`를 추가했다.
- `prisma/migrations/20260528003000_prevent_duplicate_active_quote_request/migration.sql`
  - `QuoteRequest(planId, vendorId)` partial unique index를 추가했다. `PENDING | RESPONDED | ACCEPTED`만 중복 차단하고 `CANCELED`는 재요청을 허용한다.
- `lib/errors.ts`
  - Prisma P2002 unique constraint 판별 helper를 추가했다.
- `app/actions/quote.ts`, `app/vendors/actions.ts`, `app/api/reservations/route.ts`
  - active QuoteRequest 중복을 DB 제약 기준으로도 잡고 사용자가 이해 가능한 `QUOTE_REQUEST_ALREADY_EXISTS`/409 메시지를 반환한다.
- `app/actions/quote.ts`, `app/api/vendor/reservations/[reservationId]/route.ts`, `app/vendor/actions.ts`
  - duplicate QuoteResponse를 명확한 오류로 처리한다.
  - `submitQuoteResponse()`는 base package 금액과 총액 합계가 payload와 일치하는지 검증한다.
- `scripts/verify-quote-flow.ts`
  - seed plan에 기존 active request가 있어도 smoke test가 안정적으로 돌도록 독립 smoke plan을 만든 뒤 정리한다.
  - active duplicate QuoteRequest는 실패하고 CANCELED request는 공존 가능한지 검증한다.
- `components/features/planning/event-planning-workspace.tsx`
  - Step 3 “보낸 요청 현황”을 `quoteRequestsData` 우선으로 표시해 요청 직후에도 최신 상태가 보이게 했다.
  - 상태 문구를 `업체 응답 대기`, `견적 도착`, `업체 최종 확정 대기`, `예약 확정 완료`로 분리했다.
  - Step 4 상단에 workflow guide를 추가해 견적 수락과 예약 확정이 다른 단계임을 명확히 했다.
- `components/features/planning/vendor-workspace.tsx`
  - 사용자가 수락한 제안을 “예약 최종 확정 필요”로 집계하고 상단에서 바로 proposals 패널로 이동할 수 있게 했다.

추가 검증 결과:

- `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-d.db npx prisma migrate deploy`: 통과.
- `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-d.db npm run db:seed`: 통과.
- `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-d.db node --import tsx scripts/verify-quote-flow.ts`: 통과.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: empty migration.
- `npx tsc --noEmit --incremental false`: 통과.
- `npx prisma generate`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, local `prisma/yeon.db` 기준 schema up to date.

Claude/UI 담당자 handoff:

- 브라우저에서 planner persona로 Step 3 요청 직후 “보낸 요청 현황”이 서버 새로고침 전에도 즉시 바뀌는지 확인한다.
- Step 4 workflow guide 문구가 모바일에서 너무 길거나 줄바꿈이 어색하지 않은지 조정한다.
- vendor persona로 사용자가 수락한 제안이 dashboard 상단 “예약 최종 확정 필요”로 바로 드러나는지 확인한다.
- UI polish를 하더라도 상태 용어는 `견적 요청`, `업체 응답 대기`, `견적 수락`, `업체 최종 확정 대기`, `예약 확정 완료`를 유지한다.

## 17. 2026-05-28 Production-grade 최종 감사 및 검증

이번 최종 감사는 “사용자와 업체가 실제로 끝까지 쓸 수 있는가”를 기준으로 다시 수행했다. `docs/Claude_STATUS.md`는 읽기만 했고 수정하지 않았다. `PM-instruction.txt`는 존재하지 않아 확인할 수 없었다.

감사 결과와 보강:

- `confirmedAmount`가 업체 제안 금액과 최종 확정 금액을 동시에 뜻하는 것처럼 쓰이는 잔여 로직을 정리했다. 이제 업체 응답/사용자 수락 단계의 금액은 `quotedAmount`, 업체 최종 확정 후 금액은 `confirmedAmount`다.
- `submitQuoteResponse()`와 legacy vendor 응답 경로는 `QuoteResponse` 제출 시 `quotedAmount`만 갱신하고 `confirmedAmount=null`을 유지한다.
- `acceptQuoteResponse()`는 `QuoteRequest(RESPONDED)`만 수락 가능하며, transaction 안에서 `updateMany({ status: RESPONDED })`로 동시 중복 수락을 막는다. 수락 후에도 `Reservation(PENDING, confirmedAmount=null)` 상태를 유지한다.
- `/plans/[id]`, planner workspace, vendor dashboard의 집계 기준을 `confirmedAmount`가 아니라 `quoteResponseId`와 `quoteRequestStatus` 중심으로 바꿨다.
- `ReservationStatus`의 `CANCELED`/`CANCELLED` 혼용을 DB migration과 Prisma enum에서 정리했다.
- `getVendorServiceModules()`와 `calculateQuoteTotal()`에도 로그인 검증을 추가해 export된 server action이 공개 조회처럼 열리지 않게 했다.
- `calculateQuoteTotal()`은 요청한 module id 수와 실제 active module 수가 다르면 `INVALID_MODULES`를 반환한다.
- `submitQuoteResponse()`는 이미 응답한 요청이면 상태 오류보다 먼저 `QUOTE_RESPONSE_ALREADY_EXISTS`를 반환한다.

수정된 파일:

- `app/actions/quote.ts`: QuoteRequest 생성, QuoteResponse 제출, QuoteResponse 수락, vendor module 조회, quote total 계산의 권한/중복/상태/금액 의미를 정리.
- `app/actions/reservation.ts`: 업체 최종 확정 action 기준 확인. `CONFIRMED`는 업체 action에서만 생성.
- `app/api/reservations/route.ts`: legacy 일반 사용자 요청 생성도 active duplicate QuoteRequest를 409로 처리.
- `app/api/vendor/reservations/[reservationId]/route.ts`: legacy vendor 응답 경로도 중복 QuoteResponse와 `quotedAmount`/`confirmedAmount` 의미를 맞춤.
- `app/plans/[id]/page.tsx`: 요청/제안/확정 집계와 금액 라벨을 `quoteResponseId`, `quoteRequest.status`, `quotedAmount`, `confirmedAmount` 기준으로 분리.
- `app/vendor/actions.ts`: legacy vendor action의 중복 응답 처리와 금액 의미 정리.
- `app/vendors/actions.ts`: legacy FormData 견적 요청 중복 처리 보강.
- `components/features/planning/event-planning-workspace.tsx`: Step 3 요청 현황, Step 4 guide, 상태 문구, 수락 후 대기 상태 표시 보강.
- `components/features/planning/vendor-workspace.tsx`: 수락된 제안을 “예약 최종 확정 필요”로 분리하고 수정/거절 대신 최종 확정 CTA만 노출.
- `lib/errors.ts`: Prisma unique constraint 판별 helper 추가.
- `lib/step3.shared.ts`: `ACCEPTED` workflow meta 추가 및 status summary 계산 정리.
- `scripts/verify-quote-flow.ts`: 독립 smoke plan 기반 QuoteRequest → QuoteResponse → Accept → Reservation(PENDING) → Confirm 검증과 duplicate/race 방지 검증 추가.
- `prisma/migrations/20260528000000_launch_readiness_integrity/migration.sql`: clean DB migration drift를 막기 위해 `Transaction`, `Invitation` 테이블을 현 schema와 정렬.
- `prisma/migrations/20260528000000_launch_readiness_integrity/migration.sql`: clean DB drift를 막기 위해 `Transaction`, `Invitation` 테이블을 현 schema와 정렬.
- `prisma/migrations/20260528003000_prevent_duplicate_active_quote_request/migration.sql`: active `QuoteRequest(planId, vendorId)` partial unique index 추가.

DTO/action 계약:

- `CreateQuoteRequestInput`: `planId`, `vendorId`, `requirements`, `selectedModuleIds`, optional `guestCount`, `preferredDate`, `budget`.
- `QuoteRequestDTO`: `id`, `planId`, `vendorId`, `requirements`, `selectedModules`, `preferredDate`, `budget`, `status`, `createdAt`.
- `SubmitQuoteResponseInput`: `requestId`, `basePrice`, `modules`, `totalPrice`, optional `note`.
- `QuoteResponseDTO`: `id`, `requestId`, `vendorId`, `basePrice`, `modules`, `totalPrice`, `note`, `createdAt`, optional `vendor`.
- `AcceptQuoteResponseInput`: `quoteResponseId`, optional `reservedDate`.
- `ReservationDTO`: `id`, `planId`, `vendorId`, `quoteRequestId`, `quoteResponseId`, `reservedDate`, `totalAmount`, `status`, timestamps, optional `vendor`, `quoteResponse`.
- Frontend 의존 action: `createQuoteRequest`, `getQuotesByPlan`, `getQuoteRequestsByPlan`, `getQuoteRequestsForVendor`, `getVendorServiceModules`, `submitQuoteResponse`, `acceptQuoteResponse`, `confirmReservation`.

완성된 실제 서비스 흐름:

- 일반 사용자 Step 3: `createQuoteRequest()`가 plan ownership, vendor approval, active module, duplicate active request를 확인하고 `QuoteRequest(PENDING)` + placeholder `Reservation(PENDING)`을 transaction으로 생성한다.
- 업체 dashboard: 로그인한 업체의 reservation/quoteRequest 연결 데이터를 조회하며, 새 요청은 `quoteResponseId=null`, 업체 응답 후 제안은 `quoteResponseId!=null`, 사용자 수락 후 최종 확정 대기는 `quoteRequestStatus=ACCEPTED`로 구분한다.
- 업체 QuoteResponse 제출: `submitQuoteResponse()` 또는 legacy vendor route/action이 같은 `requestId+vendorId` 중복을 막고 `QuoteRequest(RESPONDED)`, `QuoteResponse`, reservation `quotedAmount`를 동기화한다.
- 일반 사용자 응답 조회: `getQuotesByPlan()`/`getQuoteRequestsByPlan()`은 plan owner만 조회 가능하고 vendor, plan summary, selected modules, reservation, responses DTO를 한 번에 반환한다.
- 일반 사용자 견적 수락: `acceptQuoteResponse()`는 owner와 `RESPONDED` 상태를 검증하고 placeholder reservation을 재사용한다. 결과는 `Reservation(PENDING)`이며 화면 문구는 “업체 최종 확정 대기”다.
- 업체 최종 확정: `confirmReservation()`은 vendor owner와 `QuoteRequest(ACCEPTED)`를 확인한 뒤에만 `Reservation(CONFIRMED)`으로 전이하고 `confirmedAmount`를 확정한다.

권한/무결성 처리:

- Plan ownership: 일반 사용자 action은 `plan.ownerId === session.user.id`를 확인한다.
- Vendor ownership: 업체 action은 `vendorId === session.user.id` 또는 현재 vendor가 해당 reservation/quoteRequest 대상인지 확인한다.
- Invalid module/vendor: 승인/활성 업체와 해당 vendor의 active `VendorServiceModule`만 허용한다.
- Duplicate active QuoteRequest: app-level precheck와 DB partial unique index로 차단한다.
- Duplicate QuoteResponse: `QuoteResponse(requestId, vendorId)` unique index와 P2002 handling으로 차단한다.
- Duplicate Reservation: `Reservation.quoteRequestId`, `Reservation.quoteResponseId` unique relation과 `acceptQuoteResponse()`의 placeholder 재사용으로 차단한다.
- Duplicate accepted response: `acceptQuoteResponse()` transaction의 `updateMany(status=RESPONDED)` guard로 차단한다.
- 상태 전이: `lib/state-machine.ts`의 `PENDING → RESPONDED → ACCEPTED`, `PENDING → CONFIRMED` 규칙을 사용한다.

최종 검증 결과:

- `npx prisma generate`: 통과.
- `DATABASE_URL=file:/tmp/yeon-step3-final-20260528-2.db npx prisma migrate deploy`: 통과.
- `DATABASE_URL=file:/tmp/yeon-step3-final-20260528-2.db npm run db:seed`: 통과.
- `DATABASE_URL=file:/tmp/yeon-step3-final-20260528-2.db node --import tsx scripts/verify-quote-flow.ts`: 통과.
- `npm run db:seed`: 통과. `users=6`, `eventPlans=2`, `reservations=4`, `vendorServiceModules=16`, `quoteRequests=5`, `quoteResponses=3`.
- `node --import tsx scripts/verify-quote-flow.ts`: 통과. duplicate active request, duplicate response, confirm-before-accept, accepted pending, vendor confirm 검증 포함.
- `npx tsc --noEmit`: 통과. 2회 실행.
- `npm run lint`: 통과. 2회 실행.
- `npm run build`: 통과. 2회 실행.
- `npx prisma migrate status`: 통과, local `prisma/yeon.db` 기준 schema up to date.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: empty migration.
- mock/TODO grep: Step 3 핵심 DB 흐름에는 mock/local-only 경로가 남아 있지 않다. 남은 mock 참조는 AI 추천, auth verification, transaction method enum, seed/demo, `ModularQuoteBuilder`의 vendorModules 미제공 fallback, 오래된 프로젝트 지시 문서다.
- quote/reservation grep: Step 3/4 핵심 action과 사용처가 `createQuoteRequest`, `getQuotesByPlan`, `submitQuoteResponse`, `acceptQuoteResponse`, vendor reservation confirm 흐름으로 연결되어 있음을 재확인했다.

브라우저 수동 QA 절차:

1. `planner@yeon.local / demo1234`로 로그인한다.
2. `/planner/wedding`에 진입한다.
3. Step 3 견적 요청 영역에서 업체를 선택한다.
4. 서비스 모듈을 선택하고 하객 수, 요청 메모, 예산을 확인한다.
5. 견적 요청을 제출한다.
6. 예상 변화: `QuoteRequest(PENDING)`, `Reservation(PENDING, quoteRequestId, quoteResponseId=null, confirmedAmount=null)` 생성. 화면은 “업체 응답 대기”.
7. `venue@yeon.local / demo1234` 또는 `catering@yeon.local / demo1234`로 로그인한다.
8. `/vendor/dashboard`에서 방금 생성된 요청을 확인한다.
9. 모듈, 인원, 요청사항을 확인하고 견적 금액과 메시지를 입력해 견적 응답을 제출한다.
10. 예상 변화: `QuoteResponse` 생성, `QuoteRequest(RESPONDED)`, reservation `quoteResponseId` 연결, `quotedAmount` 갱신, `confirmedAmount=null`.
11. `planner@yeon.local`로 재로그인한다.
12. Step 4 견적 비교 영역에서 업체 응답을 확인한다.
13. 특정 견적을 수락한다.
14. 예상 변화: `QuoteRequest(ACCEPTED)`, `Reservation(PENDING)` 유지, 화면 문구는 “업체 최종 확정 대기”.
15. 업체 계정으로 다시 로그인한다.
16. `/vendor/dashboard`에서 “예약 최종 확정 필요” 상태를 확인하고 예약 최종 확정을 실행한다.
17. 예상 변화: `Reservation(CONFIRMED)`, `confirmedAmount` 설정.
18. 일반 사용자 계정으로 돌아와 `Reservation(CONFIRMED)`과 “예약 확정 완료” 문구를 확인한다.

남은 문제와 Claude/UI handoff:

- 실제 브라우저 자동 조작은 이번 환경에서 수행하지 못했다. 위 수동 QA는 사용자가 직접 클릭 검증해야 한다.
- `ModularQuoteBuilder`의 mock fallback은 DB module이 비어 있는 경우의 UI fallback으로 남아 있다. 런칭 전에는 seed/운영 데이터에 vendorModules가 항상 존재하는지 확인하고, fallback 문구가 실제 견적 요청처럼 오해되지 않게 UI 표시를 조정하는 것이 좋다.
- AI 추천과 인증 코드는 아직 mock 기반이다. 이번 Step 3 견적/예약 DB 흐름과 직접 관련 없는 범위라 수정하지 않았다.
- `ReservationStatus`는 `CANCELED`로 단일화됐지만, 오래된 UI/문서/외부 데이터가 `CANCELLED`를 전송하지 않는지 브라우저 QA가 필요하다.
- `VendorServiceModule.pricingType` 컬럼은 추가됐지만, 업체 관리 UI에서 `FLAT | PER_GUEST`를 직접 관리하는 화면은 아직 없다.
- Claude/UI 담당자는 Step 4에서 `ACCEPTED`가 절대 “예약 확정 완료”로 보이지 않는지, vendor dashboard에서 수락된 제안이 수정/거절 대신 최종 확정만 가능하게 보이는지 모바일까지 확인해야 한다.

## 18. 2026-05-28 보완 플랜 실행 결과

사용자/업체 워크플로우 감사 후 남겼던 보완 플랜 중 Step 3 견적/예약 런칭 안정성에 직접 영향을 주는 항목을 실제 구현했다.

적용한 보완:

- `VendorServiceModule.pricingType`을 DB 컬럼으로 추가했다. 이제 식대/케이터링 금액 계산은 이름/설명 추론이 아니라 저장된 `FLAT | PER_GUEST` 계약을 기준으로 한다.
- `prisma/migrations/20260528001000_quote_workflow_contract_cleanup/migration.sql`을 추가했다. 기존 `VendorServiceModule` row는 식대성 문구를 기준으로 1회 backfill하고, 기존 `Reservation.status='CANCELLED'` 데이터는 `CANCELED`로 정규화한다.
- `ReservationStatus` Prisma enum에서 `CANCELLED`를 제거하고 `CANCELED`로 단일화했다. Event/Transaction의 `CANCELLED`는 별도 도메인이라 유지한다.
- `createQuoteRequest()`의 예상 견적 계산과 reservation selected options 생성이 `VendorServiceModule.pricingType` 컬럼을 사용하도록 변경했다.
- `getVendorServiceModules()` DTO는 DB pricingType을 그대로 정규화해 반환한다.
- seed의 `VendorServiceModule` 데이터에 `PER_GUEST` 항목을 명시했다. 응답만 도착한 seed reservation은 `confirmedAmount=null`, 업체 최종 확정 후에만 `confirmedAmount`가 채워지도록 정리했다.
- vendor dashboard의 견적 입력 field/state/API payload 이름을 `proposalAmount`로 바꿨다. backend route는 기존 `confirmedAmount` payload도 임시 호환으로 받지만, 새 UI는 `proposalAmount`를 보낸다.
- legacy `app/vendor/actions.ts` 내부 변수도 `proposalAmount`로 바꿔 “견적 제안 금액”과 “최종 확정 금액” 의미가 섞이지 않게 했다.
- smoke script가 `PER_GUEST` 모듈을 발견하면 guest count 기반으로 `quotedAmount`를 계산하도록 바꿨다.

로컬 DB 처리:

- 로컬 `prisma/yeon.db`에는 `QuoteRequest_active_planId_vendorId_key` 인덱스가 이미 존재했으나 clean DB migration에는 누락되어 있었다.
- 중복으로 먼저 생성했던 잘못된 migration은 실패 기록을 `rolled-back` 처리하고 파일/디렉터리를 제거했다.
- 이후 `IF NOT EXISTS`를 사용하는 `20260528003000_prevent_duplicate_active_quote_request` forward migration으로 local DB와 clean DB를 모두 안전하게 정렬했다.

추가 검증 결과:

- `npx prisma generate`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-contract-cleanup-20260528-1.db npx prisma migrate deploy`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-contract-cleanup-20260528-1.db npm run db:seed`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-contract-cleanup-20260528-1.db node --import tsx scripts/verify-quote-flow.ts`: 통과.
- local `npx prisma migrate deploy`: 통과.
- local `npm run db:seed`: 통과.
- local `node --import tsx scripts/verify-quote-flow.ts`: 통과.
- local DB 직접 확인: `VendorServiceModule.pricingType='PER_GUEST'` 4건, `Reservation.status='CANCELLED'` 0건.
- `npx tsc --noEmit --incremental false`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, schema up to date.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: empty migration.
- mock/TODO grep: Step 3 핵심 DB 흐름은 mock/local-only가 아니다. 남은 mock은 AI 추천, auth verification, transaction method enum, demo seed, `ModularQuoteBuilder` fallback, 오래된 지시 문서다.

아직 구현하지 못한 항목과 이유:

- 실제 이메일/SMS 인증 발송과 실제 AI 추천 provider 연동은 API key/provider 선택이 필요하다. 현재 repo에는 provider 설정이 없어 임의 구현하면 오히려 런칭 장애가 된다.
- 브라우저 E2E 자동화는 Playwright dependency가 없고, 현재 환경에서 브라우저 조작을 실행하지 못했다. 대신 clean DB + Prisma smoke + Next build로 backend/data contract를 검증했다.

사용자/업체 워크플로우 관점 추가 보완 플랜:

- 일반 사용자 Step 3: 업체 선택 후 “이 업체는 어떤 항목을 응답할 수 있는지”를 더 명확히 보여야 한다. 현재 모듈은 보이지만, 업체가 응답하기 전까지 사용자는 요청이 제대로 전달됐는지 불안할 수 있다. 요청 완료 후 vendor name, selected modules, 예상 금액, 다음 단계 안내를 한 화면에 고정 표시하는 UX 보강이 필요하다.
- 일반 사용자 Step 4: 응답이 없는 요청과 응답이 도착한 요청을 더 강하게 분리해야 한다. “업체 응답 대기”와 “견적 비교 가능”이 같은 영역에 섞이면 수락 가능 여부가 모호하다.
- 일반 사용자 수락 후: `Reservation(PENDING)` 상태에서 업체가 언제 확정해야 하는지 SLA/기한이 없다. `expiresAt` 또는 `vendorConfirmationDueAt`를 추가해 “업체가 N일까지 최종 확정” 안내를 제공하는 것이 좋다.
- 업체 dashboard: 새 요청, 제안 보냄, 사용자 수락 완료, 확정 완료가 같은 reservation list 기반이라 장기적으로는 `QuoteRequest` 중심 inbox와 `Reservation` 중심 schedule을 분리하는 편이 운영자에게 더 명확하다.
- 업체 견적 작성: 현재 legacy route는 단일 금액 제안 중심이다. 실제 런칭에는 line item 편집, `PER_GUEST` 수량 확인, 할인/옵션 제외 사유 입력이 필요하다.
- 중복/동시성: DB unique와 transaction guard는 들어갔지만, 브라우저에서 빠른 더블클릭/뒤로가기/새로고침 시 toast와 disabled 상태가 충분한지는 수동 QA가 필요하다.
- 알림: 사용자가 견적 요청을 보내거나 업체가 응답/확정했을 때 이메일/SMS/앱 알림이 없다. 실제 서비스에서는 `Notification` 또는 `ActivityLog` 모델을 추가해 양쪽 사용자가 상태 변화를 놓치지 않게 해야 한다.
- 운영 감사: QuoteRequest/QuoteResponse/Reservation 상태 변경 로그가 없다. 런칭 전 `AuditLog` 또는 도메인 이벤트 테이블을 추가하면 CS 대응이 가능하다.
- 결제/거래: `TransactionMethod.MOCK`이 남아 있다. 예약 확정 이후 결제 또는 축의/조의금 플로우를 런칭 범위에 넣는다면 실제 PG/계좌이체 정책을 분리해야 한다.

## 19. 2026-05-28 런칭 보완 플랜 실제 수행

이번 보완은 Step 3 견적 요청 흐름을 런칭 직전 관점에서 다시 보강했다. 핵심 목표는 “요청/응답/수락/최종확정이 DB에 남고, 양쪽 사용자가 다음 행동을 놓치지 않는 것”이다.

실제 구현한 항목:

- `Notification` 모델을 추가했다. 견적 요청 수신, 견적 응답 도착, 견적 수락, 예약 확정/취소/완료 등 핵심 상태 변화가 대상 사용자에게 저장된다.
- `ActivityLog` 모델을 추가했다. CS/운영자가 나중에 상태 변경 흐름을 추적할 수 있도록 actor, plan, vendor, quoteRequest, quoteResponse, reservation 참조와 이벤트 타입을 남긴다.
- `Reservation.vendorConfirmationDueAt`을 추가했다. 사용자가 견적을 수락하면 업체가 최종 확정해야 하는 기한을 3일 뒤로 저장한다.
- 업체가 `confirmReservation()`으로 최종 확정하면 `Reservation(CONFIRMED)`, `confirmedAmount`, `vendorConfirmationDueAt=null`로 정리되고 사용자 알림/활동 로그가 생성된다.
- 일반 사용자/업체 legacy API route에도 notification/activity log를 추가해 Server Action 경로와 route 경로가 다른 데이터를 만들지 않게 했다.
- `/api/health`를 추가했다. 배포 환경에서 DB 연결 가능 여부를 안전하게 확인할 수 있다. 사용자 수 같은 내부 카운트는 반환하지 않는다.
- `scripts/launch-readiness-smoke.ts`를 추가했다. demo 계정, wedding/funeral seed, approved vendor, `PER_GUEST` module, Notification/ActivityLog 테이블, legacy `CANCELLED` 잔존 여부, workflow event write/delete를 검증한다.
- `scripts/verify-quote-flow.ts`를 확장했다. QuoteRequest 생성, QuoteResponse 제출, 수락, `vendorConfirmationDueAt` 설정, 업체 최종 확정 후 due 제거, Notification/ActivityLog 생성까지 검증한다.
- planner 화면과 vendor dashboard에 “확정 요청 기한”을 최소 표시했다. UI 대개편 없이 기존 카드/문구에만 붙였다.

수정된 주요 파일:

- `prisma/schema.prisma`: `Notification`, `ActivityLog`, `Reservation.vendorConfirmationDueAt` 추가.
- `prisma/migrations/20260528002000_workflow_notifications_and_sla/migration.sql`: workflow observability와 SLA 컬럼 migration.
- `lib/workflow-events.ts`: workflow notification/activity helper와 업체 확정 SLA 계산 helper.
- `app/actions/quote.ts`: QuoteRequest 생성, QuoteResponse 제출, QuoteResponse 수락 시 notification/activity/SLA 생성.
- `app/actions/reservation.ts`: pending reservation 생성, 업체 최종 확정, 취소 시 notification/activity/SLA 처리.
- `app/api/reservations/route.ts`: legacy 일반 사용자 QuoteRequest 생성 route에도 notification/activity 생성.
- `app/api/reservations/[reservationId]/route.ts`: 사용자 예약 변경/취소 route에 업체 알림과 활동 로그 추가.
- `app/api/vendor/reservations/[reservationId]/route.ts`: 업체 견적 응답/거절/완료 route에 사용자 알림과 활동 로그 추가.
- `app/api/health/route.ts`: DB health check route.
- `types/reservation.ts`, `components/features/planning/workspace-types.ts`: `vendorConfirmationDueAt` DTO 필드 추가.
- `app/planner/wedding/page.tsx`, `app/planner/funeral/page.tsx`, `app/vendor/dashboard/page.tsx`: reservation DTO에 `vendorConfirmationDueAt` 포함.
- `components/features/planning/event-planning-workspace.tsx`, `components/features/planning/vendor-workspace.tsx`, `app/plans/[id]/page.tsx`: 업체 최종 확정 대기 기한 표시.
- `scripts/verify-quote-flow.ts`, `scripts/launch-readiness-smoke.ts`: 실제 DB smoke 검증.

현재 실제 서비스 흐름:

- 일반 사용자가 Step 3에서 업체/모듈을 선택하고 견적 요청을 보내면 `QuoteRequest(PENDING)`와 placeholder `Reservation(PENDING)`이 생성된다. 업체에게 `QUOTE_REQUEST_RECEIVED` 알림과 활동 로그가 생성된다.
- 업체가 dashboard에서 견적 응답을 제출하면 `QuoteResponse`가 생성 또는 갱신되고 `QuoteRequest(RESPONDED)`, reservation `quotedAmount`가 동기화된다. 일반 사용자에게 `QUOTE_RESPONSE_RECEIVED` 알림과 활동 로그가 생성된다.
- 일반 사용자가 견적을 수락하면 `QuoteRequest(ACCEPTED)`와 `Reservation(PENDING)`이 유지되고 `vendorConfirmationDueAt`이 설정된다. 업체에게 `QUOTE_RESPONSE_ACCEPTED` 알림과 활동 로그가 생성된다.
- 업체가 예약을 최종 확정하면 `Reservation(CONFIRMED)`, `confirmedAmount`, `vendorConfirmationDueAt=null`이 저장된다. 일반 사용자에게 `RESERVATION_CONFIRMED` 알림과 활동 로그가 생성된다.
- 업체가 완료 처리하거나 사용자/업체가 취소하면 해당 상태 변경도 notification/activity에 남는다.

검증 결과:

- `npx prisma format`: 통과.
- `npx prisma generate`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-2.db npx prisma migrate deploy`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-2.db npm run db:seed`: 통과.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-2.db node --import tsx scripts/verify-quote-flow.ts`: 통과. workflow notification/activity와 SLA 검증 포함.
- clean temp DB `DATABASE_URL=file:/tmp/yeon-launch-readiness-20260528-2.db node --import tsx scripts/launch-readiness-smoke.ts`: 통과.
- local `npx prisma migrate deploy`: 통과. `20260528002000_workflow_notifications_and_sla` 적용.
- local `npm run db:seed`: 통과.
- local `node --import tsx scripts/verify-quote-flow.ts`: 통과.
- local `node --import tsx scripts/launch-readiness-smoke.ts`: 통과.
- `npx tsc --noEmit --incremental false`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과. local DB schema up to date.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: empty migration.
- MCP/browser verification: 사용 가능한 MCP를 검색했지만 브라우저/Playwright 조작 도구는 제공되지 않았고 OpenAI Platform key setup 도구만 노출됐다. 실제 클릭 기반 E2E는 수행하지 못했다.

남은 mock/TODO 범위:

- Step 3 핵심 DB 흐름에는 mock/local-only 경로가 아니다.
- 남은 mock은 AI 추천, auth verification, `TransactionMethod.MOCK`, demo seed, `ModularQuoteBuilder`의 vendorModules 미제공 fallback, 오래된 프로젝트 지시 문서다.
- AI 추천과 인증 발송은 provider/API key 선택이 필요해 이번 변경에서 임의 구현하지 않았다.

사용자/업체 워크플로우 추가 보완 플랜:

- 알림 UI: `Notification` DB 모델은 추가됐지만 알림센터/읽음 처리 UI는 아직 없다. planner nav와 vendor dashboard 상단에 미확인 알림 count와 상태 변경 내역을 표시해야 한다.
- SLA 운영: `vendorConfirmationDueAt`은 저장/표시된다. 다음 단계는 기한 초과 vendor를 dashboard에서 강조하고, 자동 리마인드/자동 취소 정책을 정하는 것이다.
- 업체 견적 작성: 현재 route 기반 견적 응답은 단일 제안 금액 중심이다. 실제 런칭 품질을 위해 line item 편집, `PER_GUEST` 수량 잠금, 옵션 제외 사유, 유효기간 입력을 vendor editor로 통일해야 한다.
- 사용자 Step 4: 응답 대기/응답 도착/수락 완료 카드가 한 화면에 섞인다. 런칭 전에는 “수락 가능한 견적”과 “확정 대기”를 더 분리해 오조작을 줄이는 UI 개선이 필요하다.
- 운영 대시보드: `ActivityLog`는 저장되지만 관리자 조회 화면은 없다. CS 대응용 admin activity timeline을 추가해야 한다.
- 인증/AI/결제: 실제 SMS/email provider, AI provider, PG/정산 정책은 아직 런칭 blocker다. Step 3 견적/예약 흐름과 별도 트랙으로 provider 선택과 env validation을 구현해야 한다.
- 브라우저 E2E: Playwright dependency 또는 브라우저 MCP가 연결되면 `planner@yeon.local` → `venue@yeon.local` → `planner@yeon.local` → vendor confirm 전체 클릭 흐름을 자동화해야 한다.

## 20. 2026-05-28 Chrome QA High Priority Fix

Chrome MCP QA 이후 main merge 전 High Priority 버그만 좁게 수정했다. 새 기능 추가나 UI 대개편은 하지 않았다.

수정한 버그:

- BUG-01 `/planner/wedding?planId=...` 새로고침 시 Step 2로 초기화
  - `app/planner/wedding/page.tsx`, `app/planner/funeral/page.tsx`가 `step` query를 파싱해 `EventPlanningWorkspace.initialStep`으로 전달한다.
  - `EventPlanningWorkspace`는 `step=1..4`만 허용하고, 잘못된 값은 서버 props 기반 plan 상태로 fallback한다.
  - plan 상태 기반 fallback은 quote/reservation 상태를 AI 추천 여부보다 먼저 본다. `PENDING` request는 Step 3, `RESPONDED`/`ACCEPTED`/`CONFIRMED` 흐름은 Step 4로 진입한다.
- BUG-02 `/plans`의 “견적 비교하기”가 Step 2로 랜딩
  - `/plans` CTA 링크에 `step` query를 붙인다.
  - `compare_quotes`, `accept_quote`, `reservation_pending`, `confirmed`는 `step=4`로 이동한다.
  - `create_quote_request`, `waiting_for_vendor`, `canceled`는 `step=3`으로 이동한다.
- BUG-03 업체 최종 확정 후 Step 4 “업체 최종 확정 대기 중”에 계속 표시
  - Step 4의 `acceptedRequests`는 `QuoteRequest.status === "ACCEPTED"`만 보지 않고 `reservation.status === "PENDING"`인 항목만 포함한다.
  - `Reservation(CONFIRMED|COMPLETED)`는 확정된 예약 섹션에만 표시된다.
  - `confirmReservation()`의 revalidate path는 기존 구현상 `/plans`, `/planner`, `/planner/wedding`, `/planner/funeral`, `/vendor/dashboard`를 이미 포함한다.
- BUG-06 `/vendor/requests` 404
  - `app/vendor/requests/page.tsx`를 추가해 `/vendor/dashboard`로 redirect한다.

검증 결과:

- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과. 빌드 route 목록에 `/vendor/requests` 포함.
- `npm run db:seed`: 통과.
- `npx tsx scripts/verify-quote-flow.ts`: sandbox IPC 제한으로 1회 `EPERM` 실패 후 sandbox 밖 재실행 통과.
- `npx tsx scripts/launch-readiness-smoke.ts`: sandbox 밖 재실행 통과.

Claude/UI 담당자 handoff:

- `/plans`에서 “견적 비교하기” 클릭 시 `/planner/{type}?planId=...&step=4`로 이동하고 Step 2가 보이지 않는지 브라우저에서 확인한다.
- `/planner/wedding?planId=...&step=3`, `step=4`, 잘못된 `step=abc`를 각각 새로고침해 query 우선/상태 기반 fallback이 맞는지 확인한다.
- 업체 최종 확정 후 Step 4에서 동일 항목이 “업체 최종 확정 대기 중”과 “확정된 예약”에 동시에 표시되지 않는지 확인한다.
- `/vendor/requests` 직접 접근이 `/vendor/dashboard`로 redirect되는지 확인한다.
