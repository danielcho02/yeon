# Plan: Canonical Quote Workflow, Seed Reset & Demo Stabilization

## Summary
Four interlocked changes that restore the yeON domain model to its canonical shape and make the
default localhost demo runnable from scratch. (1) Remove the Reservation placeholder that
`createQuoteRequest` currently creates — Reservation must only be created when the planner accepts
a QuoteResponse. (2) Fix the workspace step-navigation logic so RESPONDED QuoteRequests (which have
no Reservation) correctly route the planner to Step 4. (3) Reset the default seed to 0 quote
workflow records. (4) Add a per-state scenario seed and matching verification script.

## User Story
As a demo user (planner@yeon.local) on a fresh localhost,
I want to open the wedding workspace at Step 3, send my first quote request, see the vendor respond,
accept the quote, watch a Reservation be created, and then see the vendor confirm,
so that I experience the full canonical workflow in one session without any pre-seeded state.

## Canonical Workflow (authoritative)

```
createQuoteRequest  → QuoteRequest(PENDING)          + notification + activity log
                                                       NO Reservation
submitQuoteResponse → QuoteRequest(RESPONDED)        + QuoteResponse
                                                       NO Reservation
acceptQuoteResponse → QuoteRequest(ACCEPTED)         + Reservation(PENDING) CREATED HERE
                                                       vendorConfirmationDueAt set
confirmReservation  → Reservation(CONFIRMED)         + confirmedAmount set
```

## Problem → Solution

### Problem 1 — Reservation placeholder violates domain contract
`createQuoteRequest` creates a `Reservation(PENDING)` before any vendor has responded or the
planner has made a decision. This is semantically wrong: a Reservation represents a committed
slot, not a pending request.

**Solution**: Remove the `tx.reservation.create()` call from `createQuoteRequest`. Keep the
notification and activity log. Preserve the existing UPDATE branch in `acceptQuoteResponse`
for backward-compatibility with any legacy data; the CREATE branch (already at line 806) is
now the primary path.

### Problem 2 — Step navigation depends on Reservations, blocking State B UX
`planStateInitialStep` in the workspace uses `planReservations` exclusively. In State B (vendor
responded, no Reservation yet), `planReservations = []` → workspace stays on Step 3. The planner
cannot reach Step 4 without manual stepper navigation even though a responded quote exists.

**Solution**: After removing the placeholder, extend `planStateInitialStep` to also check
`quoteRequestsData` (client-side) for RESPONDED or ACCEPTED status. Pre-load `quoteRequestsData`
server-side via `initialQuoteRequestsByPlanId` to avoid the async flicker.

Step-state decision table (new):
| Condition | Step |
|---|---|
| No plan | setup (1) |
| Plan, no aiRecommendation | ai (2) |
| Plan + aiRecommendation, QuoteRequests all PENDING | vendors (3) |
| Any QuoteRequest RESPONDED or ACCEPTED | booking (4) |
| Any Reservation CONFIRMED | booking (4) |

### Problem 3 — Default seed produces late-stage demo state
`seedModularQuoteData()` creates QuoteRequests, QuoteResponses, and Reservations. On a fresh
localhost the planner opens Step 4 with pre-filled quote state.

**Solution**: Rewrite `seedModularQuoteData()` to create VendorServiceModules only (0 QuoteRequests,
0 QuoteResponses, 0 Reservations).

### Problem 4 — Inactive vendor data leaks into workspace props
Page-level `prisma.reservation.findMany()` in `wedding/page.tsx` and `funeral/page.tsx` has no
`vendor: { isActive: true }` guard. Even after the seed is cleaned, this query could return
inactive-vendor Reservations from previous scenario seeds and cause split-brain Step 4.

**Solution**: Add `vendor: { isActive: true }` to reservation `findMany` where clause in both page
files.

### Problem 5 — verify-quote-flow.ts encodes the placeholder pattern
The smoke test manually creates a `Reservation` in the same transaction as `QuoteRequest` (line 643)
and asserts `checks.placeholder_created` (line 701). After removing the placeholder from
`createQuoteRequest`, the smoke test must be updated to match the canonical flow.

