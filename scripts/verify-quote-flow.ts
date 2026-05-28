import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventStatus,
  Prisma,
  PrismaClient,
  QuoteStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus
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

function stringArrayFromJson(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function moduleCategoryMatchesEventType(eventType: string, category: string) {
  const weddingCategories = new Set([
    "VENUE",
    "PHOTO",
    "DRESS",
    "MAKEUP",
    "DECORATION",
    "CATERING",
    "INVITATION",
    "CEREMONY"
  ]);
  const funeralCategories = new Set([
    "FUNERAL_HALL",
    "WREATH",
    "TRANSPORT",
    "CEREMONY",
    "MEAL",
    "OBITUARY"
  ]);

  if (eventType === "WEDDING") return weddingCategories.has(category);
  if (eventType === "FUNERAL") return funeralCategories.has(category);
  return false;
}

async function validateQuoteRequestContract(input: {
  ownerId: string;
  planId: string;
  vendorId: string;
  selectedModuleIds: string[];
}) {
  const selectedModuleIds = Array.from(new Set(input.selectedModuleIds));

  if (selectedModuleIds.length === 0) {
    throw new Error("최소 1개 이상의 서비스를 선택해 주세요.");
  }

  const plan = await prisma.eventPlan.findFirst({
    where: {
      id: input.planId,
      ownerId: input.ownerId,
      type: { in: ["WEDDING", "FUNERAL"] }
    },
    select: { id: true, type: true }
  });

  if (!plan) {
    throw new Error("플랜을 찾을 수 없습니다.");
  }

  const vendor = await prisma.user.findFirst({
    where: {
      id: input.vendorId,
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      isActive: true
    },
    select: { id: true, supportedEventTypes: true }
  });

  if (!vendor) {
    throw new Error("업체를 찾을 수 없습니다.");
  }

  if (!stringArrayFromJson(vendor.supportedEventTypes).includes(plan.type)) {
    throw new Error("선택한 업체는 이 행사 유형을 지원하지 않습니다.");
  }

  const modules = await prisma.vendorServiceModule.findMany({
    where: {
      id: { in: selectedModuleIds },
      vendorId: vendor.id,
      isActive: true
    },
    select: { id: true, category: true }
  });

  if (modules.length !== selectedModuleIds.length) {
    throw new Error("선택한 모듈이 유효하지 않습니다.");
  }

  if (modules.some((module) => !moduleCategoryMatchesEventType(plan.type, module.category))) {
    throw new Error("행사 유형과 맞지 않는 서비스가 포함되어 있습니다.");
  }
}

async function validateQuoteResponseContract(input: {
  actorId: string;
  requestId: string;
  totalPrice: number;
}) {
  const actor = await prisma.user.findUniqueOrThrow({
    where: { id: input.actorId },
    select: { id: true, role: true }
  });

  if (actor.role !== UserRole.VENDOR) {
    throw new Error("업체 사용자만 실행할 수 있습니다.");
  }

  if (input.totalPrice <= 0) {
    throw new Error("견적 총액은 0원보다 커야 합니다.");
  }

  const request = await prisma.quoteRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, vendorId: true, status: true }
  });

  if (!request) {
    throw new Error("견적 요청을 찾을 수 없습니다.");
  }

  if (request.vendorId !== actor.id) {
    throw new Error("이 요청에 응답할 권한이 없습니다.");
  }

  const existingResponse = await prisma.quoteResponse.findFirst({
    where: { requestId: request.id, vendorId: actor.id },
    select: { id: true }
  });

  if (existingResponse) {
    throw new Error("이미 이 요청에 대한 견적 응답이 제출되었습니다.");
  }

  if (request.status !== QuoteStatus.PENDING) {
    throw new Error("응답 가능한 견적 요청이 아닙니다.");
  }
}

