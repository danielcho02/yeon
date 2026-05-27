import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  Prisma,
  PrismaClient,
  QuoteStatus,
  ReservationStatus
} from "../generated/prisma/client";
import {
  demoAccountCredentials
} from "../lib/demo/ensure-demo-data";
import {
  assertQuoteTransition,
  assertReservationTransition
} from "../lib/state-machine";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db"
  })
});

type CreatedIds = {
  requestId: string;
  responseId: string;
  reservationId: string;
  duplicateReservationId: string;
};

const created: CreatedIds = {
  requestId: "",
  responseId: "",
  reservationId: "",
  duplicateReservationId: ""
};

function stringify(value: unknown) {
  return JSON.stringify(value, (_key, item) => (
    typeof item === "bigint" ? Number(item) : item
  ), 2);
}

async function expectReject(label: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch {
    return;
  }

  throw new Error(`${label} should have failed`);
}

async function canVendorConfirmReservation(reservationId: string, vendorId: string) {
  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { id: reservationId, vendorId },
    include: {
      quoteRequest: true
    }
  });

  if (reservation.quoteRequest && reservation.quoteRequest.status !== QuoteStatus.ACCEPTED) {
    throw new Error("QUOTE_NOT_ACCEPTED");
  }

  assertReservationTransition(
    reservation.status === ReservationStatus.CONFIRMED ? "CONFIRMED" : "PENDING",
    "CONFIRMED"
  );

  return prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.CONFIRMED,
      confirmedAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0
    }
  });
}

