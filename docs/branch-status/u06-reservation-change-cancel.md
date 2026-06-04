# U06 Reservation Change/Cancel Branch Status

> Branch: `codex/u06-reservation-change-cancel`
> Owner/Agent: Codex
> Scope: Reservation change/cancel flow

## Goal

Implement post-confirmation reservation change and cancel request flows.

## Product Rules

- A planner can request reservation changes after reservation creation/confirmation.
- A planner can request reservation cancellation.
- A reservation must not be changed immediately when the planner submits a request.
- Vendor approval is required before changes are reflected.
- If vendor rejects, the original reservation remains unchanged.
- Date negotiation should happen through request/adjustment flow.
- Do not expand `일정 불가 회신` as a major product flow.

## Expected Areas

- `prisma/schema.prisma`
- `prisma/migrations/`
- `app/actions/reservation.ts`
- `types/reservation.ts`
- reservation-related verification scripts
- planner reservation UI only if required
- vendor dashboard reservation request handling only if required

## Must Not Touch

- Mobile invitation/obituary feature files
- Money settlement feature files
- Notification/alarm tab integration, except recording event hooks or TODOs

## Current Status

- Implemented.
- Reservation change/cancel requests are stored separately from `Reservation`.
- Planner request creation does not mutate the original reservation.
- Vendor approval applies the change/cancel to `Reservation`; vendor rejection keeps the reservation unchanged.
- Alarm tab integration was not implemented. Workflow notification/activity hooks were added for future alarm-tab consumption.

## Schema Changes

- Added enum `ReservationRequestStatus`: `PENDING`, `APPROVED`, `REJECTED`.
- Added model `ReservationChangeRequest`.
- Added model `ReservationCancellationRequest`.
- Added `Reservation.changeRequests` and `Reservation.cancellationRequests` relations.
- Added User-side planner/vendor relations for change and cancellation requests.
- Added migration `20260604000000_reservation_change_cancel_requests`.

## Server Actions

- Changed `requestChange` to create `ReservationChangeRequest(PENDING)` instead of updating `Reservation`.
- Changed `cancelReservation` to create `ReservationCancellationRequest(PENDING)` instead of canceling `Reservation`.
- Added `approveReservationChangeRequest`.
- Added `rejectReservationChangeRequest`.
- Added `approveReservationCancellationRequest`.
- Added `rejectReservationCancellationRequest`.
- Added pending request policy: one reservation may have only one pending change/cancel request at a time.

## UI

- Planner Step4 reservation panel now uses one `예약 조정 요청` card with an internal change/cancel toggle.
- UI is unified as one reservation adjustment request card; implementation keeps change/cancel actions separated.
- Planner UI shows vendor approval waiting state when a pending change/cancel request exists.
- Vendor dashboard now includes a `변경/취소` panel for pending reservation change/cancel requests.
- Vendor dashboard can approve or reject each pending change/cancel request.
- Existing final confirmation and confirmed reservation panels remain in place.

## Validation Log

- `npm run db:generate`: PASS.
- `npx prisma migrate reset --force`: PASS.
- `npx tsx scripts/verify-reservation-change-cancel.ts`: PASS. Core paths now call server actions directly.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- `git status`: modified reservation-flow files plus new migration/script; no commit created.
- `npm run build` did not hit Google Fonts fetch timeout.

## Manual QA Notes

- Not manually browser-tested in this run.
- `scripts/verify-reservation-change-cancel.ts` validates core server action paths:
  - `requestChange` creates change requests.
  - `cancelReservation` creates cancellation requests.
  - pending request policy blocks second change/cancel requests.
  - `approveReservationChangeRequest` mutates reservation.
  - `rejectReservationChangeRequest` keeps reservation unchanged.
  - `approveReservationCancellationRequest` sets reservation `CANCELED`.
  - `rejectReservationCancellationRequest` keeps reservation unchanged.

## Merge Risks

- Reservation schema changes may conflict with settlement branch if both attach new relations to Reservation.
- Keep model names and action names explicit.
- Vendor dashboard contract now carries pending change/cancel request counts and arrays.
- Planner and vendor UI both depend on pending request relation includes; future reservation queries should include those relations when they render request state.
