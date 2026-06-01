import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventStatus,
  PrismaClient,
  QuoteStatus,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";
import { declinePendingQuoteRequest } from "../lib/quote-request-decline";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

type CreatedIds = {
  planId: string;
  requestId: string;
};

const created: CreatedIds = {
  planId: "",
  requestId: ""
};

async function main() {
  const planner = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.planner }
  });

  const [vendor, seedPlan] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        email: demoAccountCredentials.venue,
        role: UserRole.VENDOR,
        vendorApprovalStatus: VendorApprovalStatus.APPROVED,
        isActive: true
      }
    }),
    prisma.eventPlan.findFirstOrThrow({
      where: {
        ownerId: planner.id,
        type: "WEDDING"
      }
    })
  ]);

  const selectedModules = await prisma.vendorServiceModule.findMany({
    where: { vendorId: vendor.id, isActive: true },
    orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }],
    take: 2
  });

  assert.ok(selectedModules.length > 0, "vendor modules must exist; run npm run db:seed first");

  const runId = Date.now();

  const plan = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "Quote decline contract",
      slug: `quote-decline-contract-${runId}`,
      type: "WEDDING",
      status: EventStatus.ACTIVE,
      region: seedPlan.region ?? "서울",
      scheduledAt: seedPlan.scheduledAt,
      guestTarget: seedPlan.guestTarget ?? 80,
      budget: seedPlan.budget ?? 5_000_000
    }
  });
  created.planId = plan.id;

  const request = await prisma.quoteRequest.create({
    data: {
      planId: plan.id,
      vendorId: vendor.id,
      requirements: "일정 가능 여부를 먼저 확인해주세요.",
      selectedModules: selectedModules.map((module) => module.id),
      preferredDate: plan.scheduledAt,
      budget: plan.budget,
      status: QuoteStatus.PENDING
    }
  });
  created.requestId = request.id;

  await prisma.$transaction((tx) =>
    declinePendingQuoteRequest(tx, {
      requestId: request.id,
      vendorId: vendor.id,
      reason: "해당 날짜에는 이미 진행 일정이 있습니다."
    })
  );

  const [declinedRequest, responseCount, reservationCount, notification, activity] =
    await Promise.all([
      prisma.quoteRequest.findUniqueOrThrow({
        where: { id: request.id }
      }),
      prisma.quoteResponse.count({
        where: { requestId: request.id }
      }),
      prisma.reservation.count({
        where: { quoteRequestId: request.id }
      }),
      prisma.notification.findFirst({
        where: {
          userId: planner.id,
          type: "QUOTE_REQUEST_DECLINED",
          href: `/plans/${plan.id}`
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.activityLog.findFirst({
        where: {
          quoteRequestId: request.id,
          type: "QUOTE_REQUEST_DECLINED"
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

  assert.equal(declinedRequest.status, QuoteStatus.CANCELED);
  assert.equal(responseCount, 0, "declined canonical requests must not create QuoteResponse");
  assert.equal(reservationCount, 0, "declined canonical requests must not create Reservation");
  assert.ok(notification, "planner must receive decline notification");
  assert.ok(activity, "decline activity log must be recorded");

  console.log("verify-quote-decline-contract: ok");
}

main()
  .catch((error) => {
    console.error("verify-quote-decline-contract: failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (created.requestId) {
      await prisma.activityLog.deleteMany({
        where: { quoteRequestId: created.requestId }
      });
      await prisma.quoteRequest.deleteMany({
        where: { id: created.requestId }
      });
    }

    if (created.planId) {
      await prisma.notification.deleteMany({
        where: { href: `/plans/${created.planId}` }
      });
      await prisma.eventPlan.deleteMany({
        where: { id: created.planId }
      });
    }

    await prisma.$disconnect();
  });
