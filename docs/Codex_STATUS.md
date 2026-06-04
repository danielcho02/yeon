> **HISTORICAL ARCHIVE** — This document records session work as of 2026-05-28.
> For the current project state, see [STATUS.md](../STATUS.md) and [docs/AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md).
> The frontend/backend agent split described here is retired.

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

## 16. 2026-05-29 Auth Runtime QA Blocker

Domain Mapping Browser QA 중 `/api/auth/signout?callbackUrl=%2Flogin`에서 `Cannot find module './vendor-chunks/jose.js'` Server Error가 발생했다.

확인 결과:

- `package.json`/`package-lock.json`에는 `next-auth`가 존재한다.
- `npm ls next-auth`: `next-auth@4.24.14`.
- `npm ls jose`: `next-auth` 하위 `jose@4.15.9`.
- `node_modules/jose`는 존재했다.
- 오류 당시 `.next/server/vendor-chunks/jose.js`가 없었다.
- auth route는 `app/api/auth/[...nextauth]/route.ts`의 기본 NextAuth handler다.
- 별도 middleware 파일은 확인되지 않았다.

조치:

- `.next` cache를 삭제했다.
- WSL 비로그인 셸에서는 Windows `npm`이 잡혀 `next dev`가 CMD/UNC 경로로 실패할 수 있음을 확인했다.
- dev server 실행 시 `source ~/.nvm/nvm.sh; npm run dev` 형태로 Linux Node를 먼저 로드해야 한다.
- `.next` 재생성 후 `/api/auth/signout?callbackUrl=%2Flogin`은 200 Sign Out page를 반환했고 `vendor-chunks/jose.js` Server Error는 재현되지 않았다.

Chrome MCP QA 중 세션 고정 시 처리 방법:

1. dev server를 중지한다.
2. `rm -rf .next`를 실행한다.
3. `source ~/.nvm/nvm.sh; npm run dev`로 dev server를 다시 띄운다.
4. `/api/auth/signout?callbackUrl=%2Flogin`에 접속해 Sign Out page가 뜨는지 확인한다.
5. Sign out 후 `/login`에서 원하는 demo 계정으로 다시 로그인한다.

계정 전환 정상 확인:

- `/api/auth/signout?callbackUrl=%2Flogin`: 200, Server Error 없음.
- `/login`: 200, login input 표시.
- `planner@yeon.local / demo1234`: `/plans` 접근 및 “내 행사 현황” marker 확인.
- `venue@yeon.local / demo1234`: `/vendor/dashboard` 접근 및 “모먼트 가든” marker 확인.
- `catering@yeon.local / demo1234`: `/vendor/dashboard` 접근 및 “오르세 플로럴” marker 확인.

남은 주의:

- Windows PowerShell에서 WSL 명령을 직접 실행하면 `PATH`에 Windows `npm`이 먼저 잡힐 수 있다.
- Browser QA 전에는 WSL Linux Node가 활성화된 dev server인지 확인해야 한다.

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

## 21. 2026-05-28 Backend Readiness 보강

이번 작업은 Chrome MCP 재QA나 UI 수정 없이 Codex 담당 영역의 서버 validation, notification action 계약, workflow smoke test, handoff 문서를 보강했다. `components/`, `hooks/`, `app/globals.css`, `tailwind.config.ts`, `docs/Claude_STATUS.md`는 수정하지 않았다.

강화한 서버 validation:

- `createQuoteRequest()`:
  - `selectedModuleIds`가 비어 있으면 `최소 1개 이상의 서비스를 선택해 주세요.`를 반환한다.
  - `vendorId`가 없으면 `견적 요청을 보낼 업체를 선택해 주세요.`를 반환한다.
  - 존재하지 않거나 비활성/미승인 vendor는 `업체를 찾을 수 없습니다.`로 거부한다.
  - vendor의 `supportedEventTypes`가 plan type과 맞지 않으면 `선택한 업체는 이 행사 유형을 지원하지 않습니다.`로 거부한다.
  - 선택 모듈이 해당 vendor의 active `VendorServiceModule`이 아니면 `선택한 모듈이 유효하지 않습니다.`로 거부한다.
  - plan type과 맞지 않는 module category는 `행사 유형과 맞지 않는 서비스가 포함되어 있습니다.`로 거부한다.
  - plan owner가 아니면 기존대로 `플랜을 찾을 수 없습니다.`로 조회/생성을 차단한다.
- `submitQuoteResponse()`:
  - `requestId`가 없으면 `견적 요청 ID가 필요합니다.`를 반환한다.
  - 현재 사용자가 vendor가 아니면 `업체 사용자만 실행할 수 있습니다.`가 ActionResult error로 내려간다.
  - 요청 대상 vendor가 아니면 `이 요청에 응답할 권한이 없습니다.`로 거부한다.
  - `totalPrice <= 0`이면 `견적 총액은 0원보다 커야 합니다.`로 거부한다.
  - 이미 같은 `requestId + vendorId` 응답이 있으면 `이미 제출한 견적 응답이 있습니다.`로 거부한다.
  - base package 금액 또는 총액 합계가 payload와 다르면 기존 mismatch error를 유지한다.
- `acceptQuoteResponse()`:
  - 현재 plan owner가 아닌 사용자는 응답을 찾을 수 없도록 차단한다.
  - 이미 수락된 견적은 `이미 수락된 견적입니다.`로 거부한다.
  - `RESPONDED` 상태가 아닌 견적은 `업체 응답이 도착한 견적만 수락할 수 있습니다.`로 거부한다.
  - 기존 placeholder reservation을 재사용해 같은 quoteResponse로 reservation이 중복 생성되지 않게 한다.
- `confirmReservation()`:
  - 현재 vendor가 대상 reservation vendor가 아니면 `예약을 찾을 수 없습니다.`로 차단한다.
  - quote request가 `ACCEPTED`가 아니면 `사용자가 수락한 견적만 확정할 수 있습니다.`로 거부한다.
  - 이미 확정된 예약은 `이미 최종 확정된 예약입니다.`로 거부한다.
  - `PENDING | CHANGED` 외 상태는 `최종 확정할 수 있는 예약 상태가 아닙니다.`로 거부한다.

Notification backend 계약:

- 추가 파일: `types/notification.ts`, `app/actions/notification.ts`
- `NotificationDTO` 필드:
  - `id`
  - `type`
  - `title`
  - `message`
  - `linkHref`
  - `isRead`
  - `createdAt`
  - `readAt`
  - `metadata`
- action 목록:
  - `getNotifications()` → 로그인 사용자 본인 알림 최신 50개 반환.
  - `getUnreadNotificationCount()` → 로그인 사용자 본인의 unread count 반환.
  - `markNotificationAsRead(notificationId)` → 본인 알림만 읽음 처리. 다른 사용자 알림은 `알림을 찾을 수 없습니다.`로 차단.
  - `markAllNotificationsAsRead()` → 본인 unread 알림만 일괄 읽음 처리하고 `{ updatedCount }` 반환.
- UI handoff:
  - 알림센터 UI는 이번 작업에서 만들지 않았다.
  - Claude/UI는 `linkHref`로 이동 링크를 연결하고, `isRead`/`readAt` 기준으로 읽음 상태를 표시하면 된다.
  - 알림 count badge는 `getUnreadNotificationCount()`만 호출하면 된다.

ActivityLog / workflow event 상태:

- `QuoteRequest` 생성, `QuoteResponse` 제출, `QuoteResponse` 수락, `Reservation(CONFIRMED)` 전환 시 기존 `createWorkflowActivity()` 호출을 유지한다.
- `createWorkflowNotification()`과 `createWorkflowActivity()`는 핵심 DB 변경과 같은 Prisma transaction 안에서 호출된다.
- 이번 smoke에서 workflow notification/activity 생성 수를 다시 검증했다.

Smoke test 보강:

- `scripts/verify-quote-flow.ts` 추가 검증:
  - 빈 `selectedModuleIds` 거부.
  - 존재하지 않는 vendor/module 거부.
  - plan owner가 아닌 user의 create/read/accept 차단 조건.
  - eventType과 맞지 않는 module category 거부.
  - 일반 사용자의 quote response 제출 거부.
  - 대상 vendor가 아닌 vendor의 quote response 제출 거부.
  - `totalPrice` 0/음수 거부.
  - 같은 vendor의 중복 response 거부.
  - 같은 quoteResponse 중복 accept 거부.
  - accept 후 `Reservation(PENDING)`은 하나만 유지.
  - confirm 후 `Reservation(CONFIRMED)`이 pending count에 포함되지 않음.
  - workflow notification/activity 생성 확인.
- `scripts/launch-readiness-smoke.ts` 추가 검증:
  - Notification table read/write.
  - 다른 사용자의 알림 read update가 적용되지 않는 owner scope.
  - `markAll`에 해당하는 owner-scoped bulk read 조건.
  - ActivityLog write/delete.

실행 방법:

- `npm run db:seed`
- `npx tsx scripts/verify-quote-flow.ts`
- `npx tsx scripts/launch-readiness-smoke.ts`

검증 결과:

- `npx prisma generate`: 통과.
- `npm run db:seed`: 통과. `users=6`, `eventPlans=2`, `reservations=4`, `vendorServiceModules=16`, `quoteRequests=5`, `quoteResponses=3`.
- `npx tsx scripts/verify-quote-flow.ts`: 통과. sandbox 내부 IPC `EPERM` 때문에 sandbox 밖 재실행으로 확인.
- `npx tsx scripts/launch-readiness-smoke.ts`: 통과. sandbox 내부 IPC `EPERM` 때문에 sandbox 밖 재실행으로 확인.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, `Database schema is up to date!`.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: empty migration.

Claude/UI 담당자 handoff:

- Chrome MCP 전체 QA는 아직 남아 있다.
- BUG-04: Step 3 모듈 미선택 시 서버 error `최소 1개 이상의 서비스를 선택해 주세요.`를 인라인 validation UI로 표시한다.
- BUG-05: 업체 요청 카드에서 “견적 제안 작성” CTA를 더 명확히 노출한다.
- BUG-07: Next Image `sizes` prop 경고를 제거한다.
- 알림 UI를 붙일 때는 `NotificationDTO`와 notification actions만 사용하고 schema를 임의 확장하지 않는다.
- Codex가 더 건드리지 말아야 할 UI 영역: `components/`, `hooks/`, global CSS/Tailwind visual polish, 알림센터 UI, vendor line item editor UX.