**Solution**: Remove the manual Reservation creation from the smoke test setup transaction.
Update the test to verify that `acceptQuoteResponse` creates the Reservation (testing the CREATE
branch at line 806). Rename or remove `checks.placeholder_created`.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 9
  - `app/actions/quote.ts` — remove Reservation from `createQuoteRequest`
  - `components/features/planning/event-planning-workspace.tsx` — fix `planStateInitialStep`
  - `app/planner/wedding/page.tsx` — add vendor.isActive filter; pre-load quoteRequests
  - `app/planner/funeral/page.tsx` — same
  - `prisma/seed.ts` — remove all quote workflow data from default seed
  - `scripts/verify-demo-data-integrity.ts` — update baseline to 0/0/0
  - `scripts/verify-quote-flow.ts` — remove placeholder assumption, add canonical flow assertions
  - `scripts/seed-demo-scenario.ts` — new, 4-state scenario seed
  - `scripts/verify-demo-scenario.ts` — new, validates scenario seed states
  - `package.json` — add scenario seed scripts

---

## 1. Default Seed Design

After `npm run db:seed`, the DB contains:

| Table | Count | Notes |
|---|---|---|
| User | 6 | planner, venue, catering (isActive:false), memorial, guest, admin |
| EventPlan | 2 | spring-garden-wedding (WEDDING+aiRecommendation), family-funeral-guidance (FUNERAL+aiRecommendation) |
| VendorServiceModule | 15 | 6 venue, 4 floral (inactive vendor), 5 funeral |
| VendorService | ~18 | legacy catalog, unchanged |
| Post | 2 | unchanged |
| Invitation | 3 | unchanged |
| **QuoteRequest** | **0** | |
| **QuoteResponse** | **0** | |
| **Reservation** | **0** | |

Workspace opens at Step 3 (`planStateInitialStep = "vendors"` — plan exists + aiRecommendation
exists + 0 QuoteRequests). First action the planner takes is sending a quote request.

---

## 2. Scenario Seed Design — Four Canonical States

`scripts/seed-demo-scenario.ts` accepts `--state=A|B|C|D`. Default: C.

| State | QuoteRequest | QuoteResponse | Reservation | Description |
|---|---|---|---|---|
| A | PENDING | — | — | Planner sent request; vendor not yet responded |
| B | RESPONDED | exists | **none** | Vendor responded; planner has not accepted |
| C | ACCEPTED | exists | PENDING | Planner accepted; vendor must confirm |
| D | ACCEPTED | exists | CONFIRMED | Fully confirmed booking |

**State A** creates: `QuoteRequest(PENDING)` for venueVendor + funeralVendor. No QuoteResponse, no Reservation.

**State B** creates: `QuoteRequest(RESPONDED)` + `QuoteResponse` for each active vendor. **No Reservation** — canonical.

**State C** creates: all of B, plus `QuoteRequest(ACCEPTED)` + `Reservation(PENDING)` with `quoteRequestId`, `quoteResponseId`, `vendorConfirmationDueAt = plusDays(2)`.

**State D** creates: all of C with `Reservation.status = CONFIRMED`.

Each state creation is idempotent (guarded by `findFirst` for existing active QuoteRequest).

```json
"db:seed:scenario":   "npx tsx scripts/seed-demo-scenario.ts",
"db:seed:scenario:A": "npx tsx scripts/seed-demo-scenario.ts --state=A",
"db:seed:scenario:B": "npx tsx scripts/seed-demo-scenario.ts --state=B",
"db:seed:scenario:C": "npx tsx scripts/seed-demo-scenario.ts --state=C",
"db:seed:scenario:D": "npx tsx scripts/seed-demo-scenario.ts --state=D"
```

---

## 3. Reservation Timing — Domain Contract (Resolved)

**Decision**: `createQuoteRequest` creates only `QuoteRequest(PENDING)` + notification + activity.
No Reservation. The `tx.reservation.create()` block is removed.

**`acceptQuoteResponse` (line 780) already handles both paths correctly**:
```typescript
const existingReservation = response.reservation ?? response.request.reservation;
const reservation = existingReservation
  ? await tx.reservation.update({...})   // legacy path — backward compat
  : await tx.reservation.create({...});  // canonical path — primary after this change
```
The CREATE branch (line 806) becomes the default path. No change needed to `acceptQuoteResponse`
other than verifying `vendorConfirmationDueAt` is set (it is — line 768).

---

## 4. Step Navigation Fix

