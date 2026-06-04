import assert from "node:assert/strict";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

const scenarioPlanSlugs = ["spring-garden-wedding", "family-funeral-guidance"];

function stringArrayFromJson(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getIncludedModuleIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const includedModules = (value as { includedModules?: unknown[] }).includedModules;
  if (!Array.isArray(includedModules)) return [];
  return includedModules
    .map((module) => {
      if (!module || typeof module !== "object") return null;
      const id = (module as { id?: unknown }).id;
      return typeof id === "string" ? id : null;
    })
    .filter((id): id is string => Boolean(id));
}

async function main() {
  const stateArg = process.argv.find(a => a.startsWith("--state="))?.replace("--state=", "") ?? "C";
  const state = stateArg.toUpperCase() as "A" | "B" | "C" | "D";

  const [eventPlanCount, scenarioPlanCount, qrCount, qrespCount, resCount] = await Promise.all([
    prisma.eventPlan.count(),
    prisma.eventPlan.count({ where: { slug: { in: scenarioPlanSlugs } } }),
    prisma.quoteRequest.count(),
    prisma.quoteResponse.count(),
    prisma.reservation.count()
  ]);

  assert.equal(eventPlanCount, 2, `State ${state}: expected scenario-only 2 EventPlans, got ${eventPlanCount}`);
  assert.equal(scenarioPlanCount, 2, `State ${state}: expected 2 scenario EventPlans, got ${scenarioPlanCount}`);

  if (state === "A") {
    assert.equal(qrCount, 2, `State A: expected 2 QuoteRequests, got ${qrCount}`);
    assert.equal(qrespCount, 0, `State A: expected 0 QuoteResponses, got ${qrespCount}`);
    assert.equal(resCount, 0, `State A: expected 0 Reservations, got ${resCount}`);
    const allPending = await prisma.quoteRequest.findMany({ select: { status: true } });
    for (const qr of allPending) {
      assert.equal(qr.status, "PENDING", "State A: all QuoteRequests must be PENDING");
    }
  } else if (state === "B") {
    assert.equal(qrCount, 2, `State B: expected 2 QuoteRequests, got ${qrCount}`);
    assert.equal(qrespCount, 2, `State B: expected 2 QuoteResponses, got ${qrespCount}`);
    assert.equal(resCount, 0, `State B: expected 0 Reservations (canonical — no Reservation before accept), got ${resCount}`);
    const allResponded = await prisma.quoteRequest.findMany({
      include: {
        responses: {
          select: {
            id: true,
            modules: true
          }
        },
        reservation: true
      },
      orderBy: { createdAt: "asc" }
    });
    for (const qr of allResponded) {
      assert.equal(qr.status, "RESPONDED", "State B: all QuoteRequests must be RESPONDED");
      assert.equal(qr.responses.length, 1, "State B: each RESPONDED QuoteRequest must have exactly one QuoteResponse");
      assert.equal(qr.reservation, null, "State B: RESPONDED QuoteRequests must not have a Reservation before accept");
      const selectedModuleIds = stringArrayFromJson(qr.selectedModules);
      const includedModuleIds = getIncludedModuleIds(qr.responses[0]?.modules);
      assert.deepEqual(
        new Set(includedModuleIds),
        new Set(selectedModuleIds),
        "State B: QuoteResponse must preserve selected module identity before accept"
      );
    }
  } else if (state === "C" || state === "D") {
    assert.equal(qrCount, 2, `State ${state}: expected 2 QuoteRequests, got ${qrCount}`);
    assert.equal(qrespCount, 2, `State ${state}: expected 2 QuoteResponses, got ${qrespCount}`);
    assert.equal(resCount, 2, `State ${state}: expected 2 Reservations, got ${resCount}`);
    const reservations = await prisma.reservation.findMany({
      include: {
        quoteRequest: true,
        quoteResponse: {
          select: {
            modules: true
          }
        }
      }
    });
    for (const res of reservations) {
      assert.ok(res.quoteResponseId, `State ${state}: Reservation must have quoteResponseId`);
      assert.ok(res.quoteRequestId, `State ${state}: Reservation must have quoteRequestId`);
      assert.ok(res.vendorConfirmationDueAt, `State ${state}: Reservation must have vendorConfirmationDueAt`);
      assert.ok(
        Array.isArray(res.selectedServiceOptions) && res.selectedServiceOptions.length > 0,
        `State ${state}: Reservation must preserve selected module/options summary`
      );
      assert.equal(res.quoteRequest?.status, "ACCEPTED", `State ${state}: linked QuoteRequest must be ACCEPTED`);
      const selectedModuleIds = stringArrayFromJson(res.quoteRequest?.selectedModules ?? null);
      const includedModuleIds = getIncludedModuleIds(res.quoteResponse?.modules);
      assert.deepEqual(
        new Set(includedModuleIds),
        new Set(selectedModuleIds),
        `State ${state}: QuoteResponse must preserve selected module identity after accept`
      );
      if (state === "C") {
        assert.equal(res.status, "PENDING", `State C: Reservation must be PENDING`);
      } else {
        assert.equal(res.status, "CONFIRMED", `State D: Reservation must be CONFIRMED`);
      }
    }
  } else {
    throw new Error(`Unknown state: ${state}. Use A, B, C, or D.`);
  }

  console.log(`[verify-demo-scenario] State ${state}: PASS`);
}

main()
  .catch(err => { console.error(`[verify-demo-scenario] FAIL:`, err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