## 22. 2026-05-28 Backend Final Audit / PR Readiness

이번 감사는 main merge 전 backend contract freeze를 목적으로 수행했다. 새 UI/UX 작업은 하지 않았고 `components/`, `hooks/`, `app/globals.css`, `tailwind.config.ts`, `docs/Claude_STATUS.md`는 수정하지 않았다. README는 repo root에 없어 충돌 내용이 없었다.

현재 백엔드 완료 상태:

- 표준 플로우는 `QuoteRequest(PENDING)` → `QuoteResponse` → `QuoteRequest(ACCEPTED)` → `Reservation(PENDING)` → 업체 `Reservation(CONFIRMED)`이다.
- 견적 수락은 일반 사용자 action이고, 예약 최종 확정은 업체 action이다.
- QuoteRequest 생성, 업체 응답, 견적 수락, 업체 최종 확정은 notification/activity log를 같은 Prisma transaction 안에서 기록한다.
- DB guard는 active `QuoteRequest(planId, vendorId)` partial unique index, `QuoteResponse(requestId, vendorId)` unique index, `Reservation.quoteRequestId`, `Reservation.quoteResponseId` unique relation으로 구성된다.

Action contract 목록:

- `createQuoteRequest(input)` → `ActionResult<QuoteRequestDTO>`
  - GENERAL만 가능.
  - plan owner, approved active vendor, vendor eventType, active selected module, module category eventType, active duplicate request를 검증한다.
- `getQuotesByPlan(planId)` / `getQuoteRequestsByPlan(planId)` → `ActionResult<QuoteRequestWithResponsesDTO[]>`
  - GENERAL plan owner만 가능.
  - vendor, plan summary, selected module detail, reservation, responses를 ISO date DTO로 반환한다.
- `getQuoteRequestsForVendor()` → `ActionResult<QuoteRequestForVendorDTO[]>`
  - VENDOR만 가능.
  - 로그인 vendor에게 온 요청만 반환한다.
- `submitQuoteResponse(input)` → `ActionResult<QuoteResponseDTO>`
  - VENDOR만 가능.
  - target vendor, request `PENDING`, duplicate response, `totalPrice > 0`, base/total mismatch를 검증한다.
- `acceptQuoteResponse(input)` → `ActionResult<AcceptQuoteResult>`
  - GENERAL plan owner만 가능.
  - request `RESPONDED`만 수락 가능하며 기존 placeholder reservation을 재사용한다.
- `confirmReservation(reservationId)` → `ActionResult<ReservationDTO>`
  - VENDOR reservation owner만 가능.
  - quote request가 있으면 `ACCEPTED`인 경우만 `CONFIRMED`로 전이한다.
- Notification actions:
  - `getNotifications()` → 본인 알림 최신 50개.
  - `getUnreadNotificationCount()` → 본인 unread count.
  - `markNotificationAsRead(notificationId)` → 본인 알림만 읽음 처리.
  - `markAllNotificationsAsRead()` → 본인 unread 알림만 일괄 읽음 처리.

권한/중복/상태 matrix:

| Action | Planner | Vendor | Ownership Check | Duplicate Guard | Status Guard |
| --- | --- | --- | --- | --- | --- |
| `createQuoteRequest` | 가능 | 불가 | plan owner | active `planId+vendorId` | WEDDING/FUNERAL, vendor eventType, module category |
| `getQuotesByPlan` | 가능 | 불가 | plan owner | N/A | N/A |
| `getQuoteRequestsForVendor` | 불가 | 가능 | current vendor | N/A | N/A |
| `submitQuoteResponse` | 불가 | 가능 | target vendor | one response per request/vendor | `PENDING` only |
| `acceptQuoteResponse` | 가능 | 불가 | plan owner | one accepted request via transaction guard | `RESPONDED` only |
| `confirmReservation` | 불가 | 가능 | reservation vendor | already confirmed guard | quote `ACCEPTED`, reservation `PENDING/CHANGED` |
| `getNotifications` | 가능 | 가능 | own notification | N/A | N/A |
| `markNotificationAsRead` | 가능 | 가능 | own notification | idempotent if already read | N/A |
| `markAllNotificationsAsRead` | 가능 | 가능 | own notifications | N/A | unread only |

상태 전이 matrix:

| Domain | From | To | Actor | Guard |
| --- | --- | --- | --- | --- |
| QuoteRequest | `PENDING` | `RESPONDED` | Vendor | target vendor, no existing response |
| QuoteRequest | `RESPONDED` | `ACCEPTED` | Planner | plan owner, transaction `updateMany(status=RESPONDED)` |
| QuoteRequest | `PENDING/RESPONDED` | `CANCELED` | Planner/Vendor legacy cancel | actor owns plan or vendor request |
| Reservation | `PENDING` | `CONFIRMED` | Vendor | reservation vendor, quote accepted if linked |
| Reservation | `CHANGED` | `CONFIRMED` | Vendor | reservation vendor |
| Reservation | `PENDING/CONFIRMED/CHANGED` | `CANCELED` | Planner/Vendor | actor owns reservation side |
| Reservation | `CONFIRMED` | `COMPLETED` | Vendor API legacy route | confirmed reservation only |

Legacy route audit:

- `app/api/vendor/reservations/[reservationId]/route.ts`는 현재 vendor workspace에서 사용 중이다. 같은 `QuoteResponse`를 새로 중복 생성하지 않고 기존 응답을 update할 수 있는 호환 경로다.
- 표준 `submitQuoteResponse()`는 first-submission contract로 duplicate response를 거부한다.
- 두 경로는 모두 target vendor, positive amount, request status, `QuoteResponse(requestId, vendorId)` DB unique guard를 사용한다.
- `app/vendors/actions.ts`와 `app/api/reservations/route.ts`는 legacy vendor-service 기반 quote request fallback이다. `selectedModules`에 `VendorService` id 또는 service module key가 저장될 수 있어 표준 `VendorServiceModule` detail mapping과 완전히 동일하지 않다.
- 이번 PR에서는 정상 동작 중인 legacy UI를 깨지 않기 위해 대규모 통합은 하지 않았다. main merge 후에는 legacy request 생성 경로를 표준 `createQuoteRequest()`로 수렴시키는 별도 작업이 필요하다.

Notification backend contract:

- DTO 필드: `id`, `type`, `title`, `message`, `linkHref`, `isRead`, `createdAt`, `readAt`, `metadata`.
- Date는 ISO string으로 직렬화된다.
- 다른 사용자의 notification은 조회/읽음 처리할 수 없다.
- smoke에서 본인 알림 읽음 처리 후 unread count가 감소하고, cross-user read attempt가 0건인 것을 검증한다.
- Claude/UI는 알림센터 UI를 만들 때 schema를 확장하지 말고 위 action/DTO만 사용한다.

Smoke test 실행 방법:

- `npm run db:seed`
- `npx tsx scripts/verify-quote-flow.ts`
- `npx tsx scripts/launch-readiness-smoke.ts`
- 반복 안정성 확인은 위 smoke 두 개를 연속 2회 실행한다.

반복 실행 안정성:

- `scripts/verify-quote-flow.ts`는 독립 smoke plan slug에 timestamp를 사용하고 finally cleanup으로 생성 plan/request/response/reservation/notification/activity를 제거한다.
- `scripts/launch-readiness-smoke.ts`는 생성 notification/activity id만 cleanup한다.
- 반복 실행에서 active QuoteRequest unique, duplicate QuoteResponse, notification read state가 다음 실행을 오염시키지 않아야 한다.

Migration status:

- Prisma schema 변경은 이번 final audit에서 추가하지 않았다.
- 현재 필요한 migration은 `20260527000000_prevent_duplicate_quote_response`, `20260528002000_workflow_notifications_and_sla`, `20260528003000_prevent_duplicate_active_quote_request`까지 포함된다.
- merge 전 기준은 `npx prisma migrate status`가 up to date이고 `migrate diff`가 empty migration이어야 한다.
- 가능하면 clean temp DB에서 `prisma migrate deploy`와 `npm run db:seed`를 함께 확인한다.

Claude가 건드릴 영역:

- BUG-04/BUG-05/BUG-07은 2026-05-28 Codex 최소 UI blocker fix에서 코드 반영 완료. Claude는 브라우저 QA 후 문구/간격 polish가 필요할 때만 최소 수정한다.
- Notification UI 연결: unread badge, list, mark read, mark all read.

Claude가 건드리면 안 되는 영역:

- `prisma/schema.prisma`, `prisma/migrations`, `app/actions`, `app/api`, `lib/state-machine.ts`, `lib/workflow-events.ts`는 backend contract freeze 영역이다.
- 상태 용어는 `견적 요청`, `업체 응답 대기`, `견적 수락`, `업체 최종 확정 대기`, `예약 확정 완료`를 유지한다.

남은 Chrome MCP QA 항목:

- planner → vendor → planner → vendor confirm 전체 클릭 플로우.
- `/plans` CTA와 `step` query 새로고침 fallback 재확인.
- `CONFIRMED` reservation이 Step 4 pending 섹션에 남지 않는지 재확인.
- notification UI가 붙은 뒤 unread count/read 처리 QA.

main merge 전 backend checklist:

