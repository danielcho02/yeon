# yeON PM Development Roadmap

> Last updated: 2026-06-03
> Current branch: `codex/proposal-adjustment-flow`

---

## Implemented Use-Case Coverage

yeON currently supports the core demo lifecycle for wedding/funeral planning:

- Planner creates or selects a plan and sends vendor quote requests from Step 3.
- QuoteRequest(PENDING) is created without a Reservation.
- Vendor can decline a pending request or submit one final proposal total.
- QuoteRequest(RESPONDED) shows the proposal to the planner without creating a Reservation.
- Planner accepts a QuoteResponse, creating Reservation(PENDING) for the first time.
- Vendor confirms the accepted reservation from the final confirmation panel.
- Reservation(CONFIRMED) is visible to planner and vendor.
- Package-backed requests preserve package snapshot, price snapshot, selected package options, vendor-specific add-ons, final proposal total, and proposal memo through the accepted/confirmed reservation surfaces.
- Planner can request one simple proposal adjustment with a target total and memo before accepting; vendor can accept that target or submit a different revised proposal total/memo without creating a Reservation.

---

## Current Branch Scope

`codex/proposal-adjustment-flow` is scoped to U09 simple proposal adjustment:

- Planner Step 4 adds `제안 수락` and `조정 요청` choices after a vendor proposal arrives.
- Planner Step 4 keeps the adjustment waiting state visible, separates proposal summary/revision history/reservation progress into internal panels, and renders revision history directly in the `조율 내역` panel.
- Planner adjustment requests store a target total and memo and create no Reservation.
- Vendor dashboard writes initial proposals only from `새 요청` pending quote requests; `견적 응답` is limited to state summaries, planner adjustment detail, target acceptance, and alternate revised proposal actions.
- Vendor dashboard shows the planner adjustment memo, requested total, previous proposal, difference, and package estimate before accepting the requested total or submitting a different revised proposal; submitted/revised quotes then move to a read-only planner-acceptance waiting state.
- Vendor final confirmation and confirmed reservation panels are separated: final approval lives in pending confirmation card footers, while confirmed reservations stay compact with optional collapsed package context.
- Revised proposal acceptance creates Reservation(PENDING) using the accepted revision amount.
- Package snapshots and reservation continuity remain preserved through existing QuoteRequest JSON snapshots.
- Wedding/funeral event-date domain modeling is deferred to a separate branch.

Do not expand this branch into real-time chat, complex negotiation threads, broad visual redesign, notification center work, or account/profile management.

---

## Deferred UX Polish

These are polish items unless they block a core use case:

- Broader Step 4 layout refinement.
- Package summary visual hierarchy and spacing improvements.
- Vendor confirmed schedule card polish.
- Additional empty-state copy tuning.
- Mobile layout refinement beyond basic usability.

---

## Next Development Priorities

1. **U06 reservation change/cancel flow**
   - Clarify planner/vendor change and cancellation responsibilities after Reservation(PENDING/CONFIRMED).
   - Preserve workflow history and user-facing status copy.

2. **U08 mobile invitation/obituary prototype**
   - Add a minimal mobile-first shareable invitation/obituary prototype.
   - Keep it scoped to MVP publishing and viewing.

3. **U07 event money ledger / settlement**
   - Track event-related money entries and basic settlement summaries.
   - Avoid payment processing until the ledger use case is validated.

---

## Later Items

- **U01/U02/U03 real signup/auth/admin approval**
  - Replace demo-first assumptions with production-grade onboarding, verification, and admin approval flows.

- **Vendor profile/account management**
  - Let vendors manage company information, contact details, and operating profile data.

- **Notification center**
  - Centralize workflow notifications after the core status surfaces are stable.

- **Community/review/Q&A**
  - Add public/community interaction only after planning, quote, reservation, and account flows are stronger.

---

## PM Rules

- Keep branches scoped to one core use case or one continuity gap.
- Avoid broad UX polish unless it blocks understanding or completion of a core use case.
- Prisma schema changes require a plan first and must be justified by missing persisted capability.
- Prefer existing JSON snapshots and DTO extensions before adding schema fields.
- Update `STATUS.md` and `docs/PM_DEVELOPMENT_ROADMAP.md` after major feature passes.
- Validation must cover the canonical workflow: QuoteRequest(PENDING) -> QuoteResponse/RESPONDED -> accept -> Reservation(PENDING) -> confirm -> Reservation(CONFIRMED).
