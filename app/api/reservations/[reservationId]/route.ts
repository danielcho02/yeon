import { revalidatePath } from "next/cache";

import { QuoteStatus, ReservationStatus, UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { assertQuoteTransition, assertReservationTransition } from "@/lib/state-machine";
import {
  getKstDayRange,
  normalizePositiveInt,
  parseDateOnlyToKst
} from "@/lib/step3.shared";

import type { ReservationStatus as SharedReservationStatus } from "@/types/reservation";
import type { QuoteStatus as SharedQuoteStatus } from "@/types/quote";

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
      quoteResponseId: true
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

function mapSharedReservationStatus(status: ReservationStatus): SharedReservationStatus {
  if (
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.REJECTED ||
    status === ReservationStatus.CHANGED ||
    status === ReservationStatus.CANCELED
  ) {
    return status;
  }

  if (status === ReservationStatus.CANCELLED) return "CANCELED";
  return "PENDING";
}

function mapSharedQuoteStatus(status: QuoteStatus): SharedQuoteStatus {
  if (status === QuoteStatus.RESPONDED || status === QuoteStatus.ACCEPTED || status === QuoteStatus.CANCELED) {
    return status;
  }

  return "PENDING";
}

function getInvalidTransitionResponse(
  current: ReservationStatus,
  next: SharedReservationStatus
) {
  try {
    assertReservationTransition(mapSharedReservationStatus(current), next);
    return null;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "예약 상태를 변경할 수 없습니다." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

  if (reservation.status === ReservationStatus.CANCELLED) {
    return Response.json({ error: "이미 취소된 예약입니다." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "update";
  const serviceDateInput =
    typeof body.serviceDate === "string" ? body.serviceDate : "";
  const guestCount = normalizePositiveInt(body.guestCount);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (action === "confirm") {
    return Response.json(
      { error: "일반 사용자는 견적 수락만 할 수 있습니다. 예약 확정은 업체가 진행합니다." },
      { status: 400 }
    );
  }

  if (!serviceDateInput) {
    return Response.json({ error: "변경할 예약일이 필요합니다." }, { status: 400 });
  }

  const { start, end } = getKstDayRange(serviceDateInput);
  const conflictingReservation = await prisma.reservation.findFirst({
    where: {
      id: {
        not: reservation.id
      },
      vendorId: reservation.vendorId,
      status: {
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED]
      },
      serviceDate: {
        gte: start,
        lte: end
      }
    },
    select: {
      id: true,
      serviceName: true
    }
  });

  if (conflictingReservation) {
    return Response.json(
      {
        error: `같은 날짜에 다른 예약이 있어 변경할 수 없습니다: ${conflictingReservation.serviceName}`
      },
      { status: 409 }
    );
  }

  await prisma.reservation.update({
    where: {
      id: reservation.id
    },
    data: {
      serviceDate: parseDateOnlyToKst(serviceDateInput),
      guestCount,
      notes: notes || null,
      status:
        reservation.status === ReservationStatus.CONFIRMED
          ? ReservationStatus.CONFIRMED
          : ReservationStatus.PENDING
    }
  });

  revalidateReservationViews(reservation.eventPlanId);

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  if (reservation.status === ReservationStatus.CANCELLED) {
    return Response.json({ error: "이미 취소된 예약입니다." }, { status: 400 });
  }

  const invalidTransitionResponse = getInvalidTransitionResponse(
    reservation.status,
    "CANCELED"
  );
  if (invalidTransitionResponse) return invalidTransitionResponse;

  await prisma.$transaction(async (tx) => {
    if (reservation.quoteRequestId) {
      const quoteRequest = await tx.quoteRequest.findFirst({
        where: {
          id: reservation.quoteRequestId,
          plan: {
            ownerId: session.user.id
          }
        },
        select: { id: true, status: true }
      });

      if (quoteRequest && quoteRequest.status !== QuoteStatus.CANCELED) {
        assertQuoteTransition(mapSharedQuoteStatus(quoteRequest.status), "CANCELED");
        await tx.quoteRequest.update({
          where: { id: quoteRequest.id },
          data: { status: QuoteStatus.CANCELED }
        });
      }
    }

    await tx.reservation.update({
      where: {
        id: reservation.id
      },
      data: {
        status: ReservationStatus.CANCELLED
      }
    });
  });

  revalidateReservationViews(reservation.eventPlanId);

  return Response.json({ ok: true });
}