- `git status` clean.
- `npm run db:seed` 통과.
- `npx tsx scripts/verify-quote-flow.ts` 2회 연속 통과.
- `npx tsx scripts/launch-readiness-smoke.ts` 2회 연속 통과.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
- `npx prisma migrate status` up to date.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` empty migration.
- git push는 사용자가 명시적으로 요청하기 전까지 하지 않는다.

## 23. Codex minimal UI blocker fix - 2026-05-28

목적:

- 백엔드 contract freeze 이후 남아 있던 launch blocker성 UX 경고만 최소 수정했다.
- 서버 action, Prisma schema, migration, notification contract는 변경하지 않았다.

수정 내용:

- BUG-04: `ModularQuoteBuilder`에서 모듈/베이스 패키지 미선택 시 인라인 안내를 노출하고, selection guard를 추가했다.
  - 문구: `견적 요청을 보내려면 최소 1개 이상의 서비스를 선택해 주세요.`
  - desktop summary, module grid 상단, mobile bottom bar/bottom sheet에서 동일한 조건으로 표시된다.
- BUG-05: vendor dashboard의 새 견적 요청 카드에 `견적 제안 작성` CTA를 추가했다.
  - CTA 클릭 시 해당 요청을 proposal form 대상으로 선택하고 `견적 제안` 패널로 이동한다.
  - 요청 상세 확인용 기존 카드 선택 동작은 유지했다.
- BUG-07: `next/image` `fill` 로고 사용부에 `sizes`를 명시했다.
  - 대상: landing/nav/account/planner/auth layout logo image.

검증 결과:

- `npx tsc --noEmit`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- Chrome MCP QA: 이번 작업에서는 수행하지 않음. 실제 브라우저에서 Step 3 empty selection, vendor inbox CTA, Image warning 재확인이 필요하다.

Claude/UI handoff:

- notification center UI는 아직 남아 있다.
- BUG-04/05/07은 기능 기준으로 반영됐으나, Claude가 실제 화면에서 문구/간격을 QA하고 필요 시 컴포넌트 내부에서만 polish한다.
- backend freeze 영역(`app/actions`, `app/api`, `prisma`, `lib/workflow-events.ts`, `lib/state-machine.ts`)은 계속 수정하지 않는다.

## 24. Codex backend QA follow-up - 2026-05-28

범위:

- Chrome MCP 최종 QA에서 남은 backend/data contract 이슈 BUG-F01, BUG-F02 backend contract, BUG-F03 backend contract를 처리했다.
- UI 컴포넌트와 hook은 수정하지 않았다.
- Prisma schema/migration은 변경하지 않았다.

BUG-F01 Server Action 503 조사 결과:

- 확인 파일: `lib/prisma.ts`, `lib/errors.ts`, `prisma/seed.ts`, `app/actions/quote.ts`, `app/actions/reservation.ts`, `app/actions/plan.ts`, `app/planner/wedding/page.tsx`, `app/planner/funeral/page.tsx`, `app/vendor/dashboard/page.tsx`, smoke scripts.
- PrismaClient는 `lib/prisma.ts`에서 dev hot reload singleton으로 이미 관리되고 있었다.
- 프로젝트는 Prisma 7 driver adapter `@prisma/adapter-better-sqlite3`와 SQLite를 사용한다.
- QA의 간헐적 503은 확정 원인으로 단정하지 않는다. 가능한 원인은 개발 환경 SQLite 파일 잠금, Server Action 이후 `router.refresh`/RSC page read가 겹치는 상황, SQLite connection busy timeout 부족이다.
- 긴 transaction 안에 notification/activity log 기록이 포함되어 있지만 현재 smoke와 browser QA에서 핵심 flow 정합성은 통과했다. 이번 작업에서는 transaction boundary를 크게 바꾸지 않았다.

BUG-F01 완화책:

- `lib/prisma.ts`의 `PrismaBetterSqlite3` adapter에 `timeout: 10000`을 명시했다.
- `prisma/seed.ts`에서 `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 10000`을 적용한다.
- planner wedding/funeral page와 vendor dashboard의 RSC read bootstrap을 `withPrismaRetry()`로 감싸 transient SQLite busy error를 최대 3회 짧게 재시도한다.
- `lib/errors.ts`에 `isDatabaseBusyError()`를 추가하고 `getActionError()`가 SQLite busy/locked/busy executing query를 사용자용 메시지로 변환하게 했다.
- vendor reservation API route도 DB busy error를 `{ error: "요청이 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요." }` 형태로 반환한다.
- `scripts/server-action-read-concurrency-smoke.ts`를 추가해 4개 Prisma client, 24개 병렬 read batch로 planner page read와 vendor dashboard contract read를 반복 검증한다.

BUG-F01 남은 한계:

- local SQLite의 파일 잠금 특성은 완전히 제거할 수 없다. Production DB가 SQLite가 아니라면 이 현상은 다르게 검증해야 한다.
- WAL은 seed 실행 후 DB 파일에 적용된다. seed를 거치지 않은 새 SQLite 파일은 별도 DB init 확인이 필요하다.
- Chrome MCP에서는 `/planner/wedding?planId=...&step=3`에서 Step 3 submit 직후 Network 503 재발 여부를 다시 확인해야 한다.

Vendor pending confirmation server contract:

- 새 contract helper: `buildVendorDashboardReservationContract(reservations)` in `lib/vendor-dashboard-contract.ts`.
- DTO: `VendorDashboardReservationDTO`, `VendorDashboardReservationContractDTO`, `VendorDashboardReservationCountsDTO` in `types/reservation.ts`.
- `pendingConfirmations`: `Reservation.status === "PENDING"`이고 `quoteRequestStatus === "ACCEPTED"`인 항목이다. 업체가 “예약 최종 확정”해야 하는 대상이다.
- `confirmedReservations`: `Reservation.status === "CONFIRMED"` 또는 `"COMPLETED"`인 항목이다.
- `quoteResponsesWaitingForUserAcceptance`: 업체가 견적 응답을 보냈고 아직 사용자가 수락하지 않은 PENDING reservation이다.
- `newQuoteRequests`: 아직 업체 응답이 없는 PENDING reservation이다.
- count fields: `newRequestsCount`, `pendingConfirmationsCount`, `confirmedReservationsCount`, `respondedQuotesCount`.
- `app/vendor/dashboard/page.tsx`는 기존 `reservations` prop을 유지하면서 서버에서 contract를 먼저 계산한다. Claude는 새 섹션을 만들 때 `pendingConfirmations`와 `counts.pendingConfirmationsCount`를 기준으로 렌더링하면 된다.
- 권한 조건은 vendor dashboard page의 `vendorId = session.user.id` 필터를 유지하므로 venue/catering 간 pending confirmation이 섞이지 않는다.

Request memo / response message contract:

- planner request memo field: `QuoteRequestData.requestMemo` alias. 기존 `requirements`도 유지한다.
- vendor response message field: `QuoteResponseData.responseMessage` alias. 기존 `note`도 유지한다.
- `SubmitQuoteResponsePayload.responseMessage`를 optional alias로 추가했다. 서버는 `responseMessage ?? note`를 `QuoteResponse.note`에 저장한다.
- vendor dashboard reservation DTO는 `requestMemo`와 `responseMessage`를 분리해서 제공한다.
- Claude UI handoff: 업체 응답 textarea의 `value` 초기값은 빈 문자열이어야 한다.
- Claude UI handoff: planner request memo는 textarea value에 넣지 말고 placeholder나 별도 요청 메모 영역에 표시한다.
- Claude UI handoff: 업체 응답 textarea 저장값은 `responseMessage` 또는 legacy `note`를 사용한다.

Smoke test 업데이트:

- `scripts/verify-quote-flow.ts`가 vendor dashboard contract를 검증한다.
- accept 전: `newQuoteRequests` 및 `quoteResponsesWaitingForUserAcceptance` 분류 검증.
- accept 후: `pendingConfirmationsCount` 증가 검증.
- confirm 후: `pendingConfirmations`에서 제거되고 `confirmedReservations`로 이동하는지 검증.
- request memo와 response message가 각각 `requestMemo`, `responseMessage`에 분리되어 내려오는지 검증.
- `scripts/server-action-read-concurrency-smoke.ts`가 concurrent read smoke를 담당한다.

이번 작업 검증 결과:

- `npx prisma generate`: 통과
- `npm run db:seed`: 통과
- `npx tsx scripts/verify-quote-flow.ts`: 통과
- `npx tsx scripts/launch-readiness-smoke.ts`: 통과
- `npx tsx scripts/server-action-read-concurrency-smoke.ts`: 통과
- `npx tsc --noEmit`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- `npx prisma migrate status`: 통과, database schema up to date
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: 통과, empty migration

Chrome MCP 재확인 방법:

- planner로 `/planner/wedding?planId=...&step=3` 진입 후 견적 요청 submit을 2~3회 새 플랜 기준으로 반복한다.
- Network에서 Server Action POST가 503 없이 ActionResult error/success로 끝나는지 확인한다.
- vendor dashboard에서 사용자가 수락한 PENDING reservation이 `pendingConfirmations` 기반 UI에 별도 표시되는지 확인한다.
- 업체 응답 textarea가 planner request memo로 prefill되지 않는지 확인한다.

## 25. Codex spot QA follow-up fix - 2026-05-28

범위:

- Chrome MCP spot QA에서 명확히 확인된 F02/F03을 최소 UI 수정으로 처리했다.
- F01은 재현성 낮은 간헐 503이므로 기존 backend 완화 위에 submit 중복 실행 guard와 문서화만 추가했다.
- Server Action/Prisma schema/DTO contract는 깨지지 않았다.

BUG-F03 response textarea 초기값 수정:

- `components/features/planning/vendor-workspace.tsx`에서 vendor response form state와 planner request memo 표시를 분리했다.
- 신규 응답 작성 시 `proposalForm.notes`는 빈 문자열로 시작한다.
- 기존 `QuoteResponse`가 있는 경우에만 `responseMessage`를 textarea value로 사용한다.
- `requestMemo`는 “사용자 요청사항” 박스 또는 요청 상세 영역에만 표시한다.
- 요청 드롭다운 또는 요청 카드 변경 시 textarea는 `getResponseMessage(reservation)` 기준으로 reset된다.
- `reservation.notes`는 더 이상 신규 업체 응답 textarea 초기값으로 쓰지 않는다.

BUG-F02 pending confirmation UI 수정:

- `app/vendor/dashboard/page.tsx`가 서버에서 계산한 `reservationContract.pendingConfirmations`를 `VendorWorkspace`에 전달한다.
- vendor dashboard 상단에 `예약 최종 확정 필요` 섹션을 추가했다.
- 이 섹션은 `Reservation.status === PENDING`이고 `quoteRequestStatus === ACCEPTED`인 항목만 표시한다.
- 각 카드에는 행사명, 서비스명, 날짜, 장소, 인원, 금액, 확정 요청 기한, 사용자 요청사항, `예약 최종 확정` 버튼을 표시한다.
- 버튼은 기존 `confirmReservation()` Server Action을 그대로 사용하고 성공 후 `router.refresh()`를 실행한다.
- 기존 banner 클릭은 숨겨진 proposals 탭으로 보내지 않고 상단 pending confirmation 섹션으로 scroll한다.
- `진행 중 제안` 목록은 사용자가 아직 수락하지 않은 PENDING quote response만 보여준다. 수락된 PENDING reservation은 pending confirmation 섹션에만 표시된다.
- `확정 예약` 탭은 기존대로 `CONFIRMED`/`COMPLETED`만 표시한다.

BUG-F01 503 추가 완화:

- 기존 완화: SQLite adapter timeout 10초, seed WAL/busy_timeout, `withPrismaRetry()` read bootstrap, DB busy error mapping.
- 추가 완화: Step 3/4 quote request submit, legacy checklist submit, quote accept handler에 `quoteActionLockedRef` 재진입 guard를 추가했다.
- 현재 직접 smoke에서는 503을 재현하지 못했다. 과거 Chrome Network 로그에 503 흔적이 있으므로 local SQLite dev 환경에서는 계속 monitoring이 필요하다.
- `scripts/server-action-read-concurrency-smoke.ts`는 planner Step 3 page read bootstrap과 vendor dashboard contract read를 병렬 시뮬레이션한다.

브라우저 재확인 항목:

- vendor 응답 textarea: 신규 응답 작성 시 빈 값인지 확인한다.
- vendor 응답 textarea: planner request memo가 “사용자 요청사항” 영역에만 표시되는지 확인한다.
- vendor 응답 textarea: 요청 드롭다운 변경 시 이전 요청 메모/응답이 잘못 남지 않는지 확인한다.
- pending confirmation: `catering@yeon.local` 또는 실제 수락 대상 업체로 로그인했을 때 `예약 최종 확정 필요` 섹션이 상단에 바로 보이는지 확인한다.
- pending confirmation: 버튼 클릭 후 `CONFIRMED`로 전환되고 pending 섹션에서 제거되는지 확인한다.
- 권한: venue/catering 계정 간 서로의 pending confirmation이 보이지 않는지 확인한다.
- 503: `/planner/wedding?planId=...&step=3`에서 로드/새로고침/견적 요청 제출을 여러 번 반복하고 Network POST 503 재발 여부를 확인한다.

검증 결과:

- final verification에서 `npx prisma generate`, `npm run db:seed`, 3개 smoke, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx prisma migrate status`를 다시 실행한다.

