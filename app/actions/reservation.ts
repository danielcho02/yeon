"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  Prisma,
  ReservationRequestStatus,
  ReservationStatus as PrismaReservationStatus,
  UserRole
} from "@/generated/prisma/client";
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertReservationTransition } from "@/lib/state-machine";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getVendorConfirmationDueAt,
  getPlanHref
} from "@/lib/workflow-events";

import type { ActionResult } from "@/types/common";
import type {
  CreateReservationPayload,
  ReservationCancellationRequestData,
  ReservationChangeRequestData,
  ReservationData,
  VendorDashboardSelectedServiceOptionDTO
} from "@/types/reservation";

import {
  mapReservation,
  mapReservationCancellationRequest,
  mapReservationChangeRequest,
  mapReservationStatus,
  parseActionDate,
  requireGeneralUser,
  requireVendorUser
} from "./_utils";

const createReservationSchema = z.object({
  planId: z.string().min(1),
  vendorId: z.string().min(1),
  quoteResponseId: z.string().min(1).optional(),
  reservedDate: z.string().min(1),
  totalAmount: z.number().int().nonnegative()
});

const changeReservationSchema = z.object({
  reservedDate: z.string().min(1).optional(),
  guestCount: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
  reason: z.string().trim().min(1).max(2000),
  selectedServiceOptions: z
    .array(
      z.object({
        catalogKey: z.string().nullable().optional(),
        name: z.string().trim().min(1),
        price: z.number().int().nonnegative(),
        pricingType: z.string().trim().min(1),
        quantity: z.number().int().positive().optional(),
        subtotal: z.number().int().nonnegative().optional()
      })
    )
    .optional()
});

const cancelReservationRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000)
});

const vendorDecisionSchema = z.object({
  memo: z.string().trim().max(2000).optional()
});

