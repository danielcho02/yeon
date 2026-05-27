# Codex STATUS

작성 기준: 2026-05-27, `codex/step3-main-logic-rewrite` 브랜치 실제 코드와 로컬 검증 결과 기준. `docs/Claude_STATUS.md`는 읽기 전용으로만 확인했다. `PM-instruction.txt`는 repo root에 없어 확인하지 못했다.

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
- 연결 placeholder reservation에 `quoteResponseId`, `quotedAmount`, `confirmedAmount`, 모듈 breakdown을 동기화한다.

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
10. 예상 데이터 변화: `QuoteResponse` 생성, `QuoteRequest(RESPONDED)`, reservation에 `quoteResponseId`와 금액 동기화.
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
- `VendorServiceModule`에는 schema-level `pricingType` 컬럼이 없어서 현재는 서버가 이름/설명 문구로 `PER_GUEST`를 추론한다. 장기적으로는 schema에 명시 컬럼을 추가하는 편이 더 안정적이다.
- plan 단위로 하나의 업체만 최종 수락할지, 여러 업체/모듈 조합을 수락할 수 있게 둘지는 제품 정책 결정이 필요하다.
- `ReservationStatus.CANCELED`와 `CANCELLED`가 공존한다. 이번 작업에서는 표준 action은 `CANCELED`, legacy route는 기존 호환을 유지했다.

## 14. Claude/UI 담당자가 이어서 해야 할 작업

- 위 수동 QA 시나리오를 브라우저에서 끝까지 실행한다.
- Step 4에서 `ACCEPTED` 상태가 “예약 확정 완료”가 아니라 “업체 최종 확정 대기”로만 노출되는지 확인한다.
- Vendor dashboard에서 `quoteRequestStatus === "ACCEPTED"`인 진행 중 제안에만 “예약 최종 확정” 버튼이 보이는지 확인한다.
- base package만 선택한 Step 3 요청이 실제 DB에 생성되는지 UI에서 확인한다.