async function main() {
  const checks: Record<string, boolean | string | number> = {};

  const [planner, vendor] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.planner }
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.venue }
    })
  ]);

  const plan = await prisma.eventPlan.findFirstOrThrow({
    where: { ownerId: planner.id, type: "WEDDING" }
  });

  const modules = await prisma.vendorServiceModule.findMany({
    where: { vendorId: vendor.id, isActive: true },
    orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }],
    take: 2
  });

  assert.ok(modules.length > 0, "vendor modules must exist; run npx prisma db seed first");

  const selectedModules = modules.map((module) => module.id);
  const quotedAmount = modules.reduce((sum, module) => sum + module.price, 0);

  const createdRequest = await prisma.$transaction(async (tx) => {
    const quoteRequest = await tx.quoteRequest.create({
      data: {
        planId: plan.id,
        vendorId: vendor.id,
        requirements: "Backend smoke verification request",
        selectedModules,
        preferredDate: plan.scheduledAt,
        budget: quotedAmount,
        status: QuoteStatus.PENDING
      }
    });

    const reservation = await tx.reservation.create({
      data: {
        eventPlanId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: quoteRequest.id,
        serviceName: "Backend smoke verification",
        serviceCategory: String(modules[0].category),
        serviceDate: plan.scheduledAt,
        guestCount: plan.guestTarget,
        quotedAmount,
        confirmedAmount: null,
        selectedServiceOptions: modules.map((module) => ({
          catalogKey: module.id,
          name: module.name,
          price: module.price,
          pricingType: "FLAT"
        })) as Prisma.InputJsonValue,
        status: ReservationStatus.PENDING,
        notes: "Backend smoke verification request"
      }
    });

    return { quoteRequest, reservation };
  });

  created.requestId = createdRequest.quoteRequest.id;
  created.reservationId = createdRequest.reservation.id;

  checks.quote_request_created = createdRequest.quoteRequest.status === QuoteStatus.PENDING;
  checks.placeholder_created = createdRequest.reservation.quoteRequestId === created.requestId;

  await expectReject("duplicate placeholder reservation", async () => {
    const duplicate = await prisma.reservation.create({
      data: {
        eventPlanId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: created.requestId,
        serviceName: "Duplicate placeholder should fail",
        status: ReservationStatus.PENDING
      }
    });
    created.duplicateReservationId = duplicate.id;
  });
  checks.duplicate_placeholder_rejected = true;

  const vendorDashboardInbox = await prisma.reservation.findMany({
    where: {
      vendorId: vendor.id,
      status: ReservationStatus.PENDING,
      confirmedAmount: null,
      quoteRequestId: created.requestId
    }
  });
  checks.vendor_dashboard_inbox_count = vendorDashboardInbox.length;
  assert.equal(vendorDashboardInbox.length, 1);

  const vendorQuoteRequests = await prisma.quoteRequest.findMany({
    where: {
      vendorId: vendor.id,
      id: created.requestId
    }
  });
  checks.vendor_quote_request_count = vendorQuoteRequests.length;
  assert.equal(vendorQuoteRequests.length, 1);

  await expectReject("confirm before user accepts quote", async () => {
    await canVendorConfirmReservation(created.reservationId, vendor.id);
  });
  checks.confirm_before_accept_rejected = true;

  assertQuoteTransition("PENDING", "RESPONDED");
  const quoteResponse = await prisma.$transaction(async (tx) => {
    const response = await tx.quoteResponse.create({
      data: {
        requestId: created.requestId,
        vendorId: vendor.id,
        basePrice: quotedAmount,
        modules: {
          basePackage: {
            name: "Backend smoke response",
            price: quotedAmount,
            description: "Backend smoke verification response"
          },
          includedModules: [],
          optionalModules: [],
          excludedModules: []
        },
        totalPrice: quotedAmount,
        note: "Backend smoke verification response"
      }
    });

    await tx.quoteRequest.update({
      where: { id: created.requestId },
      data: { status: QuoteStatus.RESPONDED }
    });

    await tx.reservation.update({
      where: { id: created.reservationId },
      data: {
        quoteResponseId: response.id,
        quotedAmount,
        confirmedAmount: quotedAmount
      }
    });

    return response;
  });

  created.responseId = quoteResponse.id;

  const afterVendorResponse = await prisma.quoteRequest.findUniqueOrThrow({
    where: { id: created.requestId },
    include: {
      responses: true,
      reservation: true
    }
  });

  checks.quote_response_created = afterVendorResponse.responses.length === 1;
  checks.quote_request_responded = afterVendorResponse.status === QuoteStatus.RESPONDED;
  checks.reservation_quote_response_linked =
    afterVendorResponse.reservation?.quoteResponseId === created.responseId;
  checks.reservation_amounts_synced =
    afterVendorResponse.reservation?.confirmedAmount === quotedAmount &&
    afterVendorResponse.reservation?.quotedAmount === quotedAmount;

  assert.equal(afterVendorResponse.status, QuoteStatus.RESPONDED);
  assert.equal(afterVendorResponse.responses.length, 1);
  assert.equal(afterVendorResponse.reservation?.quoteResponseId, created.responseId);

  await expectReject("duplicate reservation for quote response", async () => {
    const duplicate = await prisma.reservation.create({
      data: {
        eventPlanId: plan.id,
        vendorId: vendor.id,
        quoteResponseId: created.responseId,
        serviceName: "Duplicate quote response reservation should fail",
        status: ReservationStatus.PENDING
      }
    });
    created.duplicateReservationId = duplicate.id;
  });
  checks.duplicate_quote_response_reservation_rejected = true;

  await expectReject("duplicate quote response for request/vendor", async () => {
    await prisma.quoteResponse.create({
      data: {
        requestId: created.requestId,
        vendorId: vendor.id,
        basePrice: quotedAmount,
        modules: {
          basePackage: {
            name: "Duplicate response should fail",
            price: quotedAmount,
            description: "Duplicate response should fail"
          },
          includedModules: [],
          optionalModules: [],
          excludedModules: []
        },
        totalPrice: quotedAmount,
        note: "Duplicate response should fail"
      }
    });
  });
  checks.duplicate_quote_response_rejected = true;

  const getQuotesByPlanShape = await prisma.quoteRequest.findMany({
    where: { planId: plan.id, id: created.requestId },
    include: {
      responses: {
        include: { vendor: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  checks.get_quotes_by_plan_has_responded_quote =
    getQuotesByPlanShape[0]?.status === QuoteStatus.RESPONDED &&
    getQuotesByPlanShape[0]?.responses[0]?.id === created.responseId;

  const planDashboardShapeBeforeAccept = await prisma.eventPlan.findFirstOrThrow({
    where: { id: plan.id, ownerId: planner.id },
    include: {
      quoteRequests: {
        where: { id: created.requestId },
        include: {
          responses: { include: { reservation: true } },
          reservation: true
        }
      }
    }
  });
  checks.plan_dashboard_sees_response =
    planDashboardShapeBeforeAccept.quoteRequests[0]?.responses[0]?.id === created.responseId;
  checks.placeholder_not_confirmed_before_accept =
    planDashboardShapeBeforeAccept.quoteRequests[0]?.reservation?.status === ReservationStatus.PENDING &&
    planDashboardShapeBeforeAccept.quoteRequests[0]?.status === QuoteStatus.RESPONDED;

  assertQuoteTransition("RESPONDED", "ACCEPTED");
  const reservationCountBeforeAccept = await prisma.reservation.count({
    where: { quoteRequestId: created.requestId }
  });

  await prisma.$transaction(async (tx) => {
    await tx.quoteRequest.update({
      where: { id: created.requestId },
      data: { status: QuoteStatus.ACCEPTED }
    });

    await tx.reservation.update({
      where: { id: created.reservationId },
      data: {
        quoteResponseId: created.responseId,
        status: ReservationStatus.PENDING,
        confirmedAmount: quotedAmount
      }
    });
  });

  const reservationCountAfterAccept = await prisma.reservation.count({
    where: { quoteRequestId: created.requestId }
  });
  const afterAccept = await prisma.quoteRequest.findUniqueOrThrow({
    where: { id: created.requestId },
    include: { reservation: true }
  });

  checks.quote_request_accepted = afterAccept.status === QuoteStatus.ACCEPTED;
  checks.placeholder_reused_on_accept = reservationCountBeforeAccept === 1 && reservationCountAfterAccept === 1;
  checks.next_action_after_accept =
    afterAccept.status === QuoteStatus.ACCEPTED &&
    afterAccept.reservation?.status === ReservationStatus.PENDING
      ? "reservation_pending"
      : "unexpected";

  assert.equal(reservationCountAfterAccept, 1);

  await canVendorConfirmReservation(created.reservationId, vendor.id);

  const afterConfirm = await prisma.eventPlan.findFirstOrThrow({
    where: { id: plan.id, ownerId: planner.id },
    include: {
      quoteRequests: {
        where: { id: created.requestId },
        include: { reservation: true }
      }
    }
  });
  checks.confirmed_visible_in_plan_dashboard =
    afterConfirm.quoteRequests[0]?.reservation?.status === ReservationStatus.CONFIRMED;

  await expectReject("cancel confirmed reservation", async () => {
    assertReservationTransition("CONFIRMED", "CANCELED");
    assertReservationTransition("CANCELED", "CONFIRMED");
  });
  checks.invalid_retransition_rejected = true;

  console.log("[verify-quote-flow] success");
  console.log(stringify(checks));
}

main()
  .catch((error) => {
    console.error("[verify-quote-flow] failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (created.duplicateReservationId) {
      await prisma.reservation.deleteMany({
        where: { id: created.duplicateReservationId }
      });
    }
    if (created.reservationId) {
      await prisma.reservation.deleteMany({
        where: { id: created.reservationId }
      });
    }
    if (created.responseId) {
      await prisma.quoteResponse.deleteMany({
        where: { id: created.responseId }
      });
    }
    if (created.requestId) {
      await prisma.quoteRequest.deleteMany({
        where: { id: created.requestId }
      });
    }
    await prisma.$disconnect();
  });
