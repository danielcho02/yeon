import { revalidatePath } from "next/cache";

import { QuoteStatus, ReservationStatus, UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { getActionError, isDatabaseBusyError, isPrismaUniqueConstraintError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { mvpEventTypes } from "@/lib/step3.server";
import {
  getKstDayRange,
  getQuoteServiceModule,
  normalizePositiveInt,
  parseDateOnlyToKst,
  vendorSupportsServiceModule
} from "@/lib/step3.shared";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getVendorDashboardHref
} from "@/lib/workflow-events";

function isActiveQuoteRequestDuplicate(error: unknown) {
  return isPrismaUniqueConstraintError(error, [
    "QuoteRequest_active_planId_vendorId_key",
    "planId",
    "vendorId"
  ]);
}

async function handlePost(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.user.role !== UserRole.GENERAL) {
    return Response.json(
      { error: "일반 사용자만 견적 요청을 생성할 수 있습니다." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const eventPlanId = typeof body.eventPlanId === "string" ? body.eventPlanId : "";
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
  const serviceModule =
    typeof body.serviceModule === "string"
      ? body.serviceModule.trim()
      : typeof body.serviceCategory === "string"
      ? body.serviceCategory.trim()
      : "";
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const serviceDateInput =
    typeof body.serviceDate === "string" ? body.serviceDate : "";
  const guestCount = normalizePositiveInt(body.guestCount);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!eventPlanId || !vendorId || !serviceModule || !serviceDateInput) {
    return Response.json(
      { error: "행사, 업체, 서비스 모듈, 예약일은 필수입니다." },
      { status: 400 }
    );
  }

  const plan = await prisma.eventPlan.findFirst({
    where: {
      id: eventPlanId,
      ownerId: session.user.id,
      type: {
        in: mvpEventTypes
      }
    },
    select: {
      id: true,
      type: true,
      title: true,
      budget: true
    }
  });

  if (!plan) {
    return Response.json({ error: "예약할 행사 계획을 찾을 수 없습니다." }, { status: 404 });
  }

  const serviceModuleOption = getQuoteServiceModule(plan.type, serviceModule);

  if (!serviceModuleOption) {
    return Response.json({ error: "유효하지 않은 서비스 모듈입니다." }, { status: 400 });
  }

  const vendor = await prisma.user.findFirst({
    where: {
      id: vendorId,
      role: UserRole.VENDOR,
      vendorApprovalStatus: "APPROVED",
      isActive: true
    },
    select: {
      id: true,
      supportedEventTypes: true,
      supportedServiceModules: true
    }
  });

  if (!vendor) {
    return Response.json({ error: "예약 가능한 업체를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!vendorSupportsServiceModule(vendor, plan.type, serviceModuleOption.value)) {
    return Response.json(
      { error: "해당 행사 유형 또는 서비스 모듈을 지원하지 않는 업체입니다." },
      { status: 400 }
    );
  }

  const activeRequest = await prisma.quoteRequest.findFirst({
    where: {
      planId: plan.id,
      vendorId,
      status: { in: [QuoteStatus.PENDING, QuoteStatus.RESPONDED, QuoteStatus.ACCEPTED] }
    },
    select: { id: true }
  });

  if (activeRequest) {
    return Response.json(
      { error: "이미 진행 중인 견적 요청이 있습니다." },
      { status: 409 }
    );
  }

  const { start, end } = getKstDayRange(serviceDateInput);
  const conflictingReservation = await prisma.reservation.findFirst({
    where: {
      vendorId,
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
        error: `같은 날짜에 이미 예약된 일정이 있습니다: ${conflictingReservation.serviceName}`
      },
      { status: 409 }
    );
  }

  let quotedAmount = plan.budget;
  let serviceName = serviceModuleOption.label;

  if (serviceId) {
    const vendorService = await prisma.vendorService.findFirst({
      where: {
        id: serviceId,
        vendorId,
        isActive: true,
        eventType: plan.type,
        module: serviceModuleOption.value
      },
      select: { basePrice: true, name: true }
    });
    if (!vendorService) {
      return Response.json(
        { error: "선택한 서비스가 유효하지 않습니다." },
        { status: 400 }
      );
    }

    quotedAmount = vendorService.basePrice;
    serviceName = vendorService.name;
  }

  const serviceDate = parseDateOnlyToKst(serviceDateInput);

  try {
    await prisma.$transaction(async (tx) => {
      const quoteRequest = await tx.quoteRequest.create({
        data: {
          planId: eventPlanId,
          vendorId,
          requirements: notes || serviceName,
          selectedModules: [serviceId || serviceModuleOption.value],
          preferredDate: serviceDate,
          budget: quotedAmount,
          status: QuoteStatus.PENDING
        }
      });

      const reservation = await tx.reservation.create({
        data: {
          eventPlanId,
          vendorId,
          quoteRequestId: quoteRequest.id,
          serviceName,
          serviceCategory: serviceModuleOption.value,
          serviceDate,
          guestCount,
          quotedAmount,
          notes: notes || null,
          status: ReservationStatus.PENDING
        }
      });

      await createWorkflowNotification(tx, {
        userId: vendorId,
        type: "QUOTE_REQUEST_RECEIVED",
        title: "새 견적 요청",
        message: `${plan.title} 견적 요청이 도착했습니다.`,
        href: getVendorDashboardHref(),
        metadata: {
          planId: eventPlanId,
          vendorId,
          quoteRequestId: quoteRequest.id,
          reservationId: reservation.id,
          serviceModule: serviceModuleOption.value
        }
      });

      await createWorkflowActivity(tx, {
        actorId: session.user.id,
        planId: eventPlanId,
        vendorId,
        quoteRequestId: quoteRequest.id,
        reservationId: reservation.id,
        type: "QUOTE_REQUEST_CREATED",
        message: "일반 사용자가 API 경로로 견적 요청을 보냈습니다.",
        metadata: {
          serviceModule: serviceModuleOption.value,
          serviceId,
          guestCount: guestCount ?? 0,
          quotedAmount: quotedAmount ?? 0
        }
      });
    });
  } catch (error) {
    if (isActiveQuoteRequestDuplicate(error)) {
      return Response.json(
        { error: "이미 진행 중인 견적 요청이 있습니다." },
        { status: 409 }
      );
    }

    throw error;
  }

  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${eventPlanId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");

  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
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
}
