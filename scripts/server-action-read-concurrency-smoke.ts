import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  PrismaClient,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";
import { buildVendorDashboardReservationContract } from "../lib/vendor-dashboard-contract";
import type { VendorDashboardReservationDTO } from "../types/reservation";

function createClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
      timeout: 10000
    })
  });
}

function mapReservation(row: Awaited<ReturnType<typeof readVendorReservations>>[number]): VendorDashboardReservationDTO {
  return {
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
  };
}

async function readVendorReservations(client: PrismaClient, vendorId: string) {
  return client.reservation.findMany({
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
}

async function readPlannerBootstrap(
  client: PrismaClient,
  ownerId: string,
  eventType: "WEDDING" | "FUNERAL"
) {
  const [plans, vendors, reservations] = await Promise.all([
    client.eventPlan.findMany({
      where: { ownerId, type: eventType },
      select: { id: true, title: true, type: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" }
    }),
    client.user.findMany({
      where: {
        role: UserRole.VENDOR,
        vendorApprovalStatus: VendorApprovalStatus.APPROVED,
        isActive: true
      },
      select: { id: true, name: true, supportedEventTypes: true },
      orderBy: { createdAt: "asc" }
    }),
    client.reservation.findMany({
      where: { eventPlan: { ownerId, type: eventType } },
      select: { id: true, status: true, quoteRequestId: true, quoteResponseId: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const selectedPlan = plans[0] ?? null;
  const selectedVendor = vendors[0] ?? null;
  const [vendorModules, quoteRequests] = await Promise.all([
    selectedVendor
      ? client.vendorServiceModule.findMany({
          where: { vendorId: selectedVendor.id, isActive: true },
          select: { id: true, category: true, price: true, pricingType: true },
          orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
        })
      : Promise.resolve([]),
    selectedPlan
      ? client.quoteRequest.findMany({
          where: { planId: selectedPlan.id },
          select: { id: true, status: true, vendorId: true },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  return { plans, vendors, reservations, vendorModules, quoteRequests };
}

async function readVendorContract(client: PrismaClient, vendorId: string) {
  const reservations = await readVendorReservations(client, vendorId);
  return buildVendorDashboardReservationContract(reservations.map(mapReservation));
}

async function main() {
  const clients = Array.from({ length: 4 }, createClient);
  const primary = clients[0];

  try {
    await Promise.all(
      clients.map((client) => client.$executeRawUnsafe("PRAGMA busy_timeout = 10000"))
    );

    const [planner, venue] = await Promise.all([
      primary.user.findUnique({ where: { email: demoAccountCredentials.planner } }),
      primary.user.findUnique({ where: { email: demoAccountCredentials.venue } })
    ]);

    assert.ok(planner, "planner demo account is missing");
    assert.ok(venue, "venue demo account is missing");

    const tasks = Array.from({ length: 24 }, (_item, index) => {
      const client = clients[index % clients.length];
      return Promise.all([
        readPlannerBootstrap(client, planner.id, "WEDDING"),
        readPlannerBootstrap(client, planner.id, "FUNERAL"),
        readVendorContract(client, venue.id)
      ]);
    });

    const results = await Promise.all(tasks);
    for (const [weddingBootstrap, funeralBootstrap, vendorContract] of results) {
      assert.ok(weddingBootstrap.plans.length >= 0);
      assert.ok(weddingBootstrap.vendorModules.length >= 0);
      assert.ok(weddingBootstrap.quoteRequests.length >= 0);
      assert.ok(funeralBootstrap.plans.length >= 0);
      assert.ok(funeralBootstrap.vendorModules.length >= 0);
      assert.ok(funeralBootstrap.quoteRequests.length >= 0);
      assert.ok(vendorContract.counts.newRequestsCount >= 0);
      assert.ok(vendorContract.counts.pendingConfirmationsCount >= 0);
      assert.ok(vendorContract.counts.confirmedReservationsCount >= 0);
      assert.ok(vendorContract.counts.respondedQuotesCount >= 0);
    }

    console.log("[server-action-read-concurrency-smoke] success");
    console.log(JSON.stringify({
      clients: clients.length,
      concurrentReadBatches: tasks.length
    }, null, 2));
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
  }
}

main().catch((error) => {
  console.error("[server-action-read-concurrency-smoke] failed");
  console.error(error);
  process.exitCode = 1;
});
