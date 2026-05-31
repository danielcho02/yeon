# yeON Project Status

> Last updated: 2026-06-01
> Branch: `codex/next-product-stabilization`
> Current focus: planner entry flow + Step 3 request feedback + module-backed custom items

---

## What Was Just Implemented

The **canonical quote workflow baseline** is now the branch default. Changes enforce the correct
domain contract for the full QuoteRequest → QuoteResponse → Reservation lifecycle:

- `createQuoteRequest` now creates **only** QuoteRequest(PENDING) + notification + activity log.
  No Reservation is created at this step.
- `acceptQuoteResponse` creates Reservation(PENDING) for the first time.
- Default `npm run db:seed` produces **0 QuoteRequests, 0 QuoteResponses, 0 Reservations**.
- A 4-state scenario seed (`seed-demo-scenario.ts`) covers States A/B/C/D for targeted QA.
- `verify-demo-data-integrity.ts` updated to assert the 0/0/0 clean baseline.
- `verify-quote-flow.ts` updated to test the canonical accept-creates-Reservation path.
- `verify-demo-scenario.ts` (new) validates per-state scenario seed output.
- `package.json` gained `db:seed:scenario`, `db:seed:scenario:A/B/C/D` scripts.
- `/planner` is now a first-time entry router: existing planners are sent to `/plans`, while `/planner?create=1` always shows the event-type chooser.
- `/plans/new` is now a compatibility redirect into `/planner?create=1` or `/planner/{type}?create=1`; the flat generic form is no longer part of the main flow.
- Step 3 now keeps planners on the request screen after submit, locks duplicate active requests per vendor/plan with stable CTA feedback, and refreshes the sent-request panel in place.
- Vendor dashboard custom items now read/write `VendorServiceModule` so planner Step 3 sees vendor-added custom modules directly.
- Current package handling is a single derived package per vendor from active `isBaseIncluded` modules. True multi-package support remains deferred until a package schema exists.

---

## Canonical Quote Workflow

```
createQuoteRequest  → QuoteRequest(PENDING) + notification + activity    [NO Reservation]
submitQuoteResponse → QuoteRequest(RESPONDED) + QuoteResponse            [NO Reservation]
acceptQuoteResponse → QuoteRequest(ACCEPTED) + Reservation(PENDING)      [Reservation created HERE]
confirmReservation  → Reservation(CONFIRMED) + confirmedAmount set
```

Never create a Reservation in `createQuoteRequest`.
Never skip Reservation creation in `acceptQuoteResponse`.
Any deviation from this contract is a bug.

---

## Clean Seed Baseline

After `npm run db:seed`:

| Table               | Count | Notes                                                  |
|---------------------|-------|--------------------------------------------------------|
| User                | 6     | planner, venue, catering (isActive:false), memorial, guest, admin |
| EventPlan           | 2     | spring-garden-wedding (WEDDING), family-funeral-guidance (FUNERAL) |
| VendorServiceModule | 18    | 8 venue, 4 floral (inactive vendor), 6 funeral         |
| QuoteRequest        | **0** | clean baseline                                         |
| QuoteResponse       | **0** | clean baseline                                         |
| Reservation         | **0** | clean baseline                                         |

Planner lands on **Step 3** (vendors) ready to send their first request.

---

## Scenario Seeds

| Command                    | State     | QuoteRequest | QuoteResponse | Reservation       |
|----------------------------|-----------|-------------|---------------|-------------------|
| `npm run db:seed:scenario:A` | Requested | PENDING     | —             | — (none)          |
| `npm run db:seed:scenario:B` | Responded | RESPONDED   | exists        | — (canonical)     |
| `npm run db:seed:scenario:C` | Accepted  | ACCEPTED    | exists        | PENDING           |
| `npm run db:seed:scenario:D` | Confirmed | ACCEPTED    | exists        | CONFIRMED         |

State B has **no Reservation** — this is the canonical state. Treat it as a regression/dev
validation state for Step 4 routing and proposal visibility. The workspace must auto-navigate
to Step 4 based on quoteRequestsData RESPONDED detection (not Reservation existence).

General-user Step 4 is a **proposal → reservation workflow** screen:

- Before accept: selected modules, vendor proposal, amount, response message, and explicit "아직 예약 확정 전입니다" state.
- After accept: "업체 최종 확정 대기", accepted proposal summary, and vendor final confirmation due date.
- After vendor confirm: "예약 확정 완료" and final reservation summary.
- Step 4 detail panels should follow the same module workflow model. Category-lane status is internal validation data and should not render in the general-user UI.

