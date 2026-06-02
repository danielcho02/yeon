# yeON PM Development Roadmap

> Last updated: 2026-06-03
> Current branch: `codex/event-date-domain-model`

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
- Wedding quote requests support either an exact fixed wedding date or a preferred date range.
- Vendor proposals persist a proposed service date on `QuoteProposalRevision`; accepted reservations copy that date into `Reservation.serviceDate`.
- Funeral planning uses the occurrence/reception date as the service start date and displays the derived 3-day funeral schedule.

---

## Current Branch Scope

`codex/event-date-domain-model` is scoped to wedding/funeral event-date modeling:

- Wedding planner request UX separates exact fixed dates from preferred date ranges.
- Wedding vendors confirm a fixed date or choose one date inside the requested range; casual fixed-date changes are rejected server-side.
- Funeral planner UX avoids broad date ranges and defaults new funeral dates to today.
- Funeral surfaces show Day 1 빈소/접수, Day 2 조문/의전 진행, Day 3 발인/장지 이동 from the reception/start date.
- `QuoteRequest` stores request-level exact/range date intent.
- `QuoteProposalRevision` stores vendor proposal-level service date.
- `Reservation.serviceDate` remains the final accepted service date.
- Generic `일정 불가 회신` is removed from visible vendor UI, but backend decline verification remains.
- U09 proposal adjustment, package snapshots, and reservation continuity remain preserved.

Do not expand this branch into real-time chat, complex negotiation threads, full calendar availability, event-type-specific decline redesign, notification center work, or account/profile management.

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

4. **Event-specific availability responses**
   - Replace the backend-only quote decline path with wedding/funeral-specific availability response UX.
   - Keep the existing decline contract until the new response model is explicitly verified.

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
