# Codex STATUS

작성 기준: 현재 repository 실제 코드 확인. `docs/Claude_STATUS.md`는 읽기 전용으로만 참고했고 수정하지 않았다. `PM-instruction.txt`는 repo 내에서 찾을 수 없어 확인 필요다.

## 1. 현재 백엔드 상태 요약

일반 사용자 -> 업체 -> 일반 사용자 견적/예약 흐름은 DB/action/API 기준으로 bridge 구조가 잡혀 있다. 핵심은 새 `QuoteRequest` 모델과 legacy vendor dashboard의 `Reservation` 모델을 `Reservation.quoteRequestId`로 연결한 것이다.

표준 생성 흐름:

1. 일반 사용자가 `createQuoteRequest()` 또는 legacy 요청 API/action을 호출한다.
2. 백엔드는 `QuoteRequest(PENDING)`와 `Reservation(PENDING, quoteRequestId, confirmedAmount=null)` placeholder를 함께 만든다.
3. `/vendor/dashboard`는 기존처럼 `Reservation`을 조회해도 새 요청을 볼 수 있다.
4. 업체가 응답하면 `QuoteResponse`가 생성되고 `QuoteRequest.status=RESPONDED`로 바뀐다.
5. 연결된 `Reservation`에는 `quoteResponseId`, `confirmedAmount`, `quotedAmount`가 채워진다.
6. 일반 사용자가 `acceptQuoteResponse({ quoteResponseId })`를 호출하면 `QuoteRequest.status=ACCEPTED`가 되고 기존 placeholder `Reservation`을 재사용한다.
7. 업체가 `confirmReservation(reservationId)`를 호출하면 `Reservation.status=CONFIRMED`가 된다.

빌드 통과뿐 아니라 [scripts/verify-quote-flow.ts](/home/daniel/yeon/scripts/verify-quote-flow.ts:1)로 위 흐름의 DB smoke 검증을 반복 실행할 수 있다.

## 2. 실제 수정/추가된 백엔드 파일

- `prisma/schema.prisma`: `Reservation.quoteRequestId @unique`와 `QuoteRequest.reservation` 관계 추가.
- `prisma/migrations/20260511000000_add_reservation_quote_request_bridge/migration.sql`: bridge 관계 재현용 migration 추가.
- `prisma/seed.ts`: QA용 상태 4종 보강: 요청만 보냄, 업체 응답함, 사용자 수락함, 업체 확정함.
- `scripts/verify-quote-flow.ts`: backend smoke verification 스크립트 추가.
- `types/reservation.ts`: `ReservationData.quoteRequestId` 추가.
- `app/actions/_utils.ts`: reservation mapper가 `quoteRequestId`를 반환.
- `app/actions/quote.ts`: 새 quote request 생성/업체 응답/사용자 수락 시 reservation bridge 동기화.
- `app/actions/plan.ts`: placeholder reservation을 수락 전 확정 예약처럼 오인하지 않도록 `getPlansWithQuoteStatus()` 상태 계산 보정.
- `app/actions/reservation.ts`: `confirmReservation()`이 연결 quote request의 `ACCEPTED` 상태를 요구.
- `app/api/vendor/reservations/[reservationId]/route.ts`: vendor dashboard legacy 응답 API가 `QuoteResponse`와 `QuoteRequest.status`를 함께 갱신.
- `app/api/reservations/[reservationId]/route.ts`: legacy 일반 사용자 confirm/cancel route가 연결 quote request 상태도 함께 갱신.
- `app/api/reservations/route.ts`: legacy reservation 생성 API도 `QuoteRequest + Reservation placeholder`를 함께 생성.
- `app/vendor/actions.ts`: legacy vendor server actions도 quote response/status 동기화.
- `app/vendors/actions.ts`: legacy vendor detail 요청 action도 quote request placeholder 구조로 동기화.
- `docs/Codex_STATUS.md`: 현재 문서.

## 3. Prisma Schema / Migration / DB 상태

현재 로컬 DB 확인 결과:

- `Reservation.quoteRequestId` 컬럼 존재.
- `Reservation_quoteRequestId_key` unique index 존재.
- `Reservation.quoteRequestId -> QuoteRequest.id` FK 존재.
- `npx prisma migrate status` 최종 결과: `Database schema is up to date!`

이번 작업 중 처리:

- 기존 로컬 DB는 이미 `npx prisma db push`로 schema가 반영된 상태였다.
- migration 파일을 추가한 뒤, 현재 로컬 DB에는 같은 변경이 이미 존재하므로 `npx prisma migrate resolve --applied 20260511000000_add_reservation_quote_request_bridge`로 migration 기록을 맞췄다.