### Current (broken for State B without Reservation)
```typescript
const planStateInitialStep = useMemo(() => {
  if (!plan) return "setup";
  if (pendingRequests.length > 0) return "vendors";  // needs Reservation
  if (proposals.length > 0 || ...) return "booking"; // needs Reservation
  if (!plan.aiRecommendation) return "ai";
  return "vendors";
}, [plan, pendingRequests, proposals, pendingFinalConfirmations, confirmedRes]);
```

### Fixed (uses quoteRequestsData for RESPONDED/ACCEPTED detection)
```typescript
const planStateInitialStep = useMemo(() => {
  if (!plan) return "setup";
  // PENDING requests: planner is waiting → stay on Step 3
  if (pendingRequests.length > 0) return "vendors";
  // Reservation-based: ACCEPTED+Reservation or CONFIRMED
  if (proposals.length > 0 || pendingFinalConfirmations.length > 0 || confirmedRes.length > 0) {
    return "booking";
  }
  // QuoteRequest-based: RESPONDED (no Reservation yet) → guide to Step 4
  if ((quoteRequestsData ?? []).some(r => r.status === "RESPONDED" || r.status === "ACCEPTED")) {
    return "booking";
  }
  if (!plan.aiRecommendation) return "ai";
  return "vendors";
}, [plan, pendingRequests, proposals, pendingFinalConfirmations, confirmedRes, quoteRequestsData]);
```

**Flicker prevention**: `quoteRequestsData` starts as null and loads asynchronously. The
`initialQuoteRequestsByPlanId` prop (already threaded through the page → workspace) pre-loads
the data server-side. On initial render, if `initialQuoteRequestsByPlanId` has data for the plan,
`quoteRequestsData` is initialized from it and `planStateInitialStep` resolves immediately.

Verify the server-side pre-load in `wedding/page.tsx` (lines 163–172) already fetches
`initialQuoteRequestsByPlanId` and passes it to the workspace. It does — no additional server
change is needed for this.

### Step 3 status items (no change needed)
`requestStatusItems` already uses `quoteRequestsData` as primary source (when not null).
State B correctly shows "견적 도착" badge for the RESPONDED request.

### Step 4 accept / post-accept messaging (no change needed)
`handleAcceptQuote` → `acceptQuoteResponse` → creates Reservation → `refreshQuoteRequests(planId)`
triggers re-render → `quoteRequestsData` updates → `requestStatusItems` shows "업체 최종 확정 대기".
The `vendorConfirmationDueAt` date is set by `getVendorConfirmationDueAt()` (line 768) and
surfaced in the helper text at workspace line 413.

---

## 5. Step 3 POST 503 Investigation

**Risk A — `POST /api/planning/recommendation` has no outer try/catch**: If `prisma.eventPlan.create`
throws P2002 (slug collision), the unhandled error returns 500/503. Add try/catch wrapping the
entire POST handler body with a 500 fallback. The pre-seeded plans have unique slugs so this only
fires on user-created duplicate-title plans.

**Risk B — `createQuoteRequest` SQLite WAL contention**: After removing the Reservation, the
transaction is now smaller (3 writes: QuoteRequest + Notification + ActivityLog instead of 4).
This reduces lock hold time. With `PRAGMA busy_timeout = 10000` and WAL mode, this should be fine.

**Risk C — ModularQuoteBuilder submit enabled before modules load**: Verify the submit button is
disabled when `vendorModules === null`. If not, guard it.

---

## 6. Validation Script Changes

### `verify-demo-data-integrity.ts` — clean seed only

**Change 1**: Baseline assertion (line ~43):
```typescript
assert.deepEqual(baseline, { reservations: 0, quoteRequests: 0, quoteResponses: 0 },
  "verify-demo-data-integrity: expects clean npm run db:seed baseline"
);
```

**Change 2**: Remove `assertAcceptedQuotePendingReservationsHaveDueAtOrSeedFallback()` — asserts
`acceptedPending.length > 0`, impossible with 0 Reservations.

**Change 3**: Add `assertVendorModulesExist()` — checks `vendorServiceModule.count() >= 10`.

**This script is NOT expected to pass after `db:seed:scenario` runs.** That is intentional.

### `verify-quote-flow.ts` — significant update required

**Current problem**: The smoke test setup (lines 630–693) creates a QuoteRequest + Reservation
manually in one transaction, then checks `checks.placeholder_created` (line 701). This encodes
the old placeholder pattern that is being removed from the action.