## 26. Codex backend final hardening - 2026-05-28

범위:

- main merge 전 backend action/API route 계약을 최종 감사했다.
- 프론트 UI polish, layout 변경, hook 대개편, README 수정, `docs/Claude_STATUS.md` 수정은 하지 않았다.
- Prisma schema/migration은 변경하지 않았다.

이번에 처리한 backend risk:

- `app/vendor/actions.ts` legacy vendor action이 `reservation.notes`/planner request memo를 `QuoteResponse.note`처럼 저장할 수 있는 경로를 제거했다.
  - legacy action은 별도 vendor response message 입력값이 없으므로 새 `QuoteResponse.note`는 `null`로 생성한다.
  - 기존 `QuoteResponse`를 update할 때는 note를 건드리지 않아 이미 저장된 실제 업체 응답 메시지를 보존한다.
- `app/vendors/actions.ts` legacy FormData quote request fallback에서 계산된 예상 금액이 0 이하이면 서버에서 거부한다.
- `app/vendors/actions.ts` legacy fallback의 unknown DB error도 `{ error: ... }` 형태로 반환하게 정리했다.
- `app/api/reservations/route.ts` legacy request 생성 route에서 `serviceId`가 전달된 경우 같은 vendor, 같은 event type, 같은 service module에 속한 active service인지 검증한다.
- `app/api/reservations/route.ts`, `app/api/reservations/[reservationId]/route.ts`, `app/api/vendor/reservations/[reservationId]/route.ts`에 route-level SQLite busy/SyntaxError guard를 추가했다.

최종 backend contract 요약:

- QuoteRequest:
  - 표준 경로: `app/actions/quote.ts createQuoteRequest`.
  - GENERAL plan owner만 가능하며, approved active vendor, event type, selected module, active duplicate request를 검증한다.
  - legacy 경로(`app/vendors/actions.ts`, `app/api/reservations/route.ts`)는 유지하되 active duplicate, vendor ownership, event type, selected service, positive amount guard를 맞췄다.
- QuoteResponse:
  - 표준 경로: `submitQuoteResponse`.
  - VENDOR target vendor만 가능하며, request `PENDING`, total/base mismatch, duplicate response를 차단한다.
  - legacy vendor API route는 현재 vendor workspace에서 사용 중이며, 기존 response update 호환을 유지한다.
- Accept:
  - `acceptQuoteResponse`는 GENERAL plan owner만 가능하고 request `RESPONDED` 상태에서만 `ACCEPTED`로 전이한다.
  - transaction `updateMany(status=RESPONDED)` guard와 DB unique relation으로 중복 accept/reservation 생성을 막는다.
- Reservation Confirm:
  - `confirmReservation`은 VENDOR reservation owner만 가능하다.
  - linked quoteRequest가 있으면 `ACCEPTED` 상태만 확정 가능하다.
  - `CONFIRMED` 후 `vendorConfirmationDueAt`은 null로 제거되고 pending confirmation contract에서 제외된다.
- Vendor Dashboard:
  - `buildVendorDashboardReservationContract()`가 `newQuoteRequests`, `quoteResponsesWaitingForUserAcceptance`, `pendingConfirmations`, `confirmedReservations`, count fields를 제공한다.
  - vendor dashboard page는 `vendorId = session.user.id`로 조회하므로 venue/catering 간 pending confirmation이 섞이지 않는다.
- Notification:
  - action: `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`.
  - DTO: `id`, `type`, `title`, `message`, `linkHref`, `isRead`, `createdAt`, `readAt`, `metadata`.
  - 본인 알림만 조회/읽음 처리 가능하다.

권한/중복/상태 matrix 최신 기준:

| Action | Planner | Vendor | Ownership Check | Duplicate Guard | Status Guard |
| --- | --- | --- | --- | --- | --- |
| `createQuoteRequest` | 가능 | 불가 | plan owner | active `planId+vendorId` | eventType/vendor/module |
| `submitQuoteResponse` | 불가 | 가능 | target vendor | one response per request/vendor | request `PENDING` |
| `acceptQuoteResponse` | 가능 | 불가 | plan owner | one accepted request + one reservation | request `RESPONDED` |
| `confirmReservation` | 불가 | 가능 | reservation vendor | already confirmed guard | quote `ACCEPTED`, reservation `PENDING/CHANGED` |
| `getNotifications` | 가능 | 가능 | own notification | N/A | N/A |
| `markNotificationAsRead` | 가능 | 가능 | own notification | idempotent if already read | own notification only |

Notification / ActivityLog consistency:

- QuoteRequest 생성, QuoteResponse 제출, QuoteResponse 수락, Reservation 최종 확정은 notification/activity log를 핵심 DB 변경과 같은 Prisma transaction 안에서 기록한다.
- smoke에서 notification table write/read scope, unread count 감소, ActivityLog write/delete, workflow notification/activity 생성 수를 검증한다.
- notification UI는 아직 없다. Claude는 위 action/DTO를 그대로 연결하고 schema를 임의 확장하지 않는다.

SQLite / Prisma 안정성:

- `lib/prisma.ts`는 dev hot reload singleton + `PrismaBetterSqlite3 timeout=10000`을 사용한다.
- seed는 WAL 및 `busy_timeout=10000`을 적용한다.
- read-heavy RSC bootstrap은 `withPrismaRetry()`로 transient busy를 완화한다.
- write action에는 무리한 retry를 넣지 않았다. 중복 생성 위험은 DB unique guard와 transaction status guard로 처리한다.
- `.gitignore`는 `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, `generated/`를 제외한다.

Legacy route risk:

- `app/api/vendor/reservations/[reservationId]/route.ts`는 vendor workspace에서 계속 사용 중인 호환 API다. 표준 `submitQuoteResponse()`처럼 duplicate를 무조건 거부하지 않고 기존 response update를 허용한다.
- `app/vendors/actions.ts`와 `app/api/reservations/route.ts`는 legacy `VendorService` 기반 fallback이라 `selectedModules`에 `VendorServiceModule` id가 아닌 `VendorService` id 또는 module key가 들어갈 수 있다.
- 이번 작업에서는 정상 동작 중인 fallback을 삭제하지 않았다. main merge 후 별도 작업에서 legacy quote request 생성 경로를 표준 `createQuoteRequest()` 계약으로 완전히 수렴시키는 것이 안전하다.

Smoke / verification 반복 결과:

- `npx prisma generate`: 통과.
- `npm run db:seed`: 통과.
- `npx tsx scripts/verify-quote-flow.ts`: 2회 연속 통과.
- `npx tsx scripts/launch-readiness-smoke.ts`: 2회 연속 통과.
- `npx tsx scripts/server-action-read-concurrency-smoke.ts`: 2회 연속 통과.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, database schema up to date.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`: 통과, empty migration.

Chrome MCP에서 다시 확인할 항목:

- Step 3 견적 요청 submit/새로고침 반복 시 Network POST 503 재발 여부.
- vendor dashboard pending confirmation 섹션에서 확정 후 pending 섹션 제거 여부.
- 업체 응답 textarea가 신규 응답에서 빈 값인지, planner request memo가 별도 요청사항 영역에만 보이는지.
- legacy vendors detail modal fallback을 사용하는 경우에도 0원 이하/잘못된 serviceId 요청이 서버에서 거부되는지.

Claude 이후 UI 작업:

