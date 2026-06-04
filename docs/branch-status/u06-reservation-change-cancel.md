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

- Not started.

## Validation Log

Pending.

## Manual QA Notes

Pending.

## Merge Risks

- Reservation schema changes may conflict with settlement branch if both attach new relations to Reservation.
- Keep model names and action names explicit.