**Required changes**:
1. Remove `tx.reservation.create(...)` from the setup transaction (lines 643–666)
2. Remove `created.reservationId` tracking from setup (line 696)
3. Remove `checks.placeholder_created` assertion (line 701)
4. After the smoke test calls `acceptQuoteResponse` (later in the test), add assertions that:
   - `Reservation.quoteRequestId === created.requestId`
   - `Reservation.quoteResponseId === created.responseId`
   - `Reservation.status === "PENDING"`
   - `Reservation.vendorConfirmationDueAt` is non-null
5. The `canVendorConfirmReservation` function (line 363) reads the Reservation by id. Since
   `created.reservationId` is now set at accept time (not setup time), find the Reservation after
   accept: `prisma.reservation.findFirst({ where: { quoteRequestId: created.requestId } })`.
6. Update `created.reservationId` to be set after the accept step, not during setup.

### `verify-demo-scenario.ts` — new script

Validates the optional scenario seed. Accepts `--state=A|B|C|D`.

| State | Expected counts | Key assertions |
|---|---|---|
| A | qr=2, qresp=0, res=0 | All QuoteRequests PENDING; no Reservations |
| B | qr=2, qresp=2, res=0 | All QuoteRequests RESPONDED; no Reservations |
| C | qr=2, qresp=2, res=2 | QuoteRequests ACCEPTED; Reservations PENDING with both IDs set and vendorConfirmationDueAt non-null |
| D | qr=2, qresp=2, res=2 | Same as C; Reservations CONFIRMED |

Additional invariant for C and D: every `Reservation.quoteRequestId` → QuoteRequest.status = ACCEPTED;
every `Reservation.quoteResponseId` is non-null. No Reservation without a QuoteResponse.

---

## 7. Browser QA Flow (from fresh seed)

```
npm run db:seed   →  0 QuoteRequests, 0 QuoteResponses, 0 Reservations
npm run dev
```

1. Login `planner@yeon.local / demo1234` → `/planner` → redirects to `/planner/wedding`
2. **Expect**: Step 3 active; 모먼트 가든 modules loaded; "보낸 요청 현황" empty
3. Select modules → click "견적 요청 보내기"
4. **Expect**: No 503; "견적 요청을 보냈습니다" notice; "업체 응답 대기" badge appears
5. **DB check**: 1 QuoteRequest(PENDING), 0 QuoteResponses, **0 Reservations**
6. Logout → Login `venue@yeon.local / demo1234` → `/vendor/dashboard`
7. **Expect**: "새 요청" inbox shows the request
8. Submit quote response
9. **DB check**: QuoteRequest(RESPONDED), QuoteResponse exists, **still 0 Reservations**
10. Logout → Login `planner@yeon.local / demo1234` → `/planner/wedding`
11. **Expect**: `planStateInitialStep = "booking"` (RESPONDED detected via quoteRequestsData)
12. **Expect**: Step 4 shows 모먼트 가든 quote with "이 견적 수락하기" button
13. Click "이 견적 수락하기"
14. **Expect**: Confetti; "업체의 최종 확정을 기다리는 중" notice
15. **DB check**: QuoteRequest(ACCEPTED), **Reservation(PENDING) now created**, `vendorConfirmationDueAt` set
16. **Expect**: Step 4 status changes to "업체 최종 확정 대기" with date
17. Logout → Login `venue@yeon.local / demo1234` → `/vendor/dashboard`
18. **Expect**: "최종 확정" panel shows accepted reservation
19. Click "예약 최종 확정"
20. **DB check**: Reservation(CONFIRMED)
21. Logout → Login `planner@yeon.local / demo1234` → `/planner/wedding`
22. **Expect**: Step 4 shows "예약 확정 완료" (emerald badge)