function revalidateReservationViews(planId?: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.YEON_VERIFY_ACTION_AUTH === "1"
  ) {
    return;
  }

  revalidatePath("/account");
  revalidatePath("/plans");
  if (planId) revalidatePath(`/plans/${planId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

async function getReservationForActor(reservationId: string, userId: string, isVendor: boolean) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      ...(isVendor ? { vendorId: userId } : { eventPlan: { ownerId: userId } })
    },
    include: {
      vendor: true,
      quoteResponse: {
        include: {
          vendor: true
        }
      },
      quoteRequest: true,
      changeRequests: {
        where: { status: ReservationRequestStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      cancellationRequests: {
        where: { status: ReservationRequestStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      eventPlan: {
        select: {
          id: true,
          ownerId: true,
          title: true
        }
      }
    }
  });
}

function canRequestReservationChange(status: PrismaReservationStatus) {
  return status === PrismaReservationStatus.PENDING || status === PrismaReservationStatus.CONFIRMED;
}

async function hasPendingReservationRequest(
  reservationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const [changeCount, cancellationCount] = await Promise.all([
    tx.reservationChangeRequest.count({
      where: { reservationId, status: ReservationRequestStatus.PENDING }
    }),
    tx.reservationCancellationRequest.count({
      where: { reservationId, status: ReservationRequestStatus.PENDING }
    })
  ]);

  return changeCount + cancellationCount > 0;
}

function normalizeSelectedServiceOptions(
  options: Array<{
    catalogKey?: string | null;
    name: string;
    price: number;
    pricingType: string;
    quantity?: number;
    subtotal?: number;
  }> | undefined
): Prisma.InputJsonValue | undefined {
  if (!options || options.length === 0) return undefined;

  return options.map((option) => ({
    catalogKey: option.catalogKey ?? null,
    name: option.name,
    price: option.price,
    pricingType: option.pricingType,
    ...(option.quantity !== undefined ? { quantity: option.quantity } : {}),
    ...(option.subtotal !== undefined ? { subtotal: option.subtotal } : {})
  }));
}

export async function createReservation(
  payload: CreateReservationPayload
): Promise<ActionResult<ReservationData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createReservationSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: parsed.data.planId, ownerId: user.id },
      select: { id: true, ownerId: true, title: true }
    });

    if (!plan) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const vendor = await prisma.user.findFirst({
      where: { id: parsed.data.vendorId, role: UserRole.VENDOR, isActive: true },
      select: { id: true, name: true, companyName: true, location: true, bio: true, vendorApprovalStatus: true, supportedServiceModules: true }
    });

    if (!vendor) {
      return actionError("업체를 찾을 수 없습니다.", "VENDOR_NOT_FOUND");
    }

    let quoteRequestId: string | null = null;

    if (parsed.data.quoteResponseId) {
      const quoteResponse = await prisma.quoteResponse.findFirst({
        where: {
          id: parsed.data.quoteResponseId,
          vendorId: parsed.data.vendorId,
          request: {
            planId: parsed.data.planId,
            status: "ACCEPTED"
          }
        },
        select: { id: true, requestId: true }
      });

      if (!quoteResponse) {
        return actionError("수락된 견적 응답을 찾을 수 없습니다.", "QUOTE_RESPONSE_NOT_FOUND");
      }

      quoteRequestId = quoteResponse.requestId;

      const existingReservation = await prisma.reservation.findUnique({
        where: { quoteResponseId: parsed.data.quoteResponseId },
        include: {
          vendor: true,
          quoteResponse: {
            include: { vendor: true }
          }
        }
      });

      if (existingReservation) {
        return actionSuccess(mapReservation(existingReservation));
      }
    }

    const vendorConfirmationDueAt = getVendorConfirmationDueAt();
    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          eventPlanId: parsed.data.planId,
          vendorId: parsed.data.vendorId,
          quoteRequestId,
          quoteResponseId: parsed.data.quoteResponseId ?? null,
          serviceName: "모듈형 견적 예약",
          serviceDate: parseActionDate(parsed.data.reservedDate),
          quotedAmount: parsed.data.totalAmount,
          confirmedAmount: null,
          vendorConfirmationDueAt,
          status: PrismaReservationStatus.PENDING
        },
        include: {
          vendor: true,
          quoteResponse: {
            include: { vendor: true }
          }
        }
      });

      await createWorkflowNotification(tx, {
        userId: parsed.data.vendorId,
        type: "RESERVATION_PENDING_CONFIRMATION",
        title: "예약 최종 확정 요청",
        message: `${plan.title} 예약 요청을 최종 확정해 주세요.`,
        href: "/vendor/dashboard",
        metadata: {
          planId: plan.id,
          reservationId: created.id,
          quoteRequestId: quoteRequestId ?? "",
          quoteResponseId: parsed.data.quoteResponseId ?? "",
          vendorConfirmationDueAt: vendorConfirmationDueAt.toISOString()
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: plan.id,
        vendorId: parsed.data.vendorId,
        quoteRequestId,
        quoteResponseId: parsed.data.quoteResponseId ?? null,
        reservationId: created.id,
        type: "RESERVATION_PENDING_CREATED",
        message: "일반 사용자가 업체 최종 확정 대기 예약을 생성했습니다.",
        metadata: {
          totalAmount: parsed.data.totalAmount,
          vendorConfirmationDueAt: vendorConfirmationDueAt.toISOString()
        }
      });

      return created;
    });

    revalidateReservationViews(reservation.eventPlanId);
    return actionSuccess(mapReservation(reservation));
  } catch (error) {
    return actionError(getActionError(error), "CREATE_RESERVATION_FAILED");
  }
}

export async function confirmReservation(
  reservationId: string
): Promise<ActionResult<ReservationData>> {
  try {
    const vendor = await requireVendorUser();

    if (!reservationId) {
      return actionError("예약 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const reservation = await getReservationForActor(reservationId, vendor.id, true);

    if (!reservation) {
      return actionError("예약을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (reservation.quoteRequest && reservation.quoteRequest.status !== "ACCEPTED") {
      return actionError("사용자가 수락한 견적만 확정할 수 있습니다.", "QUOTE_NOT_ACCEPTED");
    }

    if (reservation.status === PrismaReservationStatus.CONFIRMED) {
      return actionError("이미 최종 확정된 예약입니다.", "RESERVATION_ALREADY_CONFIRMED");
    }

    if (
      reservation.status !== PrismaReservationStatus.PENDING &&
      reservation.status !== PrismaReservationStatus.CHANGED
    ) {
      return actionError(
        "최종 확정할 수 있는 예약 상태가 아닙니다.",
        "INVALID_RESERVATION_STATUS"
      );
    }

    assertReservationTransition(mapReservationStatus(reservation.status), "CONFIRMED");

    const updated = await prisma.$transaction(async (tx) => {
      const confirmed = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: PrismaReservationStatus.CONFIRMED,
          confirmedAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0,
          vendorConfirmationDueAt: null
        },
        include: {
          vendor: true,
          quoteResponse: {
            include: { vendor: true }
          }
        }
      });

      await createWorkflowNotification(tx, {
        userId: reservation.eventPlan.ownerId,
        type: "RESERVATION_CONFIRMED",
        title: "예약이 최종 확정되었습니다",
        message: `${reservation.eventPlan.title} 예약이 업체에 의해 최종 확정되었습니다.`,
        href: getPlanHref(reservation.eventPlanId),
        metadata: {
          planId: reservation.eventPlanId,
          vendorId: reservation.vendorId,
          quoteRequestId: reservation.quoteRequestId ?? "",
          quoteResponseId: reservation.quoteResponseId ?? "",
          reservationId: reservation.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: reservation.eventPlanId,
        vendorId: reservation.vendorId,
        quoteRequestId: reservation.quoteRequestId ?? null,
        quoteResponseId: reservation.quoteResponseId ?? null,
        reservationId: reservation.id,
        type: "RESERVATION_CONFIRMED",
        message: "업체가 예약을 최종 확정했습니다.",
        metadata: {
          confirmedAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0
        }
      });

      return confirmed;
    });

    revalidateReservationViews(updated.eventPlanId);
    return actionSuccess(mapReservation(updated));
  } catch (error) {
    return actionError(getActionError(error), "CONFIRM_RESERVATION_FAILED");
  }
}

export async function cancelReservation(
  reservationId: string,
  reason: string
): Promise<ActionResult<ReservationCancellationRequestData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = cancelReservationRequestSchema.safeParse({ reason });

    if (!reservationId || !parsed.success) {
      return actionError("예약 ID와 취소 사유가 필요합니다.", "VALIDATION_ERROR");
    }

    const reservation = await getReservationForActor(reservationId, user.id, false);

    if (!reservation) {
      return actionError("예약을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (!canRequestReservationChange(reservation.status)) {
      return actionError("취소 요청을 보낼 수 없는 예약 상태입니다.", "INVALID_RESERVATION_STATUS");
    }

    const created = await prisma.$transaction(async (tx) => {
      if (await hasPendingReservationRequest(reservation.id, tx)) {
        throw new Error("이미 업체 승인 대기 중인 변경/취소 요청이 있습니다.");
      }

      const cancellationRequest = await tx.reservationCancellationRequest.create({
        data: {
          reservationId: reservation.id,
          plannerId: user.id,
          vendorId: reservation.vendorId,
          reason: parsed.data.reason
        }
      });

      await createWorkflowNotification(tx, {
        userId: reservation.vendorId,
        type: "RESERVATION_CANCELLATION_REQUESTED",
        title: "예약 취소 요청이 도착했습니다",
        message: `${reservation.eventPlan.title} 예약 취소 요청을 확인해 주세요.`,
        href: "/vendor/dashboard",
        metadata: {
          planId: reservation.eventPlanId,
          vendorId: reservation.vendorId,
          quoteRequestId: reservation.quoteRequestId ?? "",
          quoteResponseId: reservation.quoteResponseId ?? "",
          reservationId: reservation.id,
          cancellationRequestId: cancellationRequest.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: reservation.eventPlanId,
        vendorId: reservation.vendorId,
        quoteRequestId: reservation.quoteRequestId ?? null,
        quoteResponseId: reservation.quoteResponseId ?? null,
        reservationId: reservation.id,
        type: "RESERVATION_CANCELLATION_REQUESTED",
        message: "일반 사용자가 예약 취소 승인을 요청했습니다.",
        metadata: {
          cancellationRequestId: cancellationRequest.id,
          reason: parsed.data.reason
        }
      });

      return cancellationRequest;
    });

    revalidateReservationViews(reservation.eventPlanId);
    return actionSuccess(mapReservationCancellationRequest(created));
  } catch (error) {
    return actionError(getActionError(error), "CANCEL_RESERVATION_FAILED");
  }
}

type RequestChangePayload = Partial<ReservationData> & {
  guestCount?: number;
  notes?: string;
  reason?: string;
  selectedServiceOptions?: VendorDashboardSelectedServiceOptionDTO[];
};

export async function requestChange(
  reservationId: string,
  changes: RequestChangePayload
): Promise<ActionResult<ReservationChangeRequestData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = changeReservationSchema.safeParse({
      reservedDate: changes.reservedDate,
      guestCount: changes.guestCount,
      notes: changes.notes,
      reason: changes.reason,
      selectedServiceOptions: changes.selectedServiceOptions
    });

    if (!reservationId || !parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const reservation = await getReservationForActor(reservationId, user.id, false);

    if (!reservation) {
      return actionError("예약을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (!canRequestReservationChange(reservation.status)) {
      return actionError("변경 요청을 보낼 수 없는 예약 상태입니다.", "INVALID_RESERVATION_STATUS");
    }

    const requestedSelectedServiceOptions = normalizeSelectedServiceOptions(
      parsed.data.selectedServiceOptions
    );

    const created = await prisma.$transaction(async (tx) => {
      if (await hasPendingReservationRequest(reservation.id, tx)) {
        throw new Error("이미 업체 승인 대기 중인 변경/취소 요청이 있습니다.");
      }

      const changeRequest = await tx.reservationChangeRequest.create({
        data: {
          reservationId: reservation.id,
          plannerId: user.id,
          vendorId: reservation.vendorId,
          requestedServiceDate: parsed.data.reservedDate
            ? parseActionDate(parsed.data.reservedDate)
            : null,
          requestedGuestCount: parsed.data.guestCount ?? null,
          requestedNotes: parsed.data.notes ?? null,
          requestedReason: parsed.data.reason,
          ...(requestedSelectedServiceOptions
            ? { requestedSelectedServiceOptions }
            : {})
        }
      });

      await createWorkflowNotification(tx, {
        userId: reservation.vendorId,
        type: "RESERVATION_CHANGE_REQUESTED",
        title: "예약 변경 요청이 도착했습니다",
        message: `${reservation.eventPlan.title} 예약 변경 요청을 확인해 주세요.`,
        href: "/vendor/dashboard",
        metadata: {
          planId: reservation.eventPlanId,
          vendorId: reservation.vendorId,
          quoteRequestId: reservation.quoteRequestId ?? "",
          quoteResponseId: reservation.quoteResponseId ?? "",
          reservationId: reservation.id,
          changeRequestId: changeRequest.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: reservation.eventPlanId,
        vendorId: reservation.vendorId,
        quoteRequestId: reservation.quoteRequestId ?? null,
        quoteResponseId: reservation.quoteResponseId ?? null,
        reservationId: reservation.id,
        type: "RESERVATION_CHANGE_REQUESTED",
        message: "일반 사용자가 예약 변경 승인을 요청했습니다.",
        metadata: {
          changeRequestId: changeRequest.id,
          requestedServiceDate: parsed.data.reservedDate ?? "",
          requestedGuestCount: parsed.data.guestCount ?? 0
        }
      });

      return changeRequest;
    });

    revalidateReservationViews(reservation.eventPlanId);
    return actionSuccess(mapReservationChangeRequest(created));
  } catch (error) {
    return actionError(getActionError(error), "REQUEST_CHANGE_FAILED");
  }
}

export async function approveReservationChangeRequest(
  requestId: string,
  decision: string | { memo?: string } = {}
): Promise<ActionResult<ReservationData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = vendorDecisionSchema.safeParse(
      typeof decision === "string" ? { memo: decision } : decision
    );

    if (!requestId || !parsed.success) {
      return actionError("요청 ID와 결정 메모를 확인해 주세요.", "VALIDATION_ERROR");
    }

    const request = await prisma.reservationChangeRequest.findFirst({
      where: {
        id: requestId,
        vendorId: vendor.id,
        status: ReservationRequestStatus.PENDING
      },
      include: {
        reservation: {
          include: {
            vendor: true,
            quoteResponse: { include: { vendor: true } },
            eventPlan: { select: { id: true, ownerId: true, title: true } }
          }
        }
      }
    });

    if (!request) {
      return actionError("승인 대기 중인 변경 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (!canRequestReservationChange(request.reservation.status)) {
      return actionError("변경 승인할 수 없는 예약 상태입니다.", "INVALID_RESERVATION_STATUS");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.reservationChangeRequest.update({
        where: { id: request.id },
        data: {
          status: ReservationRequestStatus.APPROVED,
          vendorDecisionMemo: parsed.data.memo ?? null,
          decidedAt: new Date()
        }
      });

      const reservation = await tx.reservation.update({
        where: { id: request.reservationId },
        data: {
          ...(request.requestedServiceDate
            ? { serviceDate: request.requestedServiceDate }
            : {}),
          ...(request.requestedGuestCount !== null
            ? { guestCount: request.requestedGuestCount }
            : {}),
          ...(request.requestedNotes !== null ? { notes: request.requestedNotes } : {}),
          ...(request.requestedSelectedServiceOptions !== null
            ? {
                selectedServiceOptions:
                  request.requestedSelectedServiceOptions as Prisma.InputJsonValue
              }
            : {})
        },
        include: {
          vendor: true,
          quoteResponse: { include: { vendor: true } },
          changeRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          cancellationRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      });

      await createWorkflowNotification(tx, {
        userId: request.reservation.eventPlan.ownerId,
        type: "RESERVATION_CHANGE_APPROVED",
        title: "예약 변경 요청이 승인되었습니다",
        message: `${request.reservation.eventPlan.title} 예약 변경 내용이 반영되었습니다.`,
        href: getPlanHref(request.reservation.eventPlanId),
        metadata: {
          planId: request.reservation.eventPlanId,
          vendorId: request.vendorId,
          reservationId: request.reservationId,
          changeRequestId: request.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: request.reservation.eventPlanId,
        vendorId: request.vendorId,
        reservationId: request.reservationId,
        type: "RESERVATION_CHANGE_APPROVED",
        message: "업체가 예약 변경 요청을 승인했습니다.",
        metadata: {
          changeRequestId: request.id
        }
      });

      return reservation;
    });

    revalidateReservationViews(updated.eventPlanId);
    return actionSuccess(mapReservation(updated));
  } catch (error) {
    return actionError(getActionError(error), "APPROVE_RESERVATION_CHANGE_FAILED");
  }
}

export async function rejectReservationChangeRequest(
  requestId: string,
  decision: string | { memo?: string } = {}
): Promise<ActionResult<ReservationChangeRequestData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = vendorDecisionSchema.safeParse(
      typeof decision === "string" ? { memo: decision } : decision
    );

    if (!requestId || !parsed.success) {
      return actionError("요청 ID와 결정 메모를 확인해 주세요.", "VALIDATION_ERROR");
    }

    const request = await prisma.reservationChangeRequest.findFirst({
      where: {
        id: requestId,
        vendorId: vendor.id,
        status: ReservationRequestStatus.PENDING
      },
      include: {
        reservation: {
          include: {
            eventPlan: { select: { id: true, ownerId: true, title: true } }
          }
        }
      }
    });

    if (!request) {
      return actionError("승인 대기 중인 변경 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.reservationChangeRequest.update({
        where: { id: request.id },
        data: {
          status: ReservationRequestStatus.REJECTED,
          vendorDecisionMemo: parsed.data.memo ?? null,
          decidedAt: new Date()
        }
      });

      await createWorkflowNotification(tx, {
        userId: request.reservation.eventPlan.ownerId,
        type: "RESERVATION_CHANGE_REJECTED",
        title: "예약 변경 요청이 거절되었습니다",
        message: `${request.reservation.eventPlan.title} 예약 변경 요청이 거절되어 기존 예약이 유지됩니다.`,
        href: getPlanHref(request.reservation.eventPlanId),
        metadata: {
          planId: request.reservation.eventPlanId,
          vendorId: request.vendorId,
          reservationId: request.reservationId,
          changeRequestId: request.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: request.reservation.eventPlanId,
        vendorId: request.vendorId,
        reservationId: request.reservationId,
        type: "RESERVATION_CHANGE_REJECTED",
        message: "업체가 예약 변경 요청을 거절했습니다.",
        metadata: {
          changeRequestId: request.id
        }
      });

      return rejected;
    });

    revalidateReservationViews(request.reservation.eventPlanId);
    return actionSuccess(mapReservationChangeRequest(updated));
  } catch (error) {
    return actionError(getActionError(error), "REJECT_RESERVATION_CHANGE_FAILED");
  }
}

export async function approveReservationCancellationRequest(
  requestId: string,
  decision: string | { memo?: string } = {}
): Promise<ActionResult<ReservationData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = vendorDecisionSchema.safeParse(
      typeof decision === "string" ? { memo: decision } : decision
    );

    if (!requestId || !parsed.success) {
      return actionError("요청 ID와 결정 메모를 확인해 주세요.", "VALIDATION_ERROR");
    }

    const request = await prisma.reservationCancellationRequest.findFirst({
      where: {
        id: requestId,
        vendorId: vendor.id,
        status: ReservationRequestStatus.PENDING
      },
      include: {
        reservation: {
          include: {
            vendor: true,
            quoteResponse: { include: { vendor: true } },
            eventPlan: { select: { id: true, ownerId: true, title: true } }
          }
        }
      }
    });

    if (!request) {
      return actionError("승인 대기 중인 취소 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    assertReservationTransition(mapReservationStatus(request.reservation.status), "CANCELED");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.reservationCancellationRequest.update({
        where: { id: request.id },
        data: {
          status: ReservationRequestStatus.APPROVED,
          vendorDecisionMemo: parsed.data.memo ?? null,
          decidedAt: new Date()
        }
      });

      const reservation = await tx.reservation.update({
        where: { id: request.reservationId },
        data: {
          status: PrismaReservationStatus.CANCELED,
          vendorConfirmationDueAt: null
        },
        include: {
          vendor: true,
          quoteResponse: { include: { vendor: true } },
          changeRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          cancellationRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      });

      await createWorkflowNotification(tx, {
        userId: request.reservation.eventPlan.ownerId,
        type: "RESERVATION_CANCELLATION_APPROVED",
        title: "예약 취소 요청이 승인되었습니다",
        message: `${request.reservation.eventPlan.title} 예약이 취소되었습니다.`,
        href: getPlanHref(request.reservation.eventPlanId),
        metadata: {
          planId: request.reservation.eventPlanId,
          vendorId: request.vendorId,
          reservationId: request.reservationId,
          cancellationRequestId: request.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: request.reservation.eventPlanId,
        vendorId: request.vendorId,
        reservationId: request.reservationId,
        type: "RESERVATION_CANCELLATION_APPROVED",
        message: "업체가 예약 취소 요청을 승인했습니다.",
        metadata: {
          cancellationRequestId: request.id
        }
      });

      return reservation;
    });

    revalidateReservationViews(updated.eventPlanId);
    return actionSuccess(mapReservation(updated));
  } catch (error) {
    return actionError(getActionError(error), "APPROVE_RESERVATION_CANCELLATION_FAILED");
  }
}

export async function rejectReservationCancellationRequest(
  requestId: string,
  decision: string | { memo?: string } = {}
): Promise<ActionResult<ReservationCancellationRequestData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = vendorDecisionSchema.safeParse(
      typeof decision === "string" ? { memo: decision } : decision
    );

    if (!requestId || !parsed.success) {
      return actionError("요청 ID와 결정 메모를 확인해 주세요.", "VALIDATION_ERROR");
    }

    const request = await prisma.reservationCancellationRequest.findFirst({
      where: {
        id: requestId,
        vendorId: vendor.id,
        status: ReservationRequestStatus.PENDING
      },
      include: {
        reservation: {
          include: {
            eventPlan: { select: { id: true, ownerId: true, title: true } }
          }
        }
      }
    });

    if (!request) {
      return actionError("승인 대기 중인 취소 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.reservationCancellationRequest.update({
        where: { id: request.id },
        data: {
          status: ReservationRequestStatus.REJECTED,
          vendorDecisionMemo: parsed.data.memo ?? null,
          decidedAt: new Date()
        }
      });

      await createWorkflowNotification(tx, {
        userId: request.reservation.eventPlan.ownerId,
        type: "RESERVATION_CANCELLATION_REJECTED",
        title: "예약 취소 요청이 거절되었습니다",
        message: `${request.reservation.eventPlan.title} 예약 취소 요청이 거절되어 기존 예약이 유지됩니다.`,
        href: getPlanHref(request.reservation.eventPlanId),
        metadata: {
          planId: request.reservation.eventPlanId,
          vendorId: request.vendorId,
          reservationId: request.reservationId,
          cancellationRequestId: request.id
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: request.reservation.eventPlanId,
        vendorId: request.vendorId,
        reservationId: request.reservationId,
        type: "RESERVATION_CANCELLATION_REJECTED",
        message: "업체가 예약 취소 요청을 거절했습니다.",
        metadata: {
          cancellationRequestId: request.id
        }
      });

      return rejected;
    });

    revalidateReservationViews(request.reservation.eventPlanId);
    return actionSuccess(mapReservationCancellationRequest(updated));
  } catch (error) {
    return actionError(getActionError(error), "REJECT_RESERVATION_CANCELLATION_FAILED");
  }
}
