import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventStatus,
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
  planId: string;
  requestId: string;
  canceledRequestId: string;
  responseId: string;
  reservationId: string;
  duplicateReservationId: string;
  notificationIds: string[];
  activityLogIds: string[];
};

const created: CreatedIds = {
  planId: "",
  requestId: "",
  canceledRequestId: "",
  responseId: "",
  reservationId: "",
  duplicateReservationId: "",
  notificationIds: [],
  activityLogIds: []
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
      quoteRequest: true,
      eventPlan: {
        select: {
          id: true,
          ownerId: true,
          title: true
        }
      }
    }
  });

  if (reservation.quoteRequest && reservation.quoteRequest.status !== QuoteStatus.ACCEPTED) {
    throw new Error("QUOTE_NOT_ACCEPTED");
  }

  assertReservationTransition(
    reservation.status === ReservationStatus.CONFIRMED ? "CONFIRMED" : "PENDING",
    "CONFIRMED"
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        confirmedAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0,
        vendorConfirmationDueAt: null
      }
    });

    const notification = await tx.notification.create({
      data: {
        userId: reservation.eventPlan.ownerId,
        type: "RESERVATION_CONFIRMED",
        title: "예약이 최종 확정되었습니다",
        message: `${reservation.eventPlan.title} 예약이 업체에 의해 최종 확정되었습니다.`,
        href: `/plans/${reservation.eventPlanId}`,
        metadata: { script: "verify-quote-flow", reservationId: reservation.id }
      }
    });

    const activity = await tx.activityLog.create({
      data: {
        actorId: vendorId,
        planId: reservation.eventPlanId,
        vendorId,
        quoteRequestId: reservation.quoteRequestId,
        quoteResponseId: reservation.quoteResponseId,
        reservationId: reservation.id,
        type: "RESERVATION_CONFIRMED",
        message: "업체가 예약을 최종 확정했습니다.",
        metadata: { script: "verify-quote-flow" }
      }
    });

    return { updated, notification, activity };
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

  const seedPlan = await prisma.eventPlan.findFirstOrThrow({
    where: { ownerId: planner.id, type: "WEDDING" }
  });
  const runId = Date.now();
  const plan = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "Backend smoke quote flow",
      slug: `backend-smoke-quote-flow-${runId}`,
      type: "WEDDING",
      status: EventStatus.ACTIVE,
      scheduledAt: seedPlan.scheduledAt,
      guestTarget: seedPlan.guestTarget ?? 80,
      budget: seedPlan.budget ?? 1_000_000
    }
  });
  created.planId = plan.id;

  const modules = await prisma.vendorServiceModule.findMany({
    where: { vendorId: vendor.id, isActive: true },
    orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }],
    take: 2
  });

  assert.ok(modules.length > 0, "vendor modules must exist; run npx prisma db seed first");

  const selectedModules = modules.map((module) => module.id);
  const guestCount = plan.guestTarget ?? 80;
  const quotedAmount = modules.reduce(
    (sum, module) =>
      sum + (module.pricingType === "PER_GUEST" ? module.price * guestCount : module.price),
    0
  );

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
        guestCount,
        quotedAmount,
        confirmedAmount: null,
        selectedServiceOptions: modules.map((module) => ({
          catalogKey: module.id,
          name: module.name,
          price: module.price,
          pricingType: module.pricingType,
          ...(module.pricingType === "PER_GUEST"
            ? { quantity: guestCount, subtotal: module.price * guestCount }
            : {})
        })) as Prisma.InputJsonValue,
        status: ReservationStatus.PENDING,
        notes: "Backend smoke verification request"
      }
    });

    const notification = await tx.notification.create({
      data: {
        userId: vendor.id,
        type: "QUOTE_REQUEST_RECEIVED",
        title: "새 견적 요청",
        message: `${plan.title} 견적 요청이 도착했습니다.`,
        href: "/vendor/dashboard",
        metadata: { script: "verify-quote-flow", planId: plan.id, quoteRequestId: quoteRequest.id }
      }
    });

    const activity = await tx.activityLog.create({
      data: {
        actorId: planner.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: quoteRequest.id,
        reservationId: reservation.id,
        type: "QUOTE_REQUEST_CREATED",
        message: "일반 사용자가 업체에 견적 요청을 보냈습니다.",
        metadata: { script: "verify-quote-flow" }
      }
    });

    return { quoteRequest, reservation, notification, activity };
  });

  created.requestId = createdRequest.quoteRequest.id;
  created.reservationId = createdRequest.reservation.id;
  created.notificationIds.push(createdRequest.notification.id);
  created.activityLogIds.push(createdRequest.activity.id);

  checks.quote_request_created = createdRequest.quoteRequest.status === QuoteStatus.PENDING;
  checks.placeholder_created = createdRequest.reservation.quoteRequestId === created.requestId;

  await expectReject("duplicate active quote request for same plan/vendor", async () => {
    await prisma.quoteRequest.create({
      data: {
        planId: plan.id,
        vendorId: vendor.id,
        requirements: "Duplicate active request should fail",
        selectedModules,
        preferredDate: plan.scheduledAt,
        budget: quotedAmount,
        status: QuoteStatus.PENDING
      }
    });
  });
  checks.duplicate_active_quote_request_rejected = true;

  const canceledRequest = await prisma.quoteRequest.create({
    data: {
      planId: plan.id,
      vendorId: vendor.id,
      requirements: "Canceled request can coexist with active request",
      selectedModules,
      preferredDate: plan.scheduledAt,
      budget: quotedAmount,
      status: QuoteStatus.CANCELED
    }
  });
  created.canceledRequestId = canceledRequest.id;
  checks.canceled_quote_request_can_coexist_with_active =
    canceledRequest.status === QuoteStatus.CANCELED;

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
      quoteResponseId: null,
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
  const quoteResponseResult = await prisma.$transaction(async (tx) => {
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
        confirmedAmount: null
      }
    });

    const notification = await tx.notification.create({
      data: {
        userId: planner.id,
        type: "QUOTE_RESPONSE_RECEIVED",
        title: "견적 응답 도착",
        message: `${plan.title}에 대한 업체 견적이 도착했습니다.`,
        href: `/plans/${plan.id}`,
        metadata: { script: "verify-quote-flow", quoteRequestId: created.requestId, quoteResponseId: response.id }
      }
    });

    const activity = await tx.activityLog.create({
      data: {
        actorId: vendor.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: created.requestId,
        quoteResponseId: response.id,
        reservationId: created.reservationId,
        type: "QUOTE_RESPONSE_SUBMITTED",
        message: "업체가 견적 응답을 제출했습니다.",
        metadata: { script: "verify-quote-flow" }
      }
    });

    return { response, notification, activity };
  });

  created.responseId = quoteResponseResult.response.id;
  created.notificationIds.push(quoteResponseResult.notification.id);
  created.activityLogIds.push(quoteResponseResult.activity.id);

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
    afterVendorResponse.reservation?.quotedAmount === quotedAmount &&
    afterVendorResponse.reservation?.confirmedAmount === null;

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

  const vendorConfirmationDueAt = new Date();
  vendorConfirmationDueAt.setDate(vendorConfirmationDueAt.getDate() + 3);

  const acceptResult = await prisma.$transaction(async (tx) => {
    await tx.quoteRequest.update({
      where: { id: created.requestId },
      data: { status: QuoteStatus.ACCEPTED }
    });

    await tx.reservation.update({
      where: { id: created.reservationId },
      data: {
        quoteResponseId: created.responseId,
        status: ReservationStatus.PENDING,
        confirmedAmount: null,
        vendorConfirmationDueAt
      }
    });

    const notification = await tx.notification.create({
      data: {
        userId: vendor.id,
        type: "QUOTE_RESPONSE_ACCEPTED",
        title: "견적이 수락되었습니다",
        message: `${plan.title} 견적이 수락되었습니다. 예약을 최종 확정해 주세요.`,
        href: "/vendor/dashboard",
        metadata: { script: "verify-quote-flow", reservationId: created.reservationId }
      }
    });

    const activity = await tx.activityLog.create({
      data: {
        actorId: planner.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: created.requestId,
        quoteResponseId: created.responseId,
        reservationId: created.reservationId,
        type: "QUOTE_RESPONSE_ACCEPTED",
        message: "일반 사용자가 견적 응답을 수락했습니다.",
        metadata: { script: "verify-quote-flow" }
      }
    });

    return { notification, activity };
  });
  created.notificationIds.push(acceptResult.notification.id);
  created.activityLogIds.push(acceptResult.activity.id);

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
  checks.vendor_confirmation_due_set = Boolean(afterAccept.reservation?.vendorConfirmationDueAt);

  assert.equal(reservationCountAfterAccept, 1);

  const confirmResult = await canVendorConfirmReservation(created.reservationId, vendor.id);
  created.notificationIds.push(confirmResult.notification.id);
  created.activityLogIds.push(confirmResult.activity.id);

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
  checks.vendor_confirmation_due_cleared =
    afterConfirm.quoteRequests[0]?.reservation?.vendorConfirmationDueAt === null;

  const [workflowNotifications, workflowActivities] = await Promise.all([
    prisma.notification.count({ where: { id: { in: created.notificationIds } } }),
    prisma.activityLog.count({ where: { id: { in: created.activityLogIds } } })
  ]);
  checks.workflow_notifications_created = workflowNotifications;
  checks.workflow_activity_logs_created = workflowActivities;
  assert.equal(workflowNotifications, created.notificationIds.length);
  assert.equal(workflowActivities, created.activityLogIds.length);

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
    if (created.requestId || created.canceledRequestId) {
      await prisma.quoteRequest.deleteMany({
        where: { id: { in: [created.requestId, created.canceledRequestId].filter(Boolean) } }
      });
    }
    if (created.planId) {
      await prisma.eventPlan.deleteMany({
        where: { id: created.planId }
      });
    }
    if (created.notificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: created.notificationIds } }
      });
    }
    if (created.activityLogIds.length > 0) {
      await prisma.activityLog.deleteMany({
        where: { id: { in: created.activityLogIds } }
      });
    }
    await prisma.$disconnect();
  });
