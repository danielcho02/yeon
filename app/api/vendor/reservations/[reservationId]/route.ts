import { revalidatePath } from "next/cache";

import {
  Prisma,
  QuoteStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus
} from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { assertQuoteTransition } from "@/lib/state-machine";
import {
  getKstDayRange,
  normalizePositiveInt,
  parseDateOnlyToKst
} from "@/lib/step3.shared";

import type { QuoteStatus as SharedQuoteStatus } from "@/types/quote";

type RouteContext = {
  params: {
    reservationId: string;
  };
};

async function getVendorReservation(vendorId: string, reservationId: string) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      vendorId
    },
    select: {
      id: true,
      eventPlanId: true,
      vendorId: true,
      status: true
      ,
      quoteRequestId: true,
      quoteResponseId: true,
      serviceName: true,
      serviceCategory: true,
      description: true,
      selectedServiceOptions: true
    }
  });
}

function revalidateReservationViews(eventPlanId: string) {
  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${eventPlanId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

function mapQuoteStatus(status: QuoteStatus): SharedQuoteStatus {
  if (status === QuoteStatus.RESPONDED || status === QuoteStatus.ACCEPTED || status === QuoteStatus.CANCELED) {
    return status;
  }

  return "PENDING";
}

function mapLegacyCategory(category: string | null) {
  const map: Record<string, string> = {
    venue: "VENUE",
    studio: "PHOTO",
    dress: "DRESS",
    makeup: "MAKEUP",
    floral: "DECORATION",
    weddingOther: "CEREMONY",
    funeralHall: "FUNERAL_HALL",
    altarFloral: "WREATH",
    hearse: "TRANSPORT",
    cremation: "CEREMONY",
    ossuary: "CEREMONY",
    shroud: "CEREMONY",
    funeralOther: "OBITUARY"
  };

  return category ? map[category] ?? category : "CEREMONY";
}

function buildQuoteResponseModules(
  reservation: Awaited<ReturnType<typeof getVendorReservation>>,
  confirmedAmount: number,
  notes: string
) {
  const options = Array.isArray(reservation?.selectedServiceOptions)
    ? reservation.selectedServiceOptions
    : [];

  return {
    basePackage: {
      name: reservation?.serviceName ?? "업체 견적 제안",
      price: confirmedAmount,
      description: notes || reservation?.description || "업체가 제출한 견적 제안입니다."
    },
    includedModules: options.map((option, index) => {
      const record = option && typeof option === "object" ? option as Record<string, unknown> : {};

      return {
        id: typeof record.catalogKey === "string" && record.catalogKey ? record.catalogKey : `legacy-${index}`,
        name: typeof record.name === "string" ? record.name : `선택 항목 ${index + 1}`,
        category: mapLegacyCategory(reservation?.serviceCategory ?? null),
        price: typeof record.subtotal === "number"
          ? record.subtotal
          : typeof record.price === "number"
            ? record.price
            : 0
      };
    }),
    optionalModules: [],
    excludedModules: []
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id || session.user.role !== UserRole.VENDOR) {
    return Response.json({ error: "업체 계정으로 로그인해 주세요." }, { status: 401 });
  }

  const vendor = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      role: UserRole.VENDOR,
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED
    },
    select: {
      id: true
    }
  });

  if (!vendor) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  const reservation = await getVendorReservation(
    vendor.id,
    context.params.reservationId
  );

  if (!reservation) {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return Response.json({ error: "이미 종료된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "quote";
  const serviceDateInput =
    typeof body.serviceDate === "string" ? body.serviceDate : "";
  const confirmedAmount = normalizePositiveInt(body.confirmedAmount);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (action === "complete") {
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      return Response.json(
        { error: "확정된 예약만 완료 처리할 수 있습니다." },
        { status: 400 }
      );
    }

    await prisma.reservation.update({
      where: {
        id: reservation.id
      },
      data: {
        status: ReservationStatus.COMPLETED,
        notes: notes || undefined
      }
    });

    revalidateReservationViews(reservation.eventPlanId);

    return Response.json({ ok: true });
  }

  if (reservation.status !== ReservationStatus.PENDING) {
    return Response.json({ error: "응답 가능한 요청이 아닙니다." }, { status: 400 });
  }

  if (action === "decline") {
    await prisma.$transaction(async (tx) => {
      if (reservation.quoteRequestId) {
        const quoteRequest = await tx.quoteRequest.findFirst({
          where: { id: reservation.quoteRequestId, vendorId: vendor.id },
          select: { id: true, status: true }
        });

        if (quoteRequest) {
          assertQuoteTransition(mapQuoteStatus(quoteRequest.status), "CANCELED");
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
          status: ReservationStatus.CANCELLED,
          notes: notes || "업체에서 일정 불가로 응답했습니다."
        }
      });
    });

    revalidateReservationViews(reservation.eventPlanId);

    return Response.json({ ok: true });
  }

  if (!serviceDateInput || !confirmedAmount) {
    return Response.json(
      { error: "견적 금액과 가능 일정을 함께 입력해 주세요." },
      { status: 400 }
    );
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

  const serviceDate = parseDateOnlyToKst(serviceDateInput);

  const syncResult = await prisma.$transaction(async (tx) => {
    let quoteResponseId = reservation.quoteResponseId;

    if (reservation.quoteRequestId) {
      const quoteRequest = await tx.quoteRequest.findFirst({
        where: { id: reservation.quoteRequestId, vendorId: vendor.id },
        select: { id: true, status: true }
      });

      if (!quoteRequest) {
        throw new Error("연결된 견적 요청을 찾을 수 없습니다.");
      }

      const quoteStatus = mapQuoteStatus(quoteRequest.status);

      if (quoteStatus === "PENDING") {
        assertQuoteTransition(quoteStatus, "RESPONDED");
      } else if (quoteStatus !== "RESPONDED") {
        throw new Error("응답 가능한 견적 요청이 아닙니다.");
      }

      const modules = buildQuoteResponseModules(reservation, confirmedAmount, notes);
      const existingQuoteResponse = quoteResponseId
        ? null
        : await tx.quoteResponse.findFirst({
            where: { requestId: quoteRequest.id, vendorId: vendor.id },
            select: { id: true }
          });
      const quoteResponse = quoteResponseId
        ? await tx.quoteResponse.update({
            where: { id: quoteResponseId },
            data: {
              basePrice: confirmedAmount,
              modules: modules as Prisma.InputJsonValue,
              totalPrice: confirmedAmount,
              note: notes || null
            },
            select: { id: true }
          })
        : existingQuoteResponse
        ? await tx.quoteResponse.update({
            where: { id: existingQuoteResponse.id },
            data: {
              basePrice: confirmedAmount,
              modules: modules as Prisma.InputJsonValue,
              totalPrice: confirmedAmount,
              note: notes || null
            },
            select: { id: true }
          })
        : await tx.quoteResponse.create({
            data: {
              requestId: quoteRequest.id,
              vendorId: vendor.id,
              basePrice: confirmedAmount,
              modules: modules as Prisma.InputJsonValue,
              totalPrice: confirmedAmount,
              note: notes || null
            },
            select: { id: true }
          });

      quoteResponseId = quoteResponse.id;

      await tx.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: { status: QuoteStatus.RESPONDED }
      });
    }

    await tx.reservation.update({
      where: {
        id: reservation.id
      },
      data: {
        quoteResponseId,
        confirmedAmount,
        serviceDate,
        notes: notes || null,
        status: ReservationStatus.PENDING
      }
    });

    return { quoteResponseId };
  });

  void syncResult;

  revalidateReservationViews(reservation.eventPlanId);

  return Response.json({ ok: true });
}