Step 3 package/module rules:

- Base package included items are shown in the included-spec area and must not reappear as optional adjustment rows.
- Additional selection rows are only for active non-included modules.
- Standard catalog-backed modules, package-included modules, optional add-ons, and vendor-specific add-ons should be labeled distinctly. Vendor-specific add-ons are non-catalog vendor modules, not renamed standard essentials.

Vendor quote response framing:

- Vendor responses are a **single final total** over the selected module scope.
- Zero-priced included module entries inside `QuoteResponse.modules` are identity markers only and should not be shown to users as `0원` line items.

Category-level preparation status may remain as internal/collapsed detail, but it must not be the
primary user-facing Step 4 IA for the core integrated-vendor demo.

---

## Demo Accounts

| Account                | Password | Role                                                 |
|------------------------|----------|------------------------------------------------------|
| planner@yeon.local     | demo1234 | GENERAL (planner) — owns wedding + funeral plans     |
| venue@yeon.local       | demo1234 | VENDOR — 모먼트 가든 (WEDDING, isActive: true)         |
| memorial@yeon.local    | demo1234 | VENDOR — 한결 의전 (FUNERAL, isActive: true)           |
| catering@yeon.local    | demo1234 | VENDOR — 오르세 플로럴 (isActive: **false**, inactive) |

`catering@yeon.local` is intentionally excluded from the core 3-role demo.
Do not reactivate it unless the specialist-vendor UX is fully built.

---

## Validation Suite (must all pass before commit)

```bash
npm run db:seed
npx tsx scripts/verify-demo-data-integrity.ts
npx tsx scripts/verify-quote-flow.ts
npx tsx scripts/verify-service-category-contract.ts
npx tsx scripts/verify-planner-auth-redirect.ts
npx tsx scripts/verify-role-routing-contract.ts
npx tsc --noEmit
npm run lint
npm run build
```

Scenario seed validation (required after Step 4 routing or planner workflow changes):
```bash
npm run db:seed:scenario:B
npx tsx scripts/verify-demo-scenario.ts --state=B
```

### Last Known Validation Results

Run the full suite again after the current stabilization pass. State B should remain the default
workflow regression when Step 4 routing, planner entry, or quote-request visibility changes.

---

## Remaining Browser QA Before Commit

These items require manual browser testing against `npm run dev`:

1. **Fresh seed Step 3 landing**: `npm run db:seed` → login planner → `/planner/wedding` → confirm Step 3 active, "보낸 요청 현황" empty
2. **No Reservation after request**: Submit quote request → DB check: 1 QuoteRequest(PENDING), 0 Reservations
3. **State B auto-navigate when Step 4 routing/proposal rendering changes**: After vendor responds (State B seed), planner opens workspace → confirm workspace auto-jumps to Step 4 without manual click
4. **Reservation created at accept**: Click "이 견적 수락하기" → DB check: Reservation(PENDING) now exists for the first time; `vendorConfirmationDueAt` set
5. **No 503 on Step 3 submit**: Open network tab → submit quote → no 503 on `POST /api/planning/recommendation`
6. **Step refresh persistence**: Refresh `/planner/wedding?planId=...&step=3` and `step=4` → confirm step maintained
7. **Vendor confirm flow**: vendor logs in → "예약 최종 확정" → Reservation(CONFIRMED) → planner sees "예약 확정 완료"
8. **Planner return landing**: logged-in planner at `/` sees `/plans`-oriented primary CTA and partner CTA remains readable on desktop/mobile
9. **Entry-point IA**: `/planner` with existing plans redirects to `/plans`; zero-plan account sees event-type chooser; `/plans/new` no longer shows the flat generic form
10. **Custom module visibility**: vendor-added custom wedding/funeral modules appear in Step 3, optional customs are selectable, and base-included customs stay only in the included-spec area

---

## Tech Stack

- Next.js 14 App Router, TypeScript strict
- Tailwind CSS
- Prisma + SQLite (better-sqlite3)
- NextAuth v4 JWT
- Framer Motion, Lucide React
- WSL Linux environment

---

## Agent Operating Model

All agents working on yeON are **full-stack by default**.
See [`docs/AGENT_OPERATING_MODEL.md`](docs/AGENT_OPERATING_MODEL.md) for the complete rules.
The prior Claude=frontend / Codex=backend split is retired.

---

## Safe to Commit?

Run the validation suite and the browser QA items above after any additional edits.