- vendor pending section polish 및 toast/success feedback.
- response textarea 브라우저 재확인.
- notification UI 연결.
- image sizes warning 정리.
- 장례 플로우 문구/톤 최종 QA.

main merge 전 backend checklist:

- `git status` clean.
- 위 verification 루틴 재실행.
- Chrome MCP final QA PASS 확인.
- `.env`, DB sidecar, `.next`, `generated`, `tsconfig.tsbuildinfo` 등 산출물이 커밋되지 않았는지 확인.
- push는 사용자가 명시적으로 요청하기 전까지 하지 않는다.

## 27. Domain data integrity fix - 2026-05-29

범위:

- QA에서 확인된 Funeral Step 3의 Wedding 모듈 노출 문제를 backend/domain mapping 기준으로 수정했다.
- 디자인 polish, layout redesign, `docs/Claude_STATUS.md`, README 수정은 하지 않았다.
- UI 변경은 Step 3 모듈 조회에 `eventType`을 넘기는 최소 연결부만 포함한다.

해결한 도메인 문제:

- BUG-D01: Funeral Step 3에서 `본식 스냅`, `드레스`, `웨딩 영상`, `앨범 제작`, `야외 촬영`, `브라이덜` 계열 모듈이 노출되지 않도록 `VendorServiceModule` category와 `eventType` 필터를 공유 helper로 고정했다.
- BUG-D02: `catering@yeon.local` seed 계정의 역할을 `오르세 플로럴` Wedding floral vendor로 정리하고 catering/meal/funeral service mapping을 제거했다.
- BUG-D02: `memorial@yeon.local` seed 계정을 `한결 의전` Funeral vendor로 정리하고 funeral hall, meal, obituary, wreath, transport 모듈을 연결했다.
- BUG-D03: QuoteResponse/Reservation 조회 시 plan event type과 맞지 않는 selected module detail은 DTO에 포함되지 않도록 방어했다.

Wedding/Funeral filtering 기준:

- 표준 helper: `vendorServiceModuleCategoryMatchesEventType(eventType, category)` in `lib/step3.shared.ts`.
- Wedding 허용 category: `VENUE`, `PHOTO`, `DRESS`, `MAKEUP`, `DECORATION`, `CATERING`, `INVITATION`, `CEREMONY`.
- Funeral 허용 category: `FUNERAL_HALL`, `WREATH`, `TRANSPORT`, `CEREMONY`, `MEAL`, `OBITUARY`.
- `CEREMONY`는 schema상 공통 category이므로 seed/label에서 event-specific 문구를 섞지 않는 방식으로 관리한다.
- `getVendorServiceModules(vendorId, eventType)`는 vendor가 해당 event type을 지원하지 않으면 빈 배열을 반환한다.
- planner wedding/funeral page의 initial vendor services include는 각각 `eventType: "WEDDING"` / `eventType: "FUNERAL"`로 제한한다.
- `createQuoteRequest()`와 `submitQuoteResponse()`는 plan event type과 맞지 않는 module/category 조합을 서버에서 거부한다.

Seed data 정리:

- `venue@yeon.local`: Wedding venue 중심 vendor로 유지.
- `catering@yeon.local`: `오르세 플로럴`, Wedding floral/decoration vendor로 정리. Catering/meal/funeral module을 담당하지 않는다.
- `memorial@yeon.local`: `한결 의전`, Funeral vendor로 정리. Funeral hall, meal, obituary, wreath, transport 모듈을 담당한다.
- 제거/대체한 혼합 seed:
  - `테이블앤코 케이터링`의 Wedding catering + Funeral meal 혼합 mapping 제거.
  - `블루필름 스튜디오`의 Wedding photo/video/album/outdoor modules가 Funeral account처럼 보이던 seed 제거.
  - Wedding accepted reservation은 `오르세 플로럴 웨딩 장식`/`DECORATION`으로 대체.
  - Funeral quote/response/reservation은 `한결 의전` 모듈로 대체.
- `npm run db:seed` 현재 결과: `vendorServiceModules=15`, `quoteRequests=4`, `quoteResponses=2`, `reservations=3`.

새 smoke test 검증 항목:

- `funeral_modules_are_event_specific`: Funeral vendor modules는 Funeral category만 가진다.
- `wedding_modules_are_event_specific`: Wedding vendor modules는 Wedding category만 가진다.
- `florist_vendor_not_catering_or_meal`: `오르세 플로럴`은 `CATERING`/`MEAL` module이나 catering/funeral service를 갖지 않는다.
- `funeral_reservations_have_no_wedding_labels`: Funeral reservation/quote payload에 Wedding 금지 키워드가 섞이지 않는다.
- 기존 `module_event_type_mismatch_rejected`: Funeral-only module을 Wedding plan으로 요청하면 서버 validation이 거부한다.

Claude UI handoff:

- Step 3 UI는 backend에서 내려오는 event-specific vendor/module contract를 그대로 사용한다.
- Wedding 화면에서 funeral-only labels(`장례`, `조문`, `문상`, `빈소`, `운구`, `화환`, `영정`, `수의`, `유골`)가 보이면 회귀다.
- Funeral 화면에서 wedding-only labels(`드레스`, `웨딩 영상`, `본식 스냅`, `앨범 제작`, `야외 촬영`, `브라이덜`)가 보이면 회귀다.
- 업체 표시에서 `오르세 플로럴`은 Wedding floral/decoration vendor로 취급한다. 장례 식사나 웨딩 케이터링 업체처럼 렌더링하지 않는다.
- 장례 식사/운구/장례 지도/빈소 관련 UI는 `한결 의전` 또는 Funeral vendor contract를 기준으로 표시한다.
- 남은 UI 작업: Wedding/Funeral 레이아웃 톤 분리, vendor dashboard 업무 queue형 UI, Step 4 lane UI, notification UI, image warning 정리.

검증 결과:

- `npx prisma generate`: 통과.
- `npm run db:seed`: 통과.
- `npx tsx scripts/verify-quote-flow.ts`: 통과.
- `npx tsx scripts/launch-readiness-smoke.ts`: 통과.
- `npx tsx scripts/server-action-read-concurrency-smoke.ts`: 통과.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, database schema up to date.

Chrome MCP 재확인 항목:

- `/planner/funeral?planId=...&step=3`에서 Wedding module/label 금지 키워드가 노출되지 않는지 확인한다.
- `/planner/wedding?planId=...&step=3`에서 Funeral module/label 금지 키워드가 노출되지 않는지 확인한다.
- `/planner/funeral?step=4`에서 reservation/quote response의 vendor/service/module label이 Funeral domain에 맞는지 확인한다.
- `/vendor/dashboard`에서 `오르세 플로럴`과 `한결 의전`의 업무 queue가 서로 다른 event/service mapping을 유지하는지 확인한다.

## 28. Critical planner routing/auth stability fix - 2026-05-29

범위:

- main merge blocker로 분류된 UX-01, UX-02, UX-03만 수정했다.
- UI redesign, README, `docs/Claude_STATUS.md`, vendor-service-event mapping 변경은 하지 않았다.
- QuoteRequest → QuoteResponse → Accept → Reservation(PENDING) → Confirm(CONFIRMED) 표준 흐름은 유지했다.

UX-01 원인과 수정:

- 원인: `/planner/funeral` 서버 페이지의 비로그인 guard가 `/login?callbackUrl=/planner/funeral` 고정값만 사용했다. QA에서 step=4 deep link가 login이 아닌 home으로 보인 것은 callback context가 손실된 상태에서 login/default routing과 결합된 증상으로 판단한다.
- 수정: `buildPlannerCallbackPath()`와 `buildLoginCallbackHref()`를 추가해 funeral/wedding 모두 현재 pathname + search 전체를 callbackUrl에 encode한다.
- 예: `/planner/funeral?planId=abc&step=4` → `/login?callbackUrl=%2Fplanner%2Ffuneral%3FplanId%3Dabc%26step%3D4`.

UX-03 callbackUrl query 보존:

- 원인: wedding/funeral auth guard가 planId/step query를 읽지 않고 route path만 callbackUrl로 넘겼다.
- 수정: `searchParams`의 모든 key/value를 `URLSearchParams`로 재구성해 callbackUrl에 포함한다. 배열 query는 append하고 undefined는 제외한다.
- cross-type guard도 path만 바꾸고 query를 보존한다. Wedding planId로 funeral에 들어오면 `/planner/wedding?...`으로, Funeral planId로 wedding에 들어오면 `/planner/funeral?...`으로 이동한다.

UX-02 Server Action POST 503 완화:

- 원인 후보: `EventPlanningWorkspace` mount 직후 `getVendorServiceModules()`와 `getQuotesByPlan()`을 클라이언트에서 호출했고, React dev strict mode 또는 빠른 route refresh와 겹치면 동일 read Server Action POST가 반복될 수 있다. SQLite busy/locked류 transient read 실패가 503으로 노출됐을 가능성이 있다. 현재 증상만으로 DB lock 단일 원인이라고 단정하지 않는다.
- 완화: wedding/funeral 서버 페이지에서 초기 selected vendor modules와 selected plan quote requests를 서버에서 먼저 읽어 client props로 전달한다.
- 완화: client workspace는 initial cache가 있으면 mount-time Server Action POST를 건너뛰고, vendor/plan 변경 또는 quote write 이후 refresh에서만 read action을 호출한다.
- 완화: `getPlanById()`, `getPlansWithQuoteStatus()`, `getUserPlans()`, `getQuotesByPlan()`, `getVendorServiceModules()`, `getQuoteRequestsForVendor()`, `calculateQuoteTotal()` read path에 `withPrismaRetry()`를 적용했다. write action에는 중복 생성 위험 때문에 retry를 추가하지 않았다.
- 목표: Network 기준 planner step=1~4 초기 로드에서 불필요한 Server Action POST와 POST 503을 0건으로 낮춘다.

새/보강 smoke:

- `scripts/verify-planner-auth-redirect.ts`: callbackUrl helper가 pathname + search를 보존하는지 검증한다.
- `scripts/server-action-read-concurrency-smoke.ts`: planner bootstrap read를 Wedding/Funeral 양쪽, vendor modules, quote requests까지 반복 병렬 실행한다.

