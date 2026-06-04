import { revalidatePath } from "next/cache";

import { ReservationRequestStatus, ReservationStatus, UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { getActionError, isDatabaseBusyError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { normalizePositiveInt, parseDateOnlyToKst } from "@/lib/step3.shared";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getVendorDashboardHref
} from "@/lib/workflow-events";

type RouteContext = {
  params: {
    reservationId: string;
  };
};

async function getOwnedReservation(userId: string, reservationId: string) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      eventPlan: {
        ownerId: userId
      }
    },
    select: {
      id: true,
      eventPlanId: true,
      vendorId: true,
      status: true,
      serviceDate: true,
      quotedAmount: true,
      confirmedAmount: true,
      quoteRequestId: true,
      quoteResponseId: true,
      eventPlan: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });
}

function revalidateReservationViews(eventPlanId: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${eventPlanId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

function routeErrorResponse(error: unknown) {
  if (isDatabaseBusyError(error)) {
    return Response.json(
      { error: getActionError(error) },
      { status: 503 }
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      { error: "요청 본문을 확인해 주세요." },
      { status: 400 }
    );
  }

  throw error;
}

function canRequestReservationChange(status: ReservationStatus) {
  return status === ReservationStatus.PENDING || status === ReservationStatus.CONFIRMED;
}

async function hasPendingReservationRequest(reservationId: string) {
  const [changeCount, cancellationCount] = await Promise.all([
    prisma.reservationChangeRequest.count({
      where: { reservationId, status: ReservationRequestStatus.PENDING }
    }),
    prisma.reservationCancellationRequest.count({
      where: { reservationId, status: ReservationRequestStatus.PENDING }
    })
  ]);

  return changeCount + cancellationCount > 0;
}

async function handlePatch(request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.user.role !== UserRole.GENERAL) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  const reservation = await getOwnedReservation(
    session.user.id,
    context.params.reservationId
  );

  if (!reservation) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  if (reservation.status === ReservationStatus.CANCELED) {
    return Response.json({ error: "이미 취소된 예약입니다." }, { status: 400 });
  }

  if (!canRequestReservationChange(reservation.status)) {
    return Response.json({ error: "변경 요청을 보낼 수 없는 예약 상태입니다." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "update";
  const serviceDateInput =
    typeof body.serviceDate === "string" ? body.serviceDate : "";
  const guestCount = normalizePositiveInt(body.guestCount);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const reason =
    typeof body.reason === "string"
      ? body.reason.trim()
      : typeof body.requestedReason === "string"
      ? body.requestedReason.trim()
      : "";

  if (action === "confirm") {
    return Response.json(
      { error: "일반 사용자는 견적 수락만 할 수 있습니다. 예약 확정은 업체가 진행합니다." },
      { status: 400 }
    );
  }

  if (!reason) {
    return Response.json({ error: "변경 요청 사유가 필요합니다." }, { status: 400 });
  }

  if (await hasPendingReservationRequest(reservation.id)) {
    return Response.json({ error: "이미 업체 승인 대기 중인 변경/취소 요청이 있습니다." }, { status: 409 });
  }

  const changeRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.reservationChangeRequest.create({
      data: {
        reservationId: reservation.id,
        plannerId: session.user.id,
        vendorId: reservation.vendorId,
        requestedServiceDate: serviceDateInput ? parseDateOnlyToKst(serviceDateInput) : null,
        requestedGuestCount: guestCount,
        requestedNotes: notes || null,
        requestedReason: reason
      }
    });

    await createWorkflowNotification(tx, {
      userId: reservation.vendorId,
      type: "RESERVATION_CHANGE_REQUESTED",
      title: "예약 변경 요청이 도착했습니다",
      message: `${reservation.eventPlan.title} 예약 변경 요청을 확인해 주세요.`,
      href: getVendorDashboardHref(),
      metadata: {
        planId: reservation.eventPlanId,
        reservationId: reservation.id,
        quoteRequestId: reservation.quoteRequestId ?? "",
        quoteResponseId: reservation.quoteResponseId ?? "",
        changeRequestId: created.id,
        serviceDate: serviceDateInput,
        guestCount: guestCount ?? 0
      }
    });

    await createWorkflowActivity(tx, {
      actorId: session.user.id,
      planId: reservation.eventPlanId,
      vendorId: reservation.vendorId,
      quoteRequestId: reservation.quoteRequestId ?? null,
      quoteResponseId: reservation.quoteResponseId ?? null,
      reservationId: reservation.id,
      type: "RESERVATION_CHANGE_REQUESTED",
      message: "일반 사용자가 예약 변경 승인을 요청했습니다.",
      metadata: {
        changeRequestId: created.id
      }
    });

    return created;
  });

  revalidateReservationViews(reservation.eventPlanId);

  return Response.json({ ok: true, changeRequestId: changeRequest.id });
}

async function handleDelete(request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.user.role !== UserRole.GENERAL) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  const reservation = await getOwnedReservation(
    session.user.id,
    context.params.reservationId
  );

  if (!reservation) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  if (reservation.status === ReservationStatus.CANCELED) {
    return Response.json({ error: "이미 취소된 예약입니다." }, { status: 400 });
  }

  if (!canRequestReservationChange(reservation.status)) {
    return Response.json({ error: "취소 요청을 보낼 수 없는 예약 상태입니다." }, { status: 400 });
  }

  const body = await request
    .json()
    .catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return Response.json({ error: "취소 사유가 필요합니다." }, { status: 400 });
  }

  if (await hasPendingReservationRequest(reservation.id)) {
    return Response.json({ error: "이미 업체 승인 대기 중인 변경/취소 요청이 있습니다." }, { status: 409 });
  }

  const cancellationRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.reservationCancellationRequest.create({
      data: {
        reservationId: reservation.id,
        plannerId: session.user.id,
        vendorId: reservation.vendorId,
        reason
      }
    });

    await createWorkflowNotification(tx, {
      userId: reservation.vendorId,
      type: "RESERVATION_CANCELLATION_REQUESTED",
      title: "예약 취소 요청이 도착했습니다",
      message: `${reservation.eventPlan.title} 예약 취소 요청을 확인해 주세요.`,
      href: getVendorDashboardHref(),
      metadata: {
        planId: reservation.eventPlanId,
        reservationId: reservation.id,
        quoteRequestId: reservation.quoteRequestId ?? "",
        quoteResponseId: reservation.quoteResponseId ?? "",
        cancellationRequestId: created.id
      }
    });

    await createWorkflowActivity(tx, {
      actorId: session.user.id,
      planId: reservation.eventPlanId,
      vendorId: reservation.vendorId,
      quoteRequestId: reservation.quoteRequestId ?? null,
      quoteResponseId: reservation.quoteResponseId ?? null,
      reservationId: reservation.id,
      type: "RESERVATION_CANCELLATION_REQUESTED",
      message: "일반 사용자가 예약 취소 승인을 요청했습니다.",
      metadata: {
        cancellationRequestId: created.id
      }
    });

    return created;
  });

  revalidateReservationViews(reservation.eventPlanId);

  return Response.json({ ok: true, cancellationRequestId: cancellationRequest.id });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    return await handlePatch(request, context);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    return await handleDelete(request, context);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
