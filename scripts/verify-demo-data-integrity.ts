import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../generated/prisma/client";
import { ensureDemoData } from "../lib/demo/ensure-demo-data";
import { buildVendorDashboardReservationContract } from "../lib/vendor-dashboard-contract";
import type { VendorDashboardReservationDTO } from "../types/reservation";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

type Counts = {
  reservations: number;
  quoteRequests: number;
  quoteResponses: number;
};

async function readCounts(): Promise<Counts> {
  const [reservations, quoteRequests, quoteResponses] = await Promise.all([
    prisma.reservation.count(),
    prisma.quoteRequest.count(),
    prisma.quoteResponse.count()
  ]);

  return { reservations, quoteRequests, quoteResponses };
}

function assertStableCounts(label: string, expected: Counts, actual: Counts) {
  assert.deepEqual(
    actual,
    expected,
    `${label}: ensureDemoData must not inject legacy reservations or mutate quote workflow counts`
  );
}

async function readVendorContract(vendorId: string) {
  const rows = await prisma.reservation.findMany({
    where: { vendorId },
    select: {
      id: true,
      serviceName: true,
      serviceCategory: true,
      serviceDate: true,
      guestCount: true,
      quotedAmount: true,
      confirmedAmount: true,
      vendorConfirmationDueAt: true,
      notes: true,
      status: true,
      quoteRequestId: true,
      quoteResponseId: true,
      quoteRequest: {
        select: {
          status: true,
          requirements: true
        }
      },
      quoteResponse: {
        select: {
          note: true
        }
      },
      selectedServiceOptions: true,
      eventPlan: {
        select: {
          id: true,
          title: true,
          type: true,
          region: true,
          scheduledAt: true,
          hostName: true,
          honoreeName: true
        }
      },
      vendor: {
        select: {
          id: true,
          name: true,
          companyName: true,
          location: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return buildVendorDashboardReservationContract(
    rows.map((row): VendorDashboardReservationDTO => ({
      id: row.id,
      serviceName: row.serviceName,
      serviceCategory: row.serviceCategory,
      serviceDate: row.serviceDate?.toISOString() ?? null,
      guestCount: row.guestCount,
      quotedAmount: row.quotedAmount,
      confirmedAmount: row.confirmedAmount,
      vendorConfirmationDueAt: row.vendorConfirmationDueAt?.toISOString() ?? null,
      notes: row.notes,
      requestMemo: row.quoteRequest?.requirements ?? row.notes,
      responseMessage: row.quoteResponse?.note ?? null,
      status: row.status,
      quoteRequestId: row.quoteRequestId,
      quoteResponseId: row.quoteResponseId,
      quoteRequestStatus: row.quoteRequest?.status ?? null,
      selectedServiceOptions: null,
      eventPlan: {
        id: row.eventPlan.id,
        title: row.eventPlan.title,
        type: row.eventPlan.type ?? undefined,
        region: row.eventPlan.region,
        scheduledAt: row.eventPlan.scheduledAt?.toISOString() ?? null,
        hostName: row.eventPlan.hostName,
        honoreeName: row.eventPlan.honoreeName
      },
      vendor: {
        id: row.vendor.id,
        name: row.vendor.name,
        companyName: row.vendor.companyName,
        location: row.vendor.location
      }
    }))
  );
}

async function assertVendorContractIgnoresLegacyPendingRows() {
  const vendors = await prisma.user.findMany({
    where: { role: "VENDOR", isActive: true },
    select: { id: true, email: true }
  });

  for (const vendor of vendors) {
    const contract = await readVendorContract(vendor.id);

    for (const reservation of contract.newQuoteRequests) {
      assert.ok(
        reservation.quoteRequestId,
        `${vendor.email}: new quote request bucket must not include reservations without quoteRequestId`
      );
      assert.equal(
        reservation.quoteResponseId,
        null,
        `${vendor.email}: new quote request bucket must not include quote responses`
      );
    }

    for (const reservation of contract.pendingConfirmations) {
      assert.equal(
        reservation.quoteRequestStatus,
        "ACCEPTED",
        `${vendor.email}: pending confirmations must be accepted quote requests only`
      );
      assert.ok(
        reservation.quoteRequestId,
        `${vendor.email}: pending confirmations must be quote workflow reservations`
      );
    }
  }
}

async function assertPlansAndStep4UseSameWorkflowScenario() {
  const plans = await prisma.eventPlan.findMany({
    where: { type: { in: ["WEDDING", "FUNERAL"] } },
    include: {
      quoteRequests: {
        include: {
          reservation: true,
          responses: true
        }
      },
      reservations: true
    }
  });

  for (const plan of plans) {
    const workflowReservationIds = new Set(
      plan.quoteRequests
        .map((request) => request.reservation?.id)
        .filter((id): id is string => Boolean(id))
    );
    const nonWorkflowReservations = plan.reservations.filter(
      (reservation) => !workflowReservationIds.has(reservation.id)
    );

    assert.equal(
      nonWorkflowReservations.length,
      0,
      `${plan.slug}: Step 4 must not receive legacy reservations outside the quote workflow`
    );
  }
}

async function assertVendorModulesExist() {
  const total = await prisma.vendorServiceModule.count();
  assert.ok(total >= 10, `Expected ≥10 VendorServiceModules after seed, got ${total}`);
}

async function main() {
  const baseline = await readCounts();

  assert.deepEqual(
    baseline,
    { reservations: 0, quoteRequests: 0, quoteResponses: 0 },
    "verify-demo-data-integrity: expects clean npm run db:seed baseline"
  );

  await assertVendorModulesExist();
  await assertVendorContractIgnoresLegacyPendingRows();
  await assertPlansAndStep4UseSameWorkflowScenario();

  await ensureDemoData(prisma);
  assertStableCounts("first ensureDemoData call", baseline, await readCounts());

  await ensureDemoData(prisma);
  assertStableCounts("second ensureDemoData call", baseline, await readCounts());

  await assertVendorContractIgnoresLegacyPendingRows();
  await assertPlansAndStep4UseSameWorkflowScenario();

  console.log("[verify-demo-data-integrity] success");
  console.log(JSON.stringify({ baseline }, null, 2));
}

main()
  .catch((error) => {
    console.error("[verify-demo-data-integrity] failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