검증 결과:

- `npx prisma generate`: 통과.
- `npm run db:seed`: 통과.
- `npx tsx scripts/verify-planner-auth-redirect.ts`: 통과.
- `npx tsx scripts/verify-quote-flow.ts`: 통과.
- `npx tsx scripts/launch-readiness-smoke.ts`: 통과.
- `npx tsx scripts/server-action-read-concurrency-smoke.ts`: 통과.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- `npx prisma migrate status`: 통과, database schema up to date.
- built Next server에서 비로그인 HTTP redirect 확인:
  - `/planner/funeral?planId=funeral-id&step=4` → `Location: /login?callbackUrl=%2Fplanner%2Ffuneral%3FplanId%3Dfuneral-id%26step%3D4`.
  - `/planner/wedding?planId=wedding-id&step=3` → `Location: /login?callbackUrl=%2Fplanner%2Fwedding%3FplanId%3Dwedding-id%26step%3D3`.

Chrome MCP 재QA 시나리오:

- 비로그인 상태에서 `/planner/funeral?planId=FUNERAL_ID&step=4` 접근 시 `/login`으로 이동하고 callbackUrl에 `planId`와 `step=4`가 포함되는지 확인한다.
- 로그인 완료 후 funeral planner의 동일 planId와 step=4로 복귀하는지 확인한다.
- 비로그인 상태에서 `/planner/wedding?planId=WEDDING_ID&step=3` 접근 시 `/login` callbackUrl에 `planId`와 `step=3`이 포함되는지 확인한다.
- 로그인 완료 후 wedding planner의 동일 planId와 step=3으로 복귀하는지 확인한다.
- `/planner/wedding` 및 `/planner/funeral` step=1~4 초기 로드에서 Network POST 503이 재발하지 않는지 확인한다.

남은 Claude UI 작업:

- 이번 변경은 routing/auth/server-action stability만 다뤘다.
- Wedding/Funeral 레이아웃 톤 분리, vendor dashboard 업무 queue형 UI, Step 4 lane UI, notification UI, image warning 정리는 Claude UI 작업으로 남긴다.

## 29. BUG-CR-01 Funeral planner RSC navigation stability - 2026-05-29

범위:

- BUG-CR-01만 조사/수정했다.
- UI redesign, Wedding/Funeral domain mapping, seed, QuoteRequest/QuoteResponse/Reservation 핵심 로직, README, `docs/Claude_STATUS.md`는 수정하지 않았다.

원인:

- `/plans`의 Wedding/Funeral CTA href 생성은 동일한 `getPlannerLink()`와 `URLSearchParams`를 사용하며, Funeral href는 `/planner/funeral?planId=cmpq7awy6000u12vdhqarb1ji&step=4`로 정확했다.
- `/planner/funeral/page.tsx`와 `/planner/wedding/page.tsx`의 RSC read path는 동일 구조이며, bootstrap DB read와 initial quote/module read에는 기존 `withPrismaRetry()` 경로가 적용되어 있었다.
- `EventPlanningWorkspace`는 initial quote/module cache가 있으면 mount 직후 추가 Server Action read를 건너뛴다.
- 남은 차이는 Next `Link` 자동 prefetch가 `/plans` 체류 중 planner RSC GET을 먼저 만들고, CTA click navigation이 별도 RSC GET을 다시 만드는 중복 GET 경로였다. QA의 `...&_rsc=e111h` 503, `...&_rsc=15m0i` 200 패턴은 이 prefetch/click 중복과 일치한다.

수정:

- `app/plans/page.tsx`: desktop/mobile planner status CTA Link에 `prefetch={false}`를 추가했다. href와 client-side navigation은 유지한다.
- `scripts/server-action-read-concurrency-smoke.ts`: `/plans` planner status CTA가 `prefetch={false}`를 유지하는지 확인하는 guard를 추가했다. 기존 concurrent read smoke도 계속 실행한다.
- Funeral page DTO, Wedding/Funeral mapping, seed, quote/reservation 핵심 로직은 변경하지 않았다.

RSC 503 재QA:

- `npm run dev`를 `localhost:3001`에서 실행해 `planner@yeon.local / demo1234`로 인증했다.
- `/plans` HTML에서 planner CTA href 확인:
  - Funeral: `/planner/funeral?planId=cmpq7awy6000u12vdhqarb1ji&step=4`
  - Wedding: `/planner/wedding?planId=cmpq7awy3000t12vd6icnz7ij&step=4`
- 인증된 RSC GET 반복 확인:
  - Funeral `/planner/funeral?planId=cmpq7awy6000u12vdhqarb1ji&step=4&_rsc=...`: 12/12건 200
  - Wedding `/planner/wedding?planId=cmpq7awy3000t12vd6icnz7ij&step=4&_rsc=...`: 12/12건 200
- 직접 URL 접근/refresh에 해당하는 normal GET은 기존 조사와 동일하게 200 경로다.

남은 Claude UI 작업:

- Wedding/Funeral 레이아웃 톤 분리.
- vendor dashboard 업무 queue형 UI.
- Step 4 lane UI.
- notification UI.
- image warning 정리.

## 31. BUG-DB01 demo data reservation integrity - 2026-05-29

범위:

- demo login 중 호출되는 `ensureDemoData()`의 DB 오염만 수정했다.
- UI, `docs/Claude_STATUS.md`, README, Wedding/Funeral domain mapping, QuoteRequest/QuoteResponse/Reservation action contract는 수정하지 않았다.

원인:

- `npm run db:seed`는 `ensureDemoData()` 실행 후 `seedModularQuoteData()`에서 legacy reservations를 삭제하고 modular quote workflow fixture 3건을 생성한다.
- 그러나 demo login 경로의 `authorize()`는 demo 계정 로그인 시 `ensureDemoData(prisma)`를 다시 호출한다.
- 기존 `ensureDemoData()`는 legacy `Reservation` 4건을 직접 생성했다.
- 그 결과 seed 직후 `reservations=3`이던 DB가 demo login 이후 `reservations=7`로 증가했고, `/plans`는 `QuoteRequest` 중심으로, Step 4는 all reservations 중심으로 상태를 읽어 화면 상태 불일치 가능성이 생겼다.

수정:

- `lib/demo/ensure-demo-data.ts`에서 legacy reservation, reservation-bound transaction, reservation-bound review 생성 경로를 제거했다.
- `ensureDemoData()`는 demo users/vendors, vendor legacy catalog services, event plans, posts, invitations 같은 bootstrap 데이터만 보강한다.
- modular quote workflow fixture는 `prisma/seed.ts`의 `seedModularQuoteData()`가 source-of-truth다.
- `prisma/seed.ts`의 accepted quote pending reservation에 `vendorConfirmationDueAt`을 채워 runtime `acceptQuoteResponse()` contract와 맞췄다.
- `lib/vendor-dashboard-contract.ts`는 `newQuoteRequests`와 `pendingConfirmations`가 `quoteRequestId != null`인 quote workflow reservations만 포함하도록 보강했다.

검증 기준:

- seed baseline: `reservations=3`, `quoteRequests=4`, `quoteResponses=2`.
- `ensureDemoData(prisma)` 1회 호출 후 count 유지.
- `ensureDemoData(prisma)` 2회 호출 후 count 유지.
- `Reservation(PENDING, quoteRequestId=null)`은 vendor new request/pending confirmation contract에 포함되지 않는다.
- `/plans` quote workflow와 Step 4 reservations가 같은 demo scenario를 가리키도록 non-workflow reservations가 없어야 한다.

새 검증:

- `scripts/verify-demo-data-integrity.ts`를 추가했다.
- 이 스크립트는 seed baseline count, repeated `ensureDemoData()` idempotency, vendor dashboard contract, Step 4 non-workflow reservation 부재, accepted pending reservation due date를 확인한다.

최종 workflow contract:

- `createQuoteRequest()`: `QuoteRequest(PENDING)` + `Reservation(PENDING)` placeholder 생성.
- `submitQuoteResponse()`: `QuoteResponse` 생성, `QuoteRequest(RESPONDED)`, reservation `quoteResponseId`/`quotedAmount` 동기화, `confirmedAmount=null`.
- `acceptQuoteResponse()`: `QuoteRequest(ACCEPTED)`, `Reservation(PENDING)`, `vendorConfirmationDueAt` 설정.
- `confirmReservation()`: vendor-only, `Reservation(CONFIRMED)`, `confirmedAmount` 설정.

Antigravity/Claude 프론트 상태 contract:

- Step 3 source-of-truth는 `VendorServiceModule`이다. legacy `VendorService`는 vendor service manager/catalog bootstrap용이며 planner Step 3 상태 계산에 섞으면 안 된다.
- `/plans` CTA 상태는 `QuoteRequest` workflow summary 기준이다.
- Step 4는 quote workflow에 연결된 reservations 기준으로 해석해야 한다.
- vendor pending confirmation은 `Reservation(PENDING) + QuoteRequest(ACCEPTED) + quoteRequestId != null`만 의미한다.

UI polish 전 확인 완료:

- demo login 후 reservation count가 seed baseline에서 증가하지 않는지 검증하는 스크립트가 추가됐다.
- legacy reservation이 vendor dashboard pending/new buckets를 오염시키지 않도록 contract가 보강됐다.
- accepted pending seed fixture는 due date를 가진다.

## 30. BUG-CR-01 hard navigation follow-up - 2026-05-29

범위:

- Focused Chrome QA에서 남은 BUG-CR-01만 수정했다.
- UI redesign, seed, Wedding/Funeral domain mapping, QuoteRequest/QuoteResponse/Reservation 핵심 로직, README, `docs/Claude_STATUS.md`는 수정하지 않았다.

원인 후보:

