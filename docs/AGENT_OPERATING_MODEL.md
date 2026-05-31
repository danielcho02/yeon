# yeON Agent Operating Model

> Effective from: 2026-05-31
> Branch: codex/step3-main-logic-rewrite

## Core Principle

All implementation agents working on yeON are full-stack by default.

yeON defects are tightly coupled across DB seed state, Prisma domain contracts,
server actions, planner UI, vendor dashboard, validation scripts, and browser QA.
The prior split (Claude=frontend, Codex=backend) caused incomplete fixes.

---

## Rules

1. **Audit first, implement second.** Read all affected layers before writing any code.
2. **Full-stack responsibility.** Every agent may inspect and modify:
   - Backend: server actions, Prisma queries, domain contracts
   - Frontend: workspace components, page data fetching, UI state
   - Seed/demo: `prisma/seed.ts`, `scripts/seed-demo-scenario.ts`
   - Validation: all `verify-*.ts` and `*-smoke.ts` scripts
   - Documentation: `STATUS.md`, `docs/`
3. **No blind UI polish.** Do not change UI copy or visuals without checking domain contracts first.
4. **No backend patches without UX validation.** Every backend change must be traced to its planner/vendor browser impact.
5. **No push without user approval.** Always stop before push and ask.
6. **No specialist vendors in core demo.** Only core 3-role model unless product fully supports multi-vendor flows.
7. **No Reservation before accept.** The canonical workflow is the law.

---

## Canonical Quote Workflow

```
createQuoteRequest  → QuoteRequest(PENDING) + notification + activity    [NO Reservation]
submitQuoteResponse → QuoteRequest(RESPONDED) + QuoteResponse            [NO Reservation]
acceptQuoteResponse → QuoteRequest(ACCEPTED) + Reservation(PENDING)      [Reservation created HERE]
confirmReservation  → Reservation(CONFIRMED)
```

Never create a Reservation in `createQuoteRequest`. Never skip Reservation creation in
`acceptQuoteResponse`. Any deviation from this contract is a bug.

---

## Clean Seed Baseline

Default `npm run db:seed` must produce:

- QuoteRequests: 0
- QuoteResponses: 0
- Reservations: 0

Planner lands on Step 3 (vendors) ready to send their first request.

---

## Scenario Seeds

| Command | State | QuoteRequest | QuoteResponse | Reservation |
|---------|-------|-------------|---------------|-------------|
| `db:seed:scenario:A` | Requested | PENDING | — | — |
| `db:seed:scenario:B` | Responded | RESPONDED | exists | — (canonical) |
| `db:seed:scenario:C` | Accepted | ACCEPTED | exists | PENDING |
| `db:seed:scenario:D` | Confirmed | ACCEPTED | exists | CONFIRMED |

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

---

## Demo Accounts

| Account | Password | Role |
|---------|----------|------|
| planner@yeon.local | demo1234 | GENERAL (planner) |
| venue@yeon.local | demo1234 | VENDOR (모먼트 가든, WEDDING) |
| memorial@yeon.local | demo1234 | VENDOR (한결 의전, FUNERAL) |
| catering@yeon.local | demo1234 | VENDOR (오르세 플로럴, isActive: false — inactive) |

---

## 3-Role Core Model

yeON's demo is built on exactly 3 active roles:

1. **Planner** (`planner@yeon.local`) — organizes wedding and funeral events
2. **Wedding vendor** (`venue@yeon.local`) — 모먼트 가든, serves WEDDING plans
3. **Funeral vendor** (`memorial@yeon.local`) — 한결 의전, serves FUNERAL plans

`catering@yeon.local` (오르세 플로럴) is intentionally `isActive: false`. Do not
reactivate it as a core demo participant unless the specialist vendor UX is fully built.

---

## Historical Context

Prior to 2026-05-31, agents were split:

- Claude Code = frontend/UI only
- Codex = backend/domain only
- AGY = full-stack auditor

This split caused defects where a change in one layer was not validated against the other.
The canonical workflow fix (PR: codex/step3-main-logic-rewrite) resolved the accumulated
domain contract debt. Future agents must not reintroduce role splits.

See the historical session logs in `docs/Claude_STATUS.md`, `docs/Codex_STATUS.md`,
`docs/AGY_FULLSTACK_STATUS.md`, and `docs/claude_agy_STATUS.md` for the full audit trail.
