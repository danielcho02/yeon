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

## Current Status

- Not started.

## Validation Log

Pending.

## Manual QA Notes

Pending.

## Merge Risks

- Transaction model may overlap with existing payment/transaction files.
- Avoid renaming existing transaction contracts unless required.