- `/planner/funeral?planId=...&step=4` 직접 접근과 새로고침은 200이므로 funeral planner document render/read path 자체는 안정적이다.
- `/plans` CTA click에서만 `_rsc=e111h` 503이 재현됐고 같은 URL의 다른 `_rsc` 요청은 200이었다. 이는 Next client-side route transition 중 생성되는 RSC fetch 한 건이 실패하고 캐시/후속 fetch로 화면은 정상 렌더되는 패턴이다.
- 이전 조치의 `prefetch={false}`는 hover/viewport prefetch만 막고, click 시 Next `<Link>`의 client navigation과 RSC fetch는 그대로 남긴다. 따라서 click-time `_rsc=...` 요청 제거에는 충분하지 않았다.

수정:

- `app/plans/page.tsx`의 planner 상세 CTA를 Next `<Link>`에서 일반 `<a href={plannerLink}>`로 전환했다.
- desktop/mobile 카드 CTA 모두 hard navigation으로 정렬했다.
- href 생성은 기존 `getPlannerLink()`를 그대로 사용하므로 `planId`와 `step` query는 변경하지 않았다.
- 스타일 class는 그대로 유지했다.

재QA 항목:

- `/plans`에서 Funeral "받은 견적 확인" 클릭 시 `/planner/funeral?planId=...&step=4`로 document navigation 되는지 확인한다.
- 같은 Funeral CTA 클릭 테스트를 2회 이상 반복하고 Network에 `_rsc=...` 503이 없는지 확인한다.
- Wedding planner CTA도 `/planner/wedding?planId=...&step=4`로 정상 document navigation 되는지 확인한다.
- direct URL 접근과 새로고침은 계속 200인지 확인한다.

남은 Claude UI 작업:

- Wedding/Funeral 레이아웃 톤 분리.
- vendor dashboard 업무 queue형 UI.
- Step 4 lane UI.
- notification UI.
- image warning 정리.

## 20. 2026-05-29 AGY Fullstack Domain & DTO Stabilization

Codex unavailable 상황 하에 Antigravity (AGY)가 임시로 full-stack domain/backend 작업을 수행하여 yeON의 서비스 카테고리, 업체 역할, 패키지, 견적 비교 가능성, Step 3/Step 4 DTO 계약을 안정화했습니다.

### 1. 도메인 개념의 명확화 & 잘못된 비교 원천 차단
- **기존 문제**:
  - Wedding/Funeral 서비스가 단순 vendor category 하나로 설명되지 않았고, 식음료(catering), 플라워(floral) 등이 예식장 패키지 안에 묶이거나 단독 애드온 형태로 중첩되어 제공되었습니다.
  - 프론트엔드에서 `vendor.category` 또는 `selectedModules[0]`의 첫 번째 값을 기준으로 카테고리를 추론해 1:1 벤더 비교표를 제공하는 위험한 heuristic 기법이 사용되어, 꽃집(Orsay Floral)과 예식장(Moment Garden)을 직접 가격 비교하는 비상식적인 UI가 렌더링되었습니다.
- **도메인 해결책 (Option A: 최소 구현 우선)**:
  - 스키마 마이그레이션 부담 없이 비즈니스 레이어(`app/actions/quote.ts`)와 DTO 수준에서 **Service Category**, **Vendor Service Role**, **Comparable Group** 개념을 완벽하게 수립했습니다.
  - **resolveVendorRoleAndGroup** 비즈니스 헬퍼를 도입하여 각 벤더의 역할(PRIMARY, INCLUDED, ADDON, OPTIONAL, BUNDLE)과 목적별 **comparableGroupKey**를 정밀 정의했습니다.
  - Moment Garden $\rightarrow$ `wedding_venue_package` (PRIMARY)
  - Orsay Floral $\rightarrow$ `wedding_floral_upgrade` (ADDON)
  - Han-gyul $\rightarrow$ `funeral_basic_service` (BUNDLE)
  - 두 벤더의 `comparableGroupKey`가 서로 다르므로 동일 선상의 1:1 비교를 원천 차단하고 각각 독자적인 제안 카드로 분리 렌더링되게 만들었습니다.

### 2. Step 3 / Step 4 DTO 계약 정립
- **Step 3 Preparation Group DTO (`Step3PreparationGroupDTO`)**:
  - 각 벤더가 제공하는 모듈의 카테고리별 공급 성격과 기본 패키지(`mode: PACKAGE` vs `mode: ADDON`), 포함/선택 모듈 ID 리스트를 백엔드에서 명확하게 파악하여 정규화해 제공합니다.
- **Step 4 Category Status DTO (`Step4CategoryStatusDTO`)**:
  - Wedding 5대 대분류(`venue`, `catering`, `floral`, `invitation`, `etc`) 및 Funeral 5대 대분류(`funeralHall`, `meal`, `obituary`, `hearse`, `altarFloral`)별 상태를 백엔드 액션(`getStep4DashboardData`)이 직접 결정해 내려줍니다.
  - status는 `NOT_REQUESTED`, `REQUESTED`, `RESPONDED`, `ACCEPTED_WAITING_VENDOR`, `CONFIRMED`로 정밀 계산되며, 동일 `comparableGroupKey` 내에 수락 가능한 응답이 2개 이상일 때만 `canCompare`를 `true`로 리턴합니다.

### 3. 프론트엔드 연동 & Heuristics 박멸
- **step4-booking-dashboard.tsx**:
  - 프론트엔드 내의 하드코딩된 문자열 카테고리 매핑 및 selectedModules[0] 추론 코드를 완전히 걷어내고, 백엔드 DTO `step4DashboardData`를 소비하도록 전면 수정했습니다.
  - `group.canCompare`가 `true`일 때만 복수 견적 비교 테이블을 렌더링하고, 단일 견적 응답은 럭셔리 싱글 제안서 카드로 격조 높게 분할 렌더링합니다.
- **event-planning-workspace.tsx**:
  - `step4DashboardData` state를 추가하고, 플랜 변경 및 견적 수락 등의 비즈니스 완료 트랜잭션 시 `refreshQuoteRequests` 함수를 통해 `getStep4DashboardData(planId)`를 완벽히 동기화해 단 한 번의 UI stale/화면 불일치도 허용하지 않습니다.

### 4. 검증 및 빌드 결과
- **Prisma & Seed**: `npx prisma generate` 및 `npm run db:seed` 완벽 수행.
- **Smoke Tests**: `verify-demo-data-integrity`, `verify-quote-flow`, `launch-readiness-smoke`, `server-action-read-concurrency-smoke`, `verify-planner-auth-redirect` 100% 무결 통과.

## 21. 2026-05-29 QA Stabilization & Bug Fixes

Claude QA에서 발견된 핵심 버그 5종을 완벽하게 Stabilization 완료했습니다.

### 1. 주요 버그 해결
*   **QA-06 (Funeral Step 4 중복 카테고리 매칭)**: BUNDLE/PRIMARY 역할을 가진 벤더는 오로지 대관(`venue`/`funeralHall`) 카테고리에만 매칭되도록 통제하여 한결 의전의 제안서가 `meal` 레인에 동시에 등장하던 오류를 원천 박멸했습니다.
*   **QA-02 (Vendor Dashboard Priority Banner)**: 고객 견적 수락 수신 시 벤더 워크스페이스 최상단에 **"예약 최종 확정 필요"** 우선순위 배너를 노출하고, 5열로 확장된 메트릭 카드를 통해 **"최종 확정 필요 N건"** 메트릭을 신설하여 벤더가 즉각 액션을 취할 수 있게 했습니다.
*   **QA-03 (Frontend Heuristic 제거)**: `step4-booking-dashboard.tsx` 내의 getCategoryKeyOfRequest, getCategoryKeyOfReservation 헬퍼 함수를 완전히 걷어내고 오직 백엔드 DTO `step4DashboardData`만을 100% Source of Truth로 정립했습니다.
*   **QA-04 (Funeral empty state Sparkles 교체)**: 장례 Step 4 비어있음 화면에서 부적절한 Sparkles 아이콘을 제거하고 정중한 `ClipboardList` 아이콘으로 전환했습니다.
*   **QA-05 (Vendor Dashboard raw enum 한글화)**: `CATEGORY_LABEL_MAP` 프리미엄 매핑 사전을 `lib/step3.shared.ts`에 도입하여 `FUNERAL_HALL`, `ALTAR_FLORAL` 등의 raw enum을 격식 있는 한글 라벨로 자동 교정했습니다.

### 2. Regression 방지 검증 도입
*   `scripts/verify-service-category-contract.ts`를 신규 구축하여 Moment Garden & Orsay Floral의 격리성, 중복 응답 방지, 그리고 예약 상태 분할 로직을 매 CI/CD 단계에서 자동으로 감지하게 보강했습니다.

- **Next.js Production Build & Lint**: Next.js optimized production build와 linter가 완벽 통과하여, 비동기 서버 액션 명세를 어긴 동기 함수 `resolveVendorRoleAndGroup`의 `export` 지시어를 말끔히 정리하고 내부 비즈니스 헬퍼로 격하함으로써 런칭 릴리즈 안정성을 철저히 확보했습니다.

## 22. 2026-05-29 AGY Remaining Workflow QA Fixes

남아 있던 4대 핵심 Workflow QA Regression 이슈(WF-QA-01 ~ WF-QA-04)를 완벽하게 stabilization 완료했습니다.

### 1. 주요 수정 사항
*   **WF-QA-01 (Server Actions POST 503)**:
    - `getStep4DashboardData` API 내부의 Prisma 복수 조회를 단일 `withPrismaRetry` 트랜잭션으로 강력하게 감싸 SQLite busy-lock 상황을 예방했습니다.
    - `components/features/planning/event-planning-workspace.tsx` 내의 `useEffect` 의존성 배열에서 불필요한 `quoteRequestsCache` 객체 레퍼런스 참조를 제거하여, 캐시 상태 변경 시 비동기 서버 액션 `getStep4DashboardData`가 다발성으로 중복/병렬 호출되던 무한 루프 병목을 원천 박멸했습니다.
*   **WF-QA-02 (Vendor/Planner 카테고리 라벨 불일치)**:
    - BUNDLE(한결 의전) 예약 제안에 대해 vendor-workspace 내의 6개 렌더링 호출 지점을 모두 `getServiceLabel`로 통일했습니다.
    - 이를 통해 벤더 대시보드 리스트 헤더, 상세 뷰, 그리고 "응답 대상 요청 선택" 드롭다운 라벨 등 모든 presentation layer에서 "장례식장·기본 의전"으로 통일 노출시켜 플래너 Step 4 카테고리 랭귀지와의 논리적 불일치를 완전히 해결했습니다.
