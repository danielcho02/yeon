# yeON Project Status

> Last updated: 2026-05-31
> Branch: `codex/next-product-stabilization`
> Current focus: Step 4 proposal/reservation IA stabilization

---

## What Was Just Implemented

The **canonical quote workflow fix** was implemented on this branch. Changes enforce the correct
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

**These changes are staged and ready to commit — not yet committed.**

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
| VendorServiceModule | 15    | 6 venue, 4 floral (inactive vendor), 5 funeral         |
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

State B has **no Reservation** — this is the canonical state. The workspace must auto-navigate
to Step 4 based on quoteRequestsData RESPONDED detection (not Reservation existence).

General-user Step 4 is a **proposal → reservation workflow** screen:

- Before accept: selected modules, vendor proposal, amount, response message, and explicit no-Reservation-yet state.
- After accept: Reservation(PENDING), accepted proposal summary, and vendor final confirmation due date.
- After vendor confirm: Reservation(CONFIRMED) and final reservation summary.
- Step 4 detail panels should follow the same module workflow model. Category-lane status is internal/supporting detail only.

Step 3 package/module rules:

- Base package included items are shown in the included-spec area and must not reappear as optional adjustment rows.
- Additional selection rows are only for non-included modules.

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

Scenario seed validation (optional, run after scenario seed):
```bash
npm run db:seed:scenario:C
npx tsx scripts/verify-demo-scenario.ts --state=C
```

### Last Known Validation Results (pre-commit, 2026-05-31)

All 7 verify scripts + tsc + lint + build were passing on the previous commit (84756d4).
The canonical workflow changes (unstaged/staged diff) need a final validation run before commit.

---

## Remaining Browser QA Before Commit

These items require manual browser testing against `npm run dev`:

1. **Fresh seed Step 3 landing**: `npm run db:seed` → login planner → `/planner/wedding` → confirm Step 3 active, "보낸 요청 현황" empty
2. **No Reservation after request**: Submit quote request → DB check: 1 QuoteRequest(PENDING), 0 Reservations
3. **State B auto-navigate**: After vendor responds (State B seed), planner opens workspace → confirm workspace auto-jumps to Step 4 without manual click
4. **Reservation created at accept**: Click "이 견적 수락하기" → DB check: Reservation(PENDING) now exists for the first time; `vendorConfirmationDueAt` set
5. **No 503 on Step 3 submit**: Open network tab → submit quote → no 503 on `POST /api/planning/recommendation`
6. **Step refresh persistence**: Refresh `/planner/wedding?planId=...&step=3` and `step=4` → confirm step maintained
7. **Vendor confirm flow**: vendor logs in → "예약 최종 확정" → Reservation(CONFIRMED) → planner sees "예약 확정 완료"

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

**Not yet** — browser QA items listed above must be verified first.
Once browser QA passes, run the full validation suite, then commit.
