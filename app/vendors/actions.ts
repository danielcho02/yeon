"use server";

import { revalidatePath } from "next/cache";

import { QuoteStatus, ReservationStatus, UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { getActionError, isPrismaUniqueConstraintError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { mvpEventTypes } from "@/lib/step3.server";
import {
  getKstDayRange,
  parseDateOnlyToKst,
  vendorSupportsAnyServiceModule
} from "@/lib/step3.shared";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getVendorDashboardHref
} from "@/lib/workflow-events";

function revalidateReservationViews(eventPlanId: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${eventPlanId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

function isActiveQuoteRequestDuplicate(error: unknown) {
  return isPrismaUniqueConstraintError(error, [
    "QuoteRequest_active_planId_vendorId_key",
    "planId",
    "vendorId"
  ]);
}

export async function createQuoteRequest(formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { error: "로그인이 필요합니다." };
  if (session.user.role !== UserRole.GENERAL) {
    return { error: "일반 사용자만 견적 요청을 생성할 수 있습니다." };
  }

  const vendorId = formData.get("vendorId") as string | null;
  const eventPlanId = formData.get("eventPlanId") as string | null;
  const serviceDateRaw = formData.get("serviceDate") as string | null;
  const message = (formData.get("message") as string | null)?.trim() || null;
  const selectedItemIds = formData.getAll("selectedItemIds") as string[];
  const quotedAmountRaw = formData.get("quotedAmount") as string | null;
  const guestCountRaw = formData.get("guestCount") as string | null;

  if (!vendorId) return { error: "업체 정보가 없습니다." };
  if (!eventPlanId) return { error: "연결할 플랜을 선택해주세요." };
  if (selectedItemIds.length === 0) return { error: "최소 1개 이상의 항목을 선택해주세요." };

  const plan = await prisma.eventPlan.findFirst({
    where: {
      id: eventPlanId,
      ownerId: session.user.id,
      type: { in: mvpEventTypes }
    },
    select: { id: true, title: true, type: true, scheduledAt: true, guestTarget: true }
  });
  if (!plan) return { error: "유효하지 않은 플랜입니다." };

  const vendor = await prisma.user.findFirst({
    where: {
      id: vendorId,
      role: UserRole.VENDOR,
      vendorApprovalStatus: "APPROVED",
      isActive: true
    },
    select: {
      id: true,
      companyName: true,
      supportedEventTypes: true,
      supportedServiceModules: true
    }
  });
  if (!vendor) return { error: "업체를 찾을 수 없습니다." };
  if (!vendorSupportsAnyServiceModule(vendor, plan.type)) {
    return { error: "해당 행사 유형을 지원하지 않는 업체입니다." };
  }

  const activeRequest = await prisma.quoteRequest.findFirst({
    where: {
      planId: plan.id,
      vendorId: vendor.id,
      status: { in: [QuoteStatus.PENDING, QuoteStatus.RESPONDED, QuoteStatus.ACCEPTED] }
    },
    select: { id: true }
  });

  if (activeRequest) {
    return { error: "이미 진행 중인 견적 요청이 있습니다." };
  }

  // Fetch selected services to build snapshot + validate ownership
  const selectedServices = await prisma.vendorService.findMany({
    where: {
      id: { in: selectedItemIds },
      vendorId: vendor.id,
      isActive: true,
      eventType: plan.type
    },
    select: {
      id: true,
      catalogKey: true,
      name: true,
      basePrice: true,
      pricingType: true,
      module: true
    }
  });

  if (selectedServices.length === 0) {
    return { error: "선택한 항목을 찾을 수 없습니다." };
  }
  if (selectedServices.length !== selectedItemIds.length) {
    return { error: "일부 항목이 유효하지 않습니다. 다시 시도해주세요." };
  }

  const guestCount = Math.max(1, Number.parseInt(guestCountRaw ?? "1", 10) || 1);

  // Build snapshot + calculate total
  const selectedServiceOptions = selectedServices.map((svc) => {
    if (svc.pricingType === "PER_GUEST") {
      return {
        catalogKey: svc.catalogKey,
        name: svc.name,
        price: svc.basePrice,
        pricingType: "PER_GUEST",
        quantity: guestCount,
        subtotal: svc.basePrice * guestCount
      };
    }
    return {
      catalogKey: svc.catalogKey,
      name: svc.name,
      price: svc.basePrice,
      pricingType: "FLAT"
    };
  });

  const quotedAmount =
    Number.parseInt(quotedAmountRaw ?? "0", 10) ||
    selectedServiceOptions.reduce((sum, item) => {
      return sum + ("subtotal" in item && item.subtotal != null ? item.subtotal : (item as { price: number }).price);
    }, 0);

  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    return { error: "견적 예상 금액을 확인해주세요." };
  }

  // Use most-frequent module as primary service category
  const moduleCounts = selectedServices.reduce<Record<string, number>>((acc, svc) => {
    acc[svc.module] = (acc[svc.module] ?? 0) + 1;
    return acc;
  }, {});
  const primaryModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0][0];
  const serviceName = selectedServices.map((s) => s.name).join(", ");

  if (serviceDateRaw) {
    const { start, end } = getKstDayRange(serviceDateRaw);
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        vendorId: vendor.id,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        serviceDate: { gte: start, lte: end }
      },
      select: { serviceName: true }
    });
    if (conflictingReservation) {
      return {
        error: `같은 날짜에 이미 예약된 일정이 있습니다: ${conflictingReservation.serviceName}`
      };
    }
  }

  const serviceDate = serviceDateRaw ? parseDateOnlyToKst(serviceDateRaw) : plan.scheduledAt;

  try {
    await prisma.$transaction(async (tx) => {
      const quoteRequest = await tx.quoteRequest.create({
        data: {
          planId: plan.id,
          vendorId: vendor.id,
          requirements: message ?? serviceName,
          selectedModules: selectedItemIds,
          preferredDate: serviceDate,
          budget: quotedAmount,
          status: QuoteStatus.PENDING
        }
      });

      const reservation = await tx.reservation.create({
        data: {
          eventPlanId: plan.id,
          vendorId: vendor.id,
          quoteRequestId: quoteRequest.id,
          serviceName,
          serviceCategory: primaryModule,
          description: message,
          serviceDate,
          guestCount,
          quotedAmount,
          selectedServiceOptions,
          status: ReservationStatus.PENDING,
          notes: message
        }
      });

      await createWorkflowNotification(tx, {
        userId: vendor.id,
        type: "QUOTE_REQUEST_RECEIVED",
        title: "새 견적 요청",
        message: `${plan.title} 견적 요청이 도착했습니다.`,
        href: getVendorDashboardHref(),
        metadata: {
          planId: plan.id,
          vendorId: vendor.id,
          quoteRequestId: quoteRequest.id,
          reservationId: reservation.id,
          selectedItemIds,
          guestCount
        }
      });

      await createWorkflowActivity(tx, {
        actorId: session.user.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: quoteRequest.id,
        reservationId: reservation.id,
        type: "QUOTE_REQUEST_CREATED",
        message: "일반 사용자가 업체에 견적 요청을 보냈습니다.",
        metadata: {
          selectedItemIds,
          guestCount,
          quotedAmount
        }
      });
    });
  } catch (error) {
    if (isActiveQuoteRequestDuplicate(error)) {
      return { error: "이미 진행 중인 견적 요청이 있습니다." };
    }

    return { error: getActionError(error) };
  }

  revalidateReservationViews(eventPlanId);

  return { success: true };
}