async function validateQuoteAcceptContract(input: {
  ownerId: string;
  quoteResponseId: string;
}) {
  const response = await prisma.quoteResponse.findFirst({
    where: {
      id: input.quoteResponseId,
      request: {
        plan: {
          ownerId: input.ownerId
        }
      }
    },
    include: {
      request: {
        select: { status: true }
      }
    }
  });

  if (!response) {
    throw new Error("견적 응답을 찾을 수 없습니다.");
  }

  if (response.request.status === QuoteStatus.ACCEPTED) {
    throw new Error("이미 수락된 견적입니다.");
  }

  if (response.request.status !== QuoteStatus.RESPONDED) {
    throw new Error("업체 응답이 도착한 견적만 수락할 수 있습니다.");
  }
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

  const [planner, vendor, catering, guest] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.planner }
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.venue }
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.catering }
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: demoAccountCredentials.guest }
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
  await expectReject("empty selected modules", async () => {
    await validateQuoteRequestContract({
      ownerId: planner.id,
      planId: plan.id,
      vendorId: vendor.id,
      selectedModuleIds: []
    });
  });
  checks.empty_selected_modules_rejected = true;

  await expectReject("nonexistent vendor", async () => {
    await validateQuoteRequestContract({
      ownerId: planner.id,
      planId: plan.id,
      vendorId: "missing-vendor-id",
      selectedModuleIds: selectedModules
    });
  });
  checks.nonexistent_vendor_rejected = true;

  await expectReject("nonexistent module", async () => {
    await validateQuoteRequestContract({
      ownerId: planner.id,
      planId: plan.id,
      vendorId: vendor.id,
      selectedModuleIds: ["missing-module-id"]
    });
  });
  checks.nonexistent_module_rejected = true;

  await expectReject("non-owner quote request create", async () => {
    await validateQuoteRequestContract({
      ownerId: guest.id,
      planId: plan.id,
      vendorId: vendor.id,
      selectedModuleIds: selectedModules
    });
  });
  checks.non_owner_quote_request_create_rejected = true;

  const nonOwnerPlanRead = await prisma.eventPlan.findFirst({
    where: { id: plan.id, ownerId: guest.id },
    select: { id: true }
  });
  assert.equal(nonOwnerPlanRead, null);
  checks.non_owner_quote_request_read_rejected = true;

  const funeralOnlyModule = await prisma.vendorServiceModule.findFirst({
    where: { vendorId: catering.id, category: "MEAL", isActive: true },
    select: { id: true }
  });

  if (funeralOnlyModule) {
    await expectReject("module event type mismatch", async () => {
      await validateQuoteRequestContract({
        ownerId: planner.id,
        planId: plan.id,
        vendorId: catering.id,
        selectedModuleIds: [funeralOnlyModule.id]
      });
    });
    checks.module_event_type_mismatch_rejected = true;
  }

  await validateQuoteRequestContract({
    ownerId: planner.id,
    planId: plan.id,
    vendorId: vendor.id,
    selectedModuleIds: selectedModules
  });
  checks.valid_quote_request_contract_passed = true;

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

  await expectReject("non-vendor quote response submit", async () => {
    await validateQuoteResponseContract({
      actorId: planner.id,
      requestId: created.requestId,
      totalPrice: quotedAmount
    });
  });
  checks.non_vendor_quote_response_rejected = true;

  await expectReject("wrong vendor quote response submit", async () => {
    await validateQuoteResponseContract({
      actorId: catering.id,
      requestId: created.requestId,
      totalPrice: quotedAmount
    });
  });
  checks.wrong_vendor_quote_response_rejected = true;

  await expectReject("zero quote response total", async () => {
    await validateQuoteResponseContract({
      actorId: vendor.id,
      requestId: created.requestId,
      totalPrice: 0
    });
  });
  checks.zero_quote_response_total_rejected = true;

  await expectReject("negative quote response total", async () => {
    await validateQuoteResponseContract({
      actorId: vendor.id,
      requestId: created.requestId,
      totalPrice: -1
    });
  });
  checks.negative_quote_response_total_rejected = true;

  await validateQuoteResponseContract({
    actorId: vendor.id,
    requestId: created.requestId,
    totalPrice: quotedAmount
  });
  checks.valid_quote_response_contract_passed = true;

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

  await expectReject("non-owner quote response accept", async () => {
    await validateQuoteAcceptContract({
      ownerId: guest.id,
      quoteResponseId: created.responseId
    });
  });
  checks.non_owner_quote_accept_rejected = true;

  await validateQuoteAcceptContract({
    ownerId: planner.id,
    quoteResponseId: created.responseId
  });
  checks.valid_quote_accept_contract_passed = true;

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

  await expectReject("duplicate quote response contract", async () => {
    await validateQuoteResponseContract({
      actorId: vendor.id,
      requestId: created.requestId,
      totalPrice: quotedAmount
    });
  });
  checks.duplicate_quote_response_contract_rejected = true;

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

  await expectReject("duplicate quote response accept", async () => {
    await validateQuoteAcceptContract({
      ownerId: planner.id,
      quoteResponseId: created.responseId
    });
  });
  checks.duplicate_quote_accept_rejected = true;

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

  const pendingAfterConfirm = await prisma.reservation.count({
    where: { id: created.reservationId, status: ReservationStatus.PENDING }
  });
  checks.confirmed_reservation_not_pending = pendingAfterConfirm === 0;
  assert.equal(pendingAfterConfirm, 0);

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