Funeral plan follows the same flow with memorial@yeon.local.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `app/actions/quote.ts` | 331–527 | `createQuoteRequest` — remove Reservation creation |
| P0 | `app/actions/quote.ts` | 693–860 | `acceptQuoteResponse` — verify it creates Reservation when none exists; verify `vendorConfirmationDueAt` |
| P0 | `components/features/planning/event-planning-workspace.tsx` | 239–267 | `planStateInitialStep` memo — add quoteRequestsData check |
| P0 | `components/features/planning/event-planning-workspace.tsx` | 270–285 | `quoteRequestsData` state initialization from `initialQuoteRequestsByPlanId` |
| P0 | `scripts/verify-quote-flow.ts` | 630–701 | Smoke test setup transaction — remove Reservation creation |
| P0 | `prisma/seed.ts` | 74–497 | `seedModularQuoteData()` — remove all quote workflow data |
| P0 | `scripts/verify-demo-data-integrity.ts` | all | Hardcoded baseline counts — must update |
| P1 | `app/planner/wedding/page.tsx` | 122–175 | Reservation query + `initialQuoteRequestsByPlanId` pre-load |
| P1 | `app/planner/funeral/page.tsx` | ~122–175 | Same |
| P1 | `app/api/planning/recommendation/route.ts` | all | No outer try/catch |
| P2 | `lib/demo/ensure-demo-data.ts` | all | Confirms floralVendor isActive:false; plans upserted with aiRecommendation |

---

## Patterns to Mirror

### CREATE_QUOTE_REQUEST_WITHOUT_RESERVATION
```typescript
// SOURCE: app/actions/quote.ts:446 (current — remove the reservation block)
const request = await prisma.$transaction(async (tx) => {
  const created = await tx.quoteRequest.create({ data: { planId, vendorId, ... } });
  // REMOVE: tx.reservation.create(...)
  await createWorkflowNotification(tx, { userId: vendor.id, ... });
  await createWorkflowActivity(tx, { actorId: user.id, ... });
  return created;
});
```

### ACCEPT_CREATES_RESERVATION_CANONICAL
```typescript
// SOURCE: app/actions/quote.ts:780 (existing — this is already correct)
const existingReservation = response.reservation ?? response.request.reservation;
const reservation = existingReservation
  ? await tx.reservation.update({...})    // backward-compat path
  : await tx.reservation.create({         // CANONICAL path — now primary
      data: {
        eventPlanId: response.request.planId,
        vendorId: response.vendorId,
        quoteRequestId: response.requestId,
        quoteResponseId: response.id,
        ...
        vendorConfirmationDueAt,           // getVendorConfirmationDueAt() line 768
      }
    });
```

### STEP_NAVIGATION_WITH_QUOTE_DATA
```typescript
// New pattern in event-planning-workspace.tsx
const planStateInitialStep = useMemo(() => {
  if (!plan) return "setup";
  if (pendingRequests.length > 0) return "vendors";
  if (proposals.length > 0 || pendingFinalConfirmations.length > 0 || confirmedRes.length > 0) return "booking";
  if ((quoteRequestsData ?? []).some(r => r.status === "RESPONDED" || r.status === "ACCEPTED")) return "booking";
  if (!plan.aiRecommendation) return "ai";
  return "vendors";
}, [plan, pendingRequests, proposals, pendingFinalConfirmations, confirmedRes, quoteRequestsData]);
```