개발 환경 전략:

- 현재 이 workspace처럼 이미 `db push`로 반영된 DB: `npx prisma migrate resolve --applied 20260511000000_add_reservation_quote_request_bridge` 후 `npx prisma migrate status`로 확인.
- 깨끗한 새 DB 또는 pre-bridge DB: `npx prisma migrate dev` 또는 배포 환경에서는 `npx prisma migrate deploy`.
- 로컬 QA 재구성: `npx prisma generate && npx prisma db seed && node --import tsx scripts/verify-quote-flow.ts`.

## 4. Quote Flow 상태

허용 Quote 전이:

- `PENDING -> RESPONDED`
- `PENDING -> CANCELED`
- `RESPONDED -> ACCEPTED`
- `RESPONDED -> CANCELED`

`createQuoteRequest(payload)`:

- 입력: `CreateQuoteRequestPayload`
- 반환: `ActionResult<QuoteRequestData>`
- 생성: `QuoteRequest(PENDING)` + `Reservation(PENDING, quoteRequestId, confirmedAmount=null)`
- 중복 방지: `Reservation.quoteRequestId @unique`로 QuoteRequest 하나에 placeholder 하나만 허용.

`submitQuoteResponse(payload)`:

- 입력: `SubmitQuoteResponsePayload`
- 반환: `ActionResult<QuoteResponseData>`
- 동작: `QuoteResponse` 생성, `QuoteRequest.status=RESPONDED`, 연결 reservation에 `quoteResponseId`, `confirmedAmount`, `quotedAmount` 동기화.
- 중복 방지: `Reservation.quoteResponseId @unique`로 QuoteResponse 하나에 reservation 하나만 연결.

`acceptQuoteResponse(payload)`:

- 입력: `{ quoteResponseId, reservedDate? }`
- 반환: `ActionResult<AcceptQuoteResult>`
- 동작: `QuoteRequest.status=ACCEPTED`, 기존 placeholder reservation 재사용. 없을 때만 새 reservation 생성.
- 수락 후 다음 상태: `reservation_pending`.

## 5. Reservation Flow 상태

허용 Reservation 전이:

- `PENDING -> CONFIRMED`
- `PENDING -> REJECTED`
- `PENDING -> CANCELED`
- `CONFIRMED -> CHANGED`
- `CONFIRMED -> CANCELED`
- `CHANGED -> CONFIRMED`

중요 actor 모델:

- 일반 사용자 화면의 “견적 수락”은 `acceptQuoteResponse()`다.
- 일반 사용자 화면에서 이 상태를 “예약 확정”이라고 부르면 안 된다. 수락 직후 reservation은 `PENDING`이며 의미는 “업체 최종 확정 대기”다.
- 업체만 `confirmReservation(reservationId)`로 최종 확정해야 한다. 이유는 업체가 실제 일정/서비스 제공 가능성을 최종 승인해야 하고, 백엔드는 연결 `QuoteRequest.status=ACCEPTED`가 아니면 confirm을 거부한다.

잘못된 흐름 방지:

- 업체는 사용자 수락 전 `confirmReservation()`으로 `CONFIRMED`를 만들 수 없다.
- 일반 사용자는 견적 수락 없이 새 표준 action 기준으로 `CONFIRMED`에 도달할 수 없다.
- terminal/cancel 계열 재전이는 state-machine에서 차단된다.

## 6. Legacy/New 경로 정합성

새 경로:

- `app/actions/quote.ts createQuoteRequest`: quote request와 reservation placeholder 함께 생성.
- `app/actions/quote.ts submitQuoteResponse`: quote response와 reservation 동기화.
- `app/actions/quote.ts acceptQuoteResponse`: 기존 reservation 재사용.
- `app/actions/plan.ts getPlansWithQuoteStatus`: `/plans` 표준 조회.
- `app/actions/reservation.ts confirmReservation`: 업체 최종 확정 표준 action.

legacy 호환 경로:

- `app/api/vendor/reservations/[reservationId]/route.ts`: vendor dashboard 기존 UI가 호출. 이제 quote response/status를 같이 동기화한다.
- `app/api/reservations/[reservationId]/route.ts`: 일반 사용자 legacy confirm/cancel route. 유지하되 새 표준 수락 흐름은 아니다.
- `app/api/reservations/route.ts`: legacy reservation 생성 API도 quote request placeholder를 만든다.
- `app/vendor/actions.ts`: legacy vendor action도 quote response/status를 동기화한다.
- `app/vendors/actions.ts`: legacy vendor detail 요청도 quote request placeholder를 만든다.