*   **WF-QA-03 (장례 플랜 카드 문구 톤 수정)**:
    - `/plans`의 장례(FUNERAL) 플랜 카드 문안을 기존 웨딩용 카피("도도하게...")에서 차분하고 경건한 장례 전문 카피("정중하게 준비된 의전 제안서가 도착했습니다...")로 격리 분기했습니다.
*   **WF-QA-04 (Vendor 요청 상세 행사 유형 빈 값)**:
    - `vendor-workspace.tsx` 내 행사 유형 렌더링 시, `selectedReservation.eventPlan?.type`이 유효하고 `getEventTypeLabel`이 정상 한글 매핑 라벨("웨딩", "장례" 등)을 반환할 때만 행을 렌더링하고, 비어 있거나 unmapped fallback 상황에서는 행 자체를 숨겨 raw enum이나 빈 라벨이 노출되지 않도록 방어했습니다.

### 2. 빌드 및 검증
- Prisma Generate, DB Seed, custom verify 스크립트 6종, TSC, Lint, Production Build 등 12종의 전체 validation pipeline을 100% 무결점으로 통과 완료했습니다.

## 23. Ship coherent yeON product flow - 2026-05-29

Product Owner + Full-stack Lead Engineer 권한으로 yeON 프로젝트의 전반적인 제품 경험을 일관되고 품격 있게 설계 및 마감했습니다. 이전의 단편화된 조치들을 극복하고, 행사 유형별 단일 파트너사가 전체 준비 패키지 및 모듈러 조율을 대변하는 3-role 코어 모델(Planner, Wedding Vendor, Funeral Vendor)을 명확하게 수립했습니다.

### 1. 3-role 코어 제품 모델 확립 및 전문 벤더 비활성화
- **데모 계정 단일화**:
  - 핵심 데모 계정을 `planner@yeon.local` (플래너), `venue@yeon.local` (모먼트 가든, Wedding Vendor), `memorial@yeon.local` (한결 의전, Funeral Vendor) 3개로 공고화했습니다.
  - 기존 전문 업체 계정인 `catering@yeon.local` (오르세 플로럴)은 `isActive: false`로 비활성화하여 데모 selector, 플래너 Step 3/4 화면, 문서 및 QA 기준에서 깨끗이 제거했습니다.
  - 전문 업체 분리(Catering, Floral specialist)는 핵심 데모 흐름에서 배제하고 Future Expansion(향후 확장)으로 문서화에 명시했습니다.

### 2. Wedding / Funeral 단일 핵심 벤더 모델 구성
- **Wedding Vendor (모먼트 가든)**:
  - 기존의 단독 공간 제공자에서 식사, 플라워, 장식, 음향, 신부대기실, 청첩장 등 결혼 준비에 필요한 모든 서비스를 일괄 또는 선택 옵션으로 제공하는 종합 웨딩 벤더로 전환했습니다.
  - `floral` 모듈을 `venueVendor`'s `supportedServiceModules`에 추가하여, 사용자가 모먼트 가든 하나로부터 대관과 꽃장식을 원스톱으로 확인하고 견적을 요청하는 직관적인 흐름으로 개편했습니다.
- **Funeral Vendor (한결 의전)**:
  - 장례식장/빈소, 문상객 식사, 부고 안내, 운구, 제단꽃, 장례 지도사 등 모든 의전 서비스를 한결 의전 벤더 아래의 서비스 모듈로 재정리했습니다.
  - 복잡한 개별 상품 장바구니 구성을 배제하고, 기본 의전 구성을 정중하고 차분하게 확인한 뒤 통합 상담을 요청하는 품격 있는 흐름을 구축했습니다.

### 3. Step 3 & Step 4 UI 및 비즈니스 필터 정제
- **Server Action 기반 Orsay Floral 원천 필터링**:
  - SQLite의 `(planId, vendorId)` unique index 제약을 준수하면서 기존 데이터 정합성을 해치지 않기 위해, `app/actions/quote.ts` 내 `getQuotesByPlan`, `getStep4DashboardData` server actions의 쿼리에 `vendor: { isActive: true }` 필터를 완벽히 내장했습니다.
  - 이로써 비활성화된 Orsay Floral의 견적 요청/예약 데이터가 플래너 워크스페이스 상에서 깔끔하게 숨겨지며, single active vendor 기준에 따른 정상 흐름을 완벽하게 완성했습니다.
- **용어 및 비주얼 정화**:
  - "비교"라는 불필요한 경쟁적 표현을 모두 걷어내고, "제안서 확인 / 수락 / 업체 확정 대기" 등의 도메인 언어로 `event-planning-workspace.tsx`와 `step4-booking-dashboard.tsx` 내의 헤더, 설명 문구, 버튼 라벨을 모두 아름답게 다듬었습니다.

### 4. 벤더 대시보드 애니메이션 및 프리미엄 터치 최적화
- **정적 프리미엄 레이아웃 완성**:
  - 파트너가 당일 처리할 업무인 "최종 예약 승인" 및 "최종 확정 대기" 영역에서 시선을 어지럽히는 과도한 모션 애니메이션(`animate-pulse`, `animate-ping`)을 전면 박멸했습니다.
  - 엄숙하고 격조 높은 럭셔리 골드/바이올렛 계열의 정적 강조 배너와 배지를 배치하여 최상급의 visual excellence를 확보했습니다.

### 5. 종합 검증 파이프라인
- 업그레이드된 `verify-service-category-contract.ts` 스크립트를 포함하여 6종의 도메인 검증 스크립트, `tsc`, `lint`, Next.js optimized production build가 100% 무결점으로 통과함을 엄격하게 확인 완료했습니다.


---

## Auth Routing Stale Session Loop 수정 (2026-05-30)

### 1. Root Cause
- `npm run db:seed` 이후 브라우저 JWT 세션은 이전 CUID를 그대로 유지함.
- DB에는 새로운 CUID가 생성되므로, 기존 세션의 user ID가 DB에 존재하지 않는 상태가 됨.
- `/vendor/dashboard` 페이지가 DB에서 vendor를 찾지 못하면 `/login?callbackUrl=/vendor/dashboard`로 redirect함.
- `/login` 페이지는 JWT 세션만 확인하고, session이 유효하면(DB 확인 없이) `callbackUrl`로 redirect함.
- 이로 인해 `/vendor/dashboard` ↔ `/login?callbackUrl=/vendor/dashboard` 무한 307 리다이렉트 루프 발생.

### 2. 수정 사항
- **`app/(auth)/login/page.tsx`**: 인증된 사용자의 자동 redirect 전에 `prisma.user.findUnique()`로 DB 존재 여부를 검증. stale session이면 로그인 폼을 표시하여 재인증 유도.
- **`app/vendor/dashboard/page.tsx`**: stale session 감지 시 redirect 대상을 `/login?callbackUrl=/vendor/dashboard` 대신 `/login`으로 변경하여 루프 차단.
- **`app/vendor/actions.ts` `completeVendorOnboarding`**: `prisma.user.update()` 호출 전 `prisma.user.findUnique()` 존재 확인 가드 (기존 커밋에서 적용 완료).

### 3. `/logout` 404 관련
- `/logout`는 지원되지 않는 경로이며, UI 어디에서도 `/logout`로 링크하지 않음.
- 로그아웃은 `LogoutButton` 컴포넌트 → `next-auth/react` `signOut()` → `/api/auth/signout`으로 처리됨.
- 조치 불필요.

### 4. 추가된 검증 스크립트
- **`scripts/verify-role-routing-contract.ts`**: 9개 검증 항목 포함.
  1. 코어 데모 계정 존재 여부 (planner, venue, memorial)
  2. 시드 벤더의 `supportedEventTypes` 유효성
  3. 시드 벤더의 `supportedServiceModules` 유효성
  4. 시드 벤더 프로필 완성도 (onboarding bypass)
  5. 플래너의 벤더 대시보드 접근 차단
  6. 비활성 벤더(Orsay Floral) 코어 데모 제외
  7. 로그인 redirect destination 로직 검증
  8. 벤더 대시보드 가드 로직 검증
  9. 시드 벤더 onboarding bypass 검증

### 5. 검증 결과 (2026-05-30)
| 항목 | 결과 |
|---|---|
| `npx prisma generate` | ✅ |
| `npm run db:seed` | ✅ |
| `verify-demo-data-integrity` | ✅ |
| `verify-quote-flow` | ✅ |
| `launch-readiness-smoke` | ✅ |
| `server-action-read-concurrency-smoke` | ✅ |
| `verify-planner-auth-redirect` | ✅ |
| `verify-service-category-contract` | ✅ |
| `verify-role-routing-contract` | ✅ |
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npx prisma migrate status` | ✅ (14 migrations, up to date) |

### 6. Browser QA 결과
| 시나리오 | 결과 |
|---|---|
| 비인증 `/login` | 200 로그인 폼 표시 ✅ |
| 비인증 `/vendor/dashboard` | 307 → `/login?callbackUrl=...` → 200 (루프 없음) ✅ |
| Planner `/login` → redirect | 307 → `/plans` ✅ |
| Planner `/vendor/dashboard` | 307 → `/plans` ✅ |
| Planner `/plans` | 200 ✅ |
| Venue vendor `/login` → redirect | 307 → `/vendor/dashboard` ✅ |
| Venue vendor `/vendor/dashboard` | 200 (onboarding 없음) ✅ |
| Memorial vendor `/login` → redirect | 307 → `/vendor/dashboard` ✅ |
| Memorial vendor `/vendor/dashboard` | 200 (onboarding 없음) ✅ |
| Stale session `/vendor/dashboard` | 307 → `/login` → 200 (루프 없음, 1회 redirect) ✅ |
| Stale session `/login` | 200 (폼 표시, redirect 없음) ✅ |
| Server log | 500/503 에러 없음 ✅ |
