"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ReservationStatus as PrismaReservationStatus, UserRole } from "@/generated/prisma/client";
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
import type { CreateReservationPayload, ReservationData } from "@/types/reservation";

import {
  mapReservation,
  mapReservationStatus,
  parseActionDate,
  requireGeneralUser,
  requireSessionUser,
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
  totalAmount: z.number().int().nonnegative().optional()
});

function revalidateReservationViews(planId?: string) {
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
): Promise<ActionResult<ReservationData>> {
  try {
    const user = await requireSessionUser();

    if (!reservationId || !reason.trim()) {
      return actionError("예약 ID와 취소 사유가 필요합니다.", "VALIDATION_ERROR");
    }

    const reservation = await getReservationForActor(
      reservationId,
      user.id,
      user.role === UserRole.VENDOR
    );

    if (!reservation) {
      return actionError("예약을 찾을 수 없습니다.", "NOT_FOUND");
    }

    assertReservationTransition(mapReservationStatus(reservation.status), "CANCELED");

    const updated = await prisma.$transaction(async (tx) => {
      const canceled = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: PrismaReservationStatus.CANCELED,
          vendorConfirmationDueAt: null,
          notes: reason
        },
        include: {
          vendor: true,
          quoteResponse: {
            include: { vendor: true }
          }
        }
      });

      const actorIsVendor = user.role === UserRole.VENDOR;
      await createWorkflowNotification(tx, {
        userId: actorIsVendor ? reservation.eventPlan.ownerId : reservation.vendorId,
        type: "RESERVATION_CANCELED",
        title: "예약이 취소되었습니다",
        message: `${reservation.eventPlan.title} 예약이 취소되었습니다.`,
        href: actorIsVendor ? getPlanHref(reservation.eventPlanId) : "/vendor/dashboard",
        metadata: {
          planId: reservation.eventPlanId,
          vendorId: reservation.vendorId,
          quoteRequestId: reservation.quoteRequestId ?? "",
          quoteResponseId: reservation.quoteResponseId ?? "",
          reservationId: reservation.id,
          reason
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: reservation.eventPlanId,
        vendorId: reservation.vendorId,
        quoteRequestId: reservation.quoteRequestId ?? null,
        quoteResponseId: reservation.quoteResponseId ?? null,
        reservationId: reservation.id,
        type: "RESERVATION_CANCELED",
        message: "예약이 취소되었습니다.",
        metadata: {
          actorRole: user.role,
          reason
        }
      });

      return canceled;
    });

    revalidateReservationViews(updated.eventPlanId);
    return actionSuccess(mapReservation(updated));
  } catch (error) {
    return actionError(getActionError(error), "CANCEL_RESERVATION_FAILED");
  }
}

export async function requestChange(
  reservationId: string,
  changes: Partial<ReservationData>
): Promise<ActionResult<ReservationData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = changeReservationSchema.safeParse({
      reservedDate: changes.reservedDate,
      totalAmount: changes.totalAmount
    });

    if (!reservationId || !parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const reservation = await getReservationForActor(reservationId, user.id, false);

    if (!reservation) {
      return actionError("예약을 찾을 수 없습니다.", "NOT_FOUND");
    }

    assertReservationTransition(mapReservationStatus(reservation.status), "CHANGED");

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: PrismaReservationStatus.CHANGED,
        ...(parsed.data.reservedDate
          ? { serviceDate: parseActionDate(parsed.data.reservedDate) }
          : {}),
        ...(parsed.data.totalAmount !== undefined
          ? { quotedAmount: parsed.data.totalAmount, confirmedAmount: null }
          : {})
      },
      include: {
        vendor: true,
        quoteResponse: {
          include: { vendor: true }
        }
      }
    });

    revalidateReservationViews(updated.eventPlanId);
    return actionSuccess(mapReservation(updated));
  } catch (error) {
    return actionError(getActionError(error), "REQUEST_CHANGE_FAILED");
  }
}