## 7. Claude가 의존해야 하는 데이터 계약

`/plans`

- 표준 action: `getPlansWithQuoteStatus()`.
- 반환: `ActionResult<PlanDashboardData[]>`.
- placeholder reservation은 수락 전에는 `reservation_pending`으로 계산하지 않는다.

`vendor dashboard`

- 현재 UI가 legacy `Reservation` 조회를 계속 사용해도 동작한다.
- 신규 권장 조회: 가능하면 향후 `getVendorQuoteRequests()` 또는 quote-aware vendor 조회 action으로 전환.
- 현재 응답 경로: `/api/vendor/reservations/[reservationId]`는 백엔드에서 `QuoteResponse`까지 동기화한다.
- 최종 확정 표준 action: `confirmReservation(reservationId)`.

`Step 3 견적 요청`

- 표준 action: `createQuoteRequest(payload)`.
- legacy fallback: `app/vendors/actions.ts createQuoteRequest(FormData)`도 같은 bridge 구조로 동기화된다.

`Step 4 견적 수락`

- 표준 action: `acceptQuoteResponse({ quoteResponseId, reservedDate? })`.
- 이 action의 성공은 “예약 확정”이 아니라 “견적 수락 및 업체 확정 대기”다.

## 8. Seed 데이터 상태

`npx prisma db seed` 후 포함되는 QA 상태:

- 요청만 보낸 상태: `QuoteRequest(PENDING)` + `Reservation(PENDING, quoteRequestId, confirmedAmount=null)`.
- 업체가 응답한 상태: `QuoteRequest(RESPONDED)` + `QuoteResponse` + `Reservation.quoteResponseId/confirmedAmount`.
- 사용자가 수락한 상태: `QuoteRequest(ACCEPTED)` + `Reservation(PENDING)`.
- 업체가 확정한 상태: seed에는 legacy/확정 확인용 `Reservation(CONFIRMED)` 상태가 포함된다.

현재 seed 결과: `users=6`, `eventPlans=2`, `reservations=4`, `vendorServiceModules=16`, `quoteRequests=5`, `quoteResponses=3`.

## 9. Backend Smoke Verification

실행 명령:

```bash
node --import tsx scripts/verify-quote-flow.ts
```

검증 항목:

- quote request 생성.
- reservation placeholder 생성.
- duplicate placeholder 차단.
- vendor dashboard inbox 조건으로 조회 가능.
- vendor quote request 조건으로 조회 가능.
- 사용자 수락 전 업체 confirm 차단.
- quote response 생성.
- quote request `RESPONDED` 반영.
- reservation `quoteResponseId`, `confirmedAmount`, `quotedAmount` 동기화.
- duplicate quote response reservation 차단.
- `getQuotesByPlan` shape에 responded quote 포함.
- `/plans` dashboard shape에 response 포함.
- placeholder를 수락 전 확정 예약처럼 보지 않음.
- accept 후 기존 placeholder 재사용.
- accept 후 next action은 `reservation_pending`.
- confirm 후 plan dashboard shape에 `CONFIRMED` 표시.
- invalid re-transition 차단.

최신 실행 결과: `[verify-quote-flow] success`.

## 10. 아직 남은 작업

1. Claude 필요: vendor dashboard에서 사용자 수락 후 `confirmReservation(reservationId)`를 호출하는 최종 확정 UI 연결.
2. Claude 필요: Step 4 수락 버튼이 `acceptQuoteResponse({ quoteResponseId })`를 호출하고 성공 후 “업체 확정 대기”로 표시되는지 브라우저 QA.
3. 백엔드 정책 확인 필요: optional modules를 `totalPrice`에 포함할 기준.
4. 백엔드 정책 확인 필요: plan 단위 accepted quote를 하나만 허용할지, 수락 시 다른 vendor 요청을 자동 취소할지 여부.
5. 추후 정리: `ReservationStatus.CANCELLED`와 `CANCELED` 단일화.

## 11. 검증 결과

- `npx prisma generate`: 통과.
- `npx prisma db seed`: 통과.
- `node --import tsx scripts/verify-quote-flow.ts`: 통과.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 통과. `✔ No ESLint warnings or errors`.
- `npm run build`: 통과. Next.js production build 성공.
- `npx prisma migrate status`: 통과. `Database schema is up to date!`

## 12. 다음 작업 규칙

다음 작업 시작 전 반드시 docs/Claude_STATUS.md와 docs/Codex_STATUS.md를 먼저 읽고, 작업 완료 후 이 파일을 최신 코드 기준으로 갱신한다.