### PAGE_RESERVATION_FILTER
```typescript
// SOURCE: app/planner/wedding/page.tsx:122
where: {
  eventPlan: { ownerId: session.user.id, type: "WEDDING" },
  vendor: { isActive: true }   // ADD
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `app/actions/quote.ts` | UPDATE | Remove `tx.reservation.create()` from `createQuoteRequest` |
| `components/features/planning/event-planning-workspace.tsx` | UPDATE | Fix `planStateInitialStep` — add quoteRequestsData RESPONDED check |
| `app/planner/wedding/page.tsx` | UPDATE | Add `vendor: { isActive: true }` to reservation query |
| `app/planner/funeral/page.tsx` | UPDATE | Same |
| `prisma/seed.ts` | UPDATE | Remove all QuoteRequest/Response/Reservation from `seedModularQuoteData()` |
| `scripts/verify-demo-data-integrity.ts` | UPDATE | Baseline 0/0/0; remove accepted-pending assertion; add module count check |
| `scripts/verify-quote-flow.ts` | UPDATE | Remove Reservation from setup transaction; test canonical accept path |
| `scripts/seed-demo-scenario.ts` | CREATE | 4-state scenario seed (A/B/C/D) |
| `scripts/verify-demo-scenario.ts` | CREATE | Validates scenario seed per state |
| `package.json` | UPDATE | Add `db:seed:scenario` and per-state scripts |
| `app/api/planning/recommendation/route.ts` | UPDATE (if 503 confirmed) | Outer try/catch |

## NOT Building
- New UI components or pages
- Prisma schema or migration changes
- Changes to vendor dashboard, vendor workspace
- THEMES consolidation
- Admin UI for VendorServiceModule management
- Multi-vendor comparison or policy decisions

---

## Step-by-Step Tasks

### Task 1: Remove Reservation placeholder from `createQuoteRequest`

- **ACTION**: Edit `app/actions/quote.ts`, function `createQuoteRequest` (line 446)
- **IMPLEMENT**: Inside `prisma.$transaction(async (tx) => { ... })`:
  1. Remove the entire `const reservation = await tx.reservation.create({...})` block (lines ~459–478)
  2. Remove `reservationId: reservation.id` from the `createWorkflowActivity` call (line ~502)
  3. The notification and activity log remain; only the Reservation creation is removed
  4. The function return value is still just `created` (the QuoteRequest)
- **MIRROR**: CREATE_QUOTE_REQUEST_WITHOUT_RESERVATION
- **GOTCHA**: `createWorkflowActivity` currently passes `reservationId: reservation.id`. After removing the Reservation, pass `reservationId: undefined` or omit the field. Check the `createWorkflowActivity` signature to confirm the field is optional.
- **GOTCHA 2**: The `buildRequestServiceName(modules)` and `buildReservationOptions(modules, guestCount)` helpers were only used by the Reservation block. Remove them from this call site. Verify they are not used elsewhere in `createQuoteRequest`.
- **VALIDATE**: `npx tsc --noEmit` produces 0 errors. Run `npx tsx scripts/verify-quote-flow.ts` after Task 5.

### Task 2: Fix `planStateInitialStep` in workspace

- **ACTION**: Edit `components/features/planning/event-planning-workspace.tsx` (lines ~248–266)
- **IMPLEMENT**: Replace the `planStateInitialStep` useMemo body with the STEP_NAVIGATION_WITH_QUOTE_DATA pattern. Add `quoteRequestsData` to the dependency array.
- **MIRROR**: STEP_NAVIGATION_WITH_QUOTE_DATA
- **GOTCHA**: `quoteRequestsData` is `QuoteRequestWithResponses[] | null`. Check `(quoteRequestsData ?? []).some(...)` guards the null case. The `r.status` field is a string from the DTO; confirm it matches `"RESPONDED"` and `"ACCEPTED"` exactly.
- **GOTCHA 2**: The `resolvedInitialStep` memo (line ~258) depends on `planStateInitialStep`. Verify the dependency chain is correct after adding `quoteRequestsData` to `planStateInitialStep`'s deps.
- **VALIDATE**: Load `/planner/wedding` with State B scenario active → workspace auto-opens Step 4. Load with State A → workspace stays on Step 3.

### Task 3: Add vendor.isActive filter to page reservation queries

- **ACTION**: Edit `app/planner/wedding/page.tsx` and `app/planner/funeral/page.tsx`
- **IMPLEMENT**: In `prisma.reservation.findMany()`, add `vendor: { isActive: true }` to the where clause alongside `eventPlan: { ownerId, type }`.
- **MIRROR**: PAGE_RESERVATION_FILTER
- **GOTCHA**: Funeral page uses `type: "FUNERAL"` — don't copy-paste the wedding `type: "WEDDING"` value.
- **VALIDATE**: `npx tsc --noEmit` passes.

### Task 4: Rewrite `seedModularQuoteData()` — modules only

- **ACTION**: Edit `prisma/seed.ts`
- **IMPLEMENT**:
  1. Rename function to `seedVendorModules()` (or keep name — either is fine)
  2. Keep: `prisma.vendorServiceModule.deleteMany()`
  3. Keep: all three `createVendorModules(vendorId, [...])` calls
  4. Remove everything from line ~264 to end of function:
     `venuePending`, `venueRes`, `floralAccepted`, `floralResponse`, `funeralCanceled`,
     `funeralResponded`, `funeralResponse`, `funeralRes`
  5. In `main()`: keep all `deleteMany()` calls at the top for idempotency
  6. Remove unused imports (`QuoteStatus`, `ReservationStatus`) if now unreferenced in seed.ts
- **GOTCHA**: `asJson` helper is used only in `seedModularQuoteData`. If it becomes unused after this edit, remove it.
- **VALIDATE**: `npm run db:seed` outputs `quoteRequests: 0, quoteResponses: 0, reservations: 0`.

### Task 5: Update `verify-quote-flow.ts` smoke test

- **ACTION**: Edit `scripts/verify-quote-flow.ts`
- **IMPLEMENT**:
  1. Remove `const reservation = await tx.reservation.create({...})` block from the setup transaction (lines 643–666)
  2. Remove `reservation` from the destructured return of the transaction
  3. Remove `created.reservationId = createdRequest.reservation.id` (line 696)
  4. Remove `checks.placeholder_created` assertion (line 701)
  5. After the `acceptQuoteResponse` step (later in the test), add assertions:
     ```typescript
     const newReservation = await prisma.reservation.findFirst({
       where: { quoteRequestId: created.requestId }
     });
     assert.ok(newReservation, "Reservation must be created at accept time");
     assert.equal(newReservation.quoteResponseId, created.responseId);
     assert.equal(newReservation.status, "PENDING");
     assert.ok(newReservation.vendorConfirmationDueAt, "vendorConfirmationDueAt must be set");
     created.reservationId = newReservation.id;
     ```
  6. The `canVendorConfirmReservation` function lookup by `reservationId` still works because
     `created.reservationId` is now set in step 5 above, before the confirm step.
- **MIRROR**: ACCEPT_CREATES_RESERVATION_CANONICAL
- **GOTCHA**: The `created.duplicateReservationId` field is set somewhere in the test for duplicate detection. If it references the old setup Reservation, update accordingly.
- **VALIDATE**: `npx tsx scripts/verify-quote-flow.ts` passes end-to-end.

### Task 6: Update `verify-demo-data-integrity.ts`

- **ACTION**: Edit `scripts/verify-demo-data-integrity.ts`
- **IMPLEMENT**:
  1. Baseline assertion: `{ reservations: 0, quoteRequests: 0, quoteResponses: 0 }`
  2. Remove `assertAcceptedQuotePendingReservationsHaveDueAtOrSeedFallback()` function and call
  3. Add `assertVendorModulesExist()`: `vendorServiceModule.count() >= 10`
  4. Update the `JSON.stringify({ baseline })` log at end of `main()`
- **VALIDATE**: `npx tsx scripts/verify-demo-data-integrity.ts` passes after `npm run db:seed`.

### Task 7: Create `scripts/seed-demo-scenario.ts`

- **ACTION**: Create new file
- **IMPLEMENT**:
  - Parse `--state=A|B|C|D` from `process.argv`; default to C
  - Read users, plans, modules from DB by known emails/slugs
  - For each state, create the appropriate records for both wedding and funeral plans
  - Each creation guarded by `findFirst` check for existing active QuoteRequest
  - Log final counts per state
  - State B: QuoteRequest(RESPONDED) + QuoteResponse, NO Reservation — canonical
  - State C: adds QuoteRequest(ACCEPTED) + Reservation(PENDING) with both IDs + `vendorConfirmationDueAt`
- **MIRROR**: SCENARIO_SEED_PATTERN, ACCEPT_CREATES_RESERVATION_CANONICAL (shape reference for Reservation fields)
- **GOTCHA**: venueModules indices: [0]=가든 예식홀 대관, [1]=신부 대기실, [2]=음향·조명 패키지. For QuoteResponse `includedModules` use [0] and [2] (isBaseIncluded:true); `optionalModules` use [1].
- **VALIDATE**: `npm run db:seed:scenario:C` exits 0 with `quoteRequests: 2, quoteResponses: 2, reservations: 2`.

### Task 8: Create `scripts/verify-demo-scenario.ts`

- **ACTION**: Create new file
- **IMPLEMENT**:
  - Parse `--state=A|B|C|D`
  - Assert counts per state (see Section 6 table)
  - State C/D additional invariants: every Reservation has non-null quoteResponseId; every Reservation.quoteRequestId → QuoteRequest.status = ACCEPTED; no Reservation without QuoteResponse
- **VALIDATE**: `npm run db:seed:scenario:C && npx tsx scripts/verify-demo-scenario.ts --state=C` passes.

### Task 9: Update `package.json`

- **ACTION**: Edit `package.json` scripts section
- **IMPLEMENT**: Add the 5 scenario seed scripts and 1 scenario verify script
- **VALIDATE**: All scripts resolvable via `npm run`.

### Task 10: Investigate and fix Step 3 POST 503 (conditional)

- **ACTION**: Manual investigation — `npm run db:seed && npm run dev` → Step 3 → submit request → inspect network tab
- **IMPLEMENT** (if 503 on `POST /api/planning/recommendation`): Wrap handler body in try/catch returning `Response.json({ error }, { status: 500 })` for general errors; 409 for P2002 slug collision.
- **VALIDATE**: No 503 errors on Step 3 request submission.

---

## Testing Strategy

### Automated
```bash
npm run db:seed
npx tsx scripts/verify-demo-data-integrity.ts   # 0/0/0 baseline
npx tsx scripts/verify-quote-flow.ts            # canonical accept path
npx tsx scripts/verify-service-category-contract.ts
npx tsx scripts/verify-planner-auth-redirect.ts
npx tsx scripts/verify-role-routing-contract.ts
npx tsc --noEmit
npm run lint
npm run build

npm run db:seed:scenario:C
npx tsx scripts/verify-demo-scenario.ts --state=C
```

### Manual browser QA
Follow Section 7 step-by-step. Critical DB checks at steps 5, 9, and 15 confirm the
Reservation is created exactly once, at accept time.

---

## Validation Commands

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
npm run db:seed:scenario:C
npx tsx scripts/verify-demo-scenario.ts --state=C
```

---

## Acceptance Criteria
- [ ] `createQuoteRequest` creates 0 Reservations
- [ ] `acceptQuoteResponse` creates Reservation(PENDING) — verified via verify-quote-flow.ts
- [ ] `npm run db:seed` → 0 QuoteRequests, 0 QuoteResponses, 0 Reservations
- [ ] planner@yeon.local lands on Step 3 on fresh seed
- [ ] After vendor responds (State B), workspace auto-navigates to Step 4 without manual click
- [ ] After planner accepts, Reservation appears for the first time
- [ ] Confetti on wedding accept; "업체 최종 확정 대기" with date shown
- [ ] After vendor confirms, Step 4 shows "예약 확정 완료"
- [ ] All 5 existing verify scripts pass
- [ ] `verify-demo-scenario.ts --state=C` passes
- [ ] 0 TypeScript errors, 0 lint warnings, build succeeds

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `verify-quote-flow.ts` `duplicateReservationId` references setup Reservation | Medium | Compile/runtime error in smoke test | Read the full smoke test before Task 5 and trace all `created.reservationId` usages |
| `createWorkflowActivity` requires `reservationId` as non-optional | Low | TypeScript error | Check the function signature; pass `undefined` or remove the field if optional |
| `planStateInitialStep` flicker — `quoteRequestsData` null on first render in State B | Medium | Workspace flashes Step 3 before settling on Step 4 | Confirm `initialQuoteRequestsByPlanId` is pre-loaded server-side; it already is per page.tsx lines 163–172 |
| `buildRequestServiceName` or `buildReservationOptions` called elsewhere after removal | Low | Compile error | grep the entire codebase for both helper names before deleting them from `createQuoteRequest` |
| Scenario seed State B created without Reservation — manual Step 4 navigation needed in older UI | N/A | N/A | Moot after Task 2 (step navigation fix); auto-navigation in State B is restored |

## Notes

### Why `verify-quote-flow.ts` must change
The smoke test bypasses the server action and creates the Reservation manually (line 643). After
the canonical change, this is no longer valid — the test would be asserting a code path that
no longer exists in production. Tests must mirror production behavior, not freeze it.

### Backward-compatibility of `acceptQuoteResponse`
The UPDATE branch (existing Reservation) in `acceptQuoteResponse` is preserved. Any legacy data
that has a Reservation placeholder from before this change will still work: `acceptQuoteResponse`
finds the existing Reservation and updates it. No migration needed.

### `pendingRequests` computation after canonical change
```typescript
const pendingRequests = useMemo(
  () => planReservations.filter((r) => r.status === "PENDING" && r.quoteResponseId == null),
  [planReservations]
);
```
After the canonical change, State A has 0 Reservations → `pendingRequests = []`. The workspace
uses `quoteRequestsData` to show "업체 응답 대기" in Step 3's requestStatusItems, which is
correct. The `pendingRequests` memo is no longer needed for step navigation (Task 2 removes
the dependency), but it can be kept for UI rendering elsewhere — verify nothing breaks.
