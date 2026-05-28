"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  Prisma,
  QuoteStatus as PrismaQuoteStatus,
  ReservationStatus as PrismaReservationStatus,
  UserRole,
  VendorApprovalStatus
} from "@/generated/prisma/client";
import {
  actionError,
  actionSuccess,
  getActionError,
  isPrismaUniqueConstraintError
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertQuoteTransition } from "@/lib/state-machine";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getPlanHref,
  getVendorConfirmationDueAt,
  getVendorDashboardHref
} from "@/lib/workflow-events";

import type { ActionResult } from "@/types/common";
import type {
  AcceptQuoteResponsePayload,
  AcceptQuoteResult,
  CreateQuoteRequestPayload,
  QuoteRequestForVendorDTO,
  QuoteRequestData,
  QuoteRequestWithResponses,
  QuoteResponseData,
  QuoteResponseModules,
  SubmitQuoteResponsePayload
} from "@/types/quote";
import type { VendorServiceModuleData } from "@/types/vendor-module";

import {
  mapQuoteRequest,
  mapQuoteRequestWithResponses,
  mapQuoteResponse,
  mapQuoteStatus,
  mapReservation,
  parseActionDate,
  requireGeneralUser,
  requireSessionUser,
  requireVendorUser
} from "./_utils";

const quoteModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    "VENUE",
    "PHOTO",
    "DRESS",
    "MAKEUP",
    "DECORATION",
    "CATERING",
    "INVITATION",
    "FUNERAL_HALL",
    "WREATH",
    "TRANSPORT",
    "CEREMONY",
    "MEAL",
    "OBITUARY"
  ]),
  price: z.number().int().nonnegative(),
  description: z.string().optional(),
  isSelected: z.boolean().optional()
});

const quoteResponseModulesSchema = z.object({
  basePackage: z.object({
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    description: z.string().min(1)
  }),
  includedModules: z.array(quoteModuleSchema),
  optionalModules: z.array(quoteModuleSchema),
  excludedModules: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      reason: z.string().min(1)
    })
  )
});

const createQuoteRequestSchema = z.object({
  planId: z.string().min(1),
  vendorId: z.string().min(1),
  requirements: z.string().trim().min(1),
  selectedModuleIds: z.array(z.string().min(1)).min(1),
  guestCount: z.number().int().positive().optional(),
  preferredDate: z.string().trim().min(1).optional(),
  budget: z.number().int().nonnegative().optional()
});

const submitQuoteResponseSchema = z.object({
  requestId: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
  modules: quoteResponseModulesSchema,
  totalPrice: z.number().int().nonnegative(),
  note: z.string().trim().optional()
});

const acceptQuoteResponseSchema = z.object({
  quoteResponseId: z.string().min(1),
  reservedDate: z.string().trim().min(1).optional()
});

const idsSchema = z.array(z.string().min(1)).min(1);

function revalidateQuoteViews(planId?: string, vendorId?: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  if (planId) revalidatePath(`/plans/${planId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
}

function calculateModulesTotal(modules: QuoteResponseModules) {
  return (
    modules.basePackage.price +
    modules.includedModules.reduce((sum, module) => sum + module.price, 0)
  );
}

function isActiveQuoteRequestDuplicate(error: unknown) {
  return isPrismaUniqueConstraintError(error, [
    "QuoteRequest_active_planId_vendorId_key",
    "planId",
    "vendorId"
  ]);
}

function isDuplicateQuoteResponse(error: unknown) {
  return isPrismaUniqueConstraintError(error, [
    "QuoteResponse_requestId_vendorId_key",
    "requestId",
    "vendorId"
  ]);
}

function normalizeVendorModulePricingType(pricingType: string): "FLAT" | "PER_GUEST" {
  return pricingType === "PER_GUEST" ? "PER_GUEST" : "FLAT";
}

function calculateRequestModuleTotal(
  modules: Array<{
    category: string;
    price: number;
    pricingType: string;
  }>,
  guestCount: number
) {
  return modules.reduce((sum, module) => {
    const pricingType = normalizeVendorModulePricingType(module.pricingType);
    return sum + (pricingType === "PER_GUEST" ? module.price * guestCount : module.price);
  }, 0);
}

function getReservationServiceName(modules: QuoteResponseModules) {
  return modules.basePackage.name || modules.includedModules[0]?.name || "모듈형 견적 예약";
}

function getReservationServiceCategory(modules: QuoteResponseModules) {
  return modules.includedModules[0]?.category ?? modules.optionalModules[0]?.category ?? null;
}

function buildReservationOptions(
  modules: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    pricingType: string;
  }>,
  guestCount: number
) {
  return modules.map((module) => {
    const pricingType = normalizeVendorModulePricingType(module.pricingType);
    return {
      catalogKey: module.id,
      name: module.name,
      price: module.price,
      pricingType,
      ...(pricingType === "PER_GUEST"
        ? { quantity: guestCount, subtotal: module.price * guestCount }
        : {})
    };
  });
}

function buildRequestServiceName(modules: Array<{ name: string }>) {
  if (modules.length === 0) return "모듈형 견적 요청";
  if (modules.length === 1) return modules[0].name;
  return `${modules[0].name} 외 ${modules.length - 1}개`;
}

function mapVendorServiceModuleData(module: {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  price: number;
  pricingType: string;
  description: string | null;
  isBaseIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
}): VendorServiceModuleData {
  return {
    id: module.id,
    vendorId: module.vendorId,
    name: module.name,
    category: module.category as VendorServiceModuleData["category"],
    price: module.price,
    pricingType: normalizeVendorModulePricingType(module.pricingType),
    description: module.description,
    isBaseIncluded: module.isBaseIncluded,
    isActive: module.isActive,
    sortOrder: module.sortOrder
  };
}

function stringArrayFromJson(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function attachSelectedModuleDetails<
  T extends { selectedModules: Prisma.JsonValue | null }
>(requests: T[]): Promise<Array<T & { selectedModuleDetails: VendorServiceModuleData[] }>> {
  const moduleIds = Array.from(
    new Set(requests.flatMap((request) => stringArrayFromJson(request.selectedModules)))
  );

  if (moduleIds.length === 0) {
    return requests.map((request) => ({ ...request, selectedModuleDetails: [] }));
  }

  const modules = await prisma.vendorServiceModule.findMany({
    where: { id: { in: moduleIds } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
  });
  const moduleMap = new Map(modules.map((module) => [module.id, mapVendorServiceModuleData(module)]));

  return requests.map((request) => ({
    ...request,
    selectedModuleDetails: stringArrayFromJson(request.selectedModules)
      .map((id) => moduleMap.get(id))
      .filter((module): module is VendorServiceModuleData => Boolean(module))
  }));
}

export async function createQuoteRequest(
  payload: CreateQuoteRequestPayload
): Promise<ActionResult<QuoteRequestData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createQuoteRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: parsed.data.planId, ownerId: user.id, type: { in: ["WEDDING", "FUNERAL"] } },
      select: {
        id: true,
        ownerId: true,
        title: true,
        type: true,
        scheduledAt: true,
        guestTarget: true,
        budget: true
      }
    });

    if (!plan) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const vendor = await prisma.user.findFirst({
      where: {
        id: parsed.data.vendorId,
        role: UserRole.VENDOR,
        vendorApprovalStatus: VendorApprovalStatus.APPROVED,
        isActive: true
      },
      select: { id: true, name: true, companyName: true }
    });

    if (!vendor) {
      return actionError("업체를 찾을 수 없습니다.", "VENDOR_NOT_FOUND");
    }

    const activeRequest = await prisma.quoteRequest.findFirst({
      where: {
        planId: plan.id,
        vendorId: vendor.id,
        status: {
          in: [
            PrismaQuoteStatus.PENDING,
            PrismaQuoteStatus.RESPONDED,
            PrismaQuoteStatus.ACCEPTED
          ]
        }
      },
      select: { id: true, status: true }
    });

    if (activeRequest) {
      return actionError(
        "이미 진행 중인 견적 요청이 있습니다.",
        "QUOTE_REQUEST_ALREADY_EXISTS"
      );
    }

    const selectedModuleIds = Array.from(new Set(parsed.data.selectedModuleIds));

    const modules = await prisma.vendorServiceModule.findMany({
      where: {
        id: { in: selectedModuleIds },
        vendorId: vendor.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        pricingType: true,
        description: true,
        isBaseIncluded: true,
        sortOrder: true
      },
      orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }]
    });

    if (modules.length !== selectedModuleIds.length) {
      return actionError("선택한 모듈이 유효하지 않습니다.", "INVALID_MODULES");
    }

    const preferredDate = parseActionDate(parsed.data.preferredDate);
    const guestCount = parsed.data.guestCount ?? plan.guestTarget ?? 1;
    const budget = parsed.data.budget ?? plan.budget ?? null;
    const quotedAmount = calculateRequestModuleTotal(modules, guestCount);

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteRequest.create({
        data: {
          planId: plan.id,
          vendorId: vendor.id,
          requirements: parsed.data.requirements,
          selectedModules: selectedModuleIds,
          preferredDate,
          budget,
          status: PrismaQuoteStatus.PENDING
        }
      });

      const reservation = await tx.reservation.create({
        data: {
          eventPlanId: plan.id,
          vendorId: vendor.id,
          quoteRequestId: created.id,
          serviceName: buildRequestServiceName(modules),
          serviceCategory: modules[0]?.category ?? null,
          description: parsed.data.requirements,
          serviceDate: preferredDate ?? plan.scheduledAt ?? null,
          guestCount,
          quotedAmount,
          confirmedAmount: null,
          selectedServiceOptions: buildReservationOptions(
            modules,
            guestCount
          ) as Prisma.InputJsonValue,
          status: PrismaReservationStatus.PENDING,
          notes: parsed.data.requirements
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
          quoteRequestId: created.id,
          reservationId: reservation.id,
          selectedModuleIds,
          guestCount
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: created.id,
        reservationId: reservation.id,
        type: "QUOTE_REQUEST_CREATED",
        message: "일반 사용자가 업체에 견적 요청을 보냈습니다.",
        metadata: {
          eventType: plan.type,
          selectedModuleIds,
          guestCount,
          budget: budget ?? 0,
          estimatedAmount: quotedAmount
        }
      });

      return created;
    });

    revalidateQuoteViews(plan.id, vendor.id);
    return actionSuccess(mapQuoteRequest(request));
  } catch (error) {
    if (isActiveQuoteRequestDuplicate(error)) {
      return actionError(
        "이미 진행 중인 견적 요청이 있습니다.",
        "QUOTE_REQUEST_ALREADY_EXISTS"
      );
    }

    return actionError(getActionError(error), "CREATE_QUOTE_REQUEST_FAILED");
  }
}

export async function submitQuoteResponse(
  payload: SubmitQuoteResponsePayload
): Promise<ActionResult<QuoteResponseData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = submitQuoteResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const request = await prisma.quoteRequest.findFirst({
      where: { id: parsed.data.requestId, vendorId: vendor.id },
      include: {
        plan: {
          select: {
            id: true,
            ownerId: true,
            title: true
          }
        },
        reservation: true
      }
    });

    if (!request) {
      return actionError("견적 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const existingResponse = await prisma.quoteResponse.findFirst({
      where: { requestId: request.id, vendorId: vendor.id },
      select: { id: true }
    });

    if (existingResponse) {
      return actionError("이미 제출한 견적 응답이 있습니다.", "QUOTE_RESPONSE_ALREADY_EXISTS");
    }

    const currentStatus = mapQuoteStatus(request.status);

    if (currentStatus !== "PENDING") {
      return actionError("응답 가능한 견적 요청이 아닙니다.", "INVALID_QUOTE_STATUS");
    }

    assertQuoteTransition(currentStatus, "RESPONDED");

    const totalPrice = calculateModulesTotal(parsed.data.modules);
    if (parsed.data.basePrice !== parsed.data.modules.basePackage.price) {
      return actionError("기본 패키지 금액이 일치하지 않습니다.", "QUOTE_BASE_PRICE_MISMATCH");
    }

    if (parsed.data.totalPrice !== totalPrice) {
      return actionError("견적 총액이 선택 항목 합계와 일치하지 않습니다.", "QUOTE_TOTAL_MISMATCH");
    }

    const response = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteResponse.create({
        data: {
          requestId: request.id,
          vendorId: request.vendorId,
          basePrice: parsed.data.basePrice,
          modules: parsed.data.modules,
          totalPrice,
          note: parsed.data.note ?? null
        },
        include: { vendor: true }
      });

      await tx.quoteRequest.update({
        where: { id: request.id },
        data: { status: PrismaQuoteStatus.RESPONDED }
      });

      if (request.reservation) {
        await tx.reservation.update({
          where: { id: request.reservation.id },
          data: {
            quoteResponseId: created.id,
            quotedAmount: totalPrice,
            confirmedAmount: null,
            selectedServiceOptions: parsed.data.modules as Prisma.InputJsonValue,
            notes: parsed.data.note ?? request.reservation.notes
          }
        });
      }

      await createWorkflowNotification(tx, {
        userId: request.plan.ownerId,
        type: "QUOTE_RESPONSE_RECEIVED",
        title: "견적 응답 도착",
        message: `${request.plan.title}에 대한 업체 견적이 도착했습니다.`,
        href: getPlanHref(request.planId),
        metadata: {
          planId: request.planId,
          vendorId: request.vendorId,
          quoteRequestId: request.id,
          quoteResponseId: created.id,
          reservationId: request.reservation?.id ?? "",
          totalPrice
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: request.planId,
        vendorId: vendor.id,
        quoteRequestId: request.id,
        quoteResponseId: created.id,
        reservationId: request.reservation?.id ?? null,
        type: "QUOTE_RESPONSE_SUBMITTED",
        message: "업체가 견적 응답을 제출했습니다.",
        metadata: {
          totalPrice,
          hasNote: Boolean(parsed.data.note)
        }
      });

      return created;
    });

    revalidateQuoteViews(request.planId, request.vendorId);
    return actionSuccess(mapQuoteResponse(response));
  } catch (error) {
    if (isDuplicateQuoteResponse(error)) {
      return actionError("이미 제출한 견적 응답이 있습니다.", "QUOTE_RESPONSE_ALREADY_EXISTS");
    }

    return actionError(getActionError(error), "SUBMIT_QUOTE_RESPONSE_FAILED");
  }
}

export async function acceptQuoteResponse(
  payload: AcceptQuoteResponsePayload
): Promise<ActionResult<AcceptQuoteResult>> {
  try {
    const user = await requireGeneralUser();
    const parsed = acceptQuoteResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const response = await prisma.quoteResponse.findFirst({
      where: {
        id: parsed.data.quoteResponseId,
        request: {
          plan: {
            ownerId: user.id
          }
        }
      },
      include: {
        vendor: true,
        reservation: {
          include: {
            vendor: true,
            quoteResponse: {
              include: {
                vendor: true
              }
            }
          }
        },
        request: {
          include: {
            plan: true,
            reservation: {
              include: {
                vendor: true,
                quoteResponse: {
                  include: {
                    vendor: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!response) {
      return actionError("견적 응답을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const currentStatus = mapQuoteStatus(response.request.status);

    if (currentStatus === "ACCEPTED") {
      return actionError("이미 수락된 견적 요청입니다.", "QUOTE_ALREADY_ACCEPTED");
    }

    if (currentStatus !== "RESPONDED") {
      return actionError(
        "업체 응답이 도착한 견적만 수락할 수 있습니다.",
        "INVALID_QUOTE_STATUS"
      );
    }

    assertQuoteTransition(currentStatus, "ACCEPTED");

    const modules = response.modules as unknown as QuoteResponseModules;
    const serviceDate =
      parseActionDate(parsed.data.reservedDate) ??
      response.request.preferredDate ??
      response.request.plan.scheduledAt ??
      null;
    const vendorConfirmationDueAt = getVendorConfirmationDueAt();

    const result = await prisma.$transaction(async (tx) => {
      const accepted = await tx.quoteRequest.updateMany({
        where: { id: response.requestId, status: PrismaQuoteStatus.RESPONDED },
        data: { status: PrismaQuoteStatus.ACCEPTED }
      });

      if (accepted.count !== 1) {
        throw new Error("이미 수락되었거나 수락할 수 없는 견적입니다.");
      }

      const existingReservation = response.reservation ?? response.request.reservation;
      const reservation = existingReservation
        ? await tx.reservation.update({
            where: { id: existingReservation.id },
            data: {
              quoteRequestId: response.requestId,
              quoteResponseId: response.id,
              serviceDate: existingReservation.serviceDate ?? serviceDate,
              quotedAmount: response.totalPrice,
              confirmedAmount: null,
              vendorConfirmationDueAt,
              selectedServiceOptions: response.modules as Prisma.InputJsonValue,
              status: PrismaReservationStatus.PENDING,
              notes:
                existingReservation.notes ??
                "견적 응답 수락으로 생성된 예약입니다. 업체 확정 대기 중입니다."
            },
            include: {
              vendor: true,
              quoteResponse: {
                include: {
                  vendor: true
                }
              }
            }
          })
        : await tx.reservation.create({
            data: {
              eventPlanId: response.request.planId,
              vendorId: response.vendorId,
              quoteRequestId: response.requestId,
              quoteResponseId: response.id,
              serviceName: getReservationServiceName(modules),
              serviceCategory: getReservationServiceCategory(modules),
              serviceDate,
              guestCount: response.request.plan.guestTarget,
              quotedAmount: response.totalPrice,
              confirmedAmount: null,
              vendorConfirmationDueAt,
              selectedServiceOptions: response.modules as Prisma.InputJsonValue,
              status: PrismaReservationStatus.PENDING,
              notes: "견적 응답 수락으로 생성된 예약입니다. 업체 확정 대기 중입니다."
            },
            include: {
              vendor: true,
              quoteResponse: {
                include: {
                  vendor: true
                }
              }
            }
          });

      const quoteRequest = await tx.quoteRequest.findUniqueOrThrow({
        where: { id: response.requestId }
      });

      await createWorkflowNotification(tx, {
        userId: response.vendorId,
        type: "QUOTE_RESPONSE_ACCEPTED",
        title: "견적이 수락되었습니다",
        message: `${response.request.plan.title} 견적이 수락되었습니다. 예약을 최종 확정해 주세요.`,
        href: getVendorDashboardHref(),
        metadata: {
          planId: response.request.planId,
          quoteRequestId: response.requestId,
          quoteResponseId: response.id,
          reservationId: reservation.id,
          vendorConfirmationDueAt: vendorConfirmationDueAt.toISOString()
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: response.request.planId,
        vendorId: response.vendorId,
        quoteRequestId: response.requestId,
        quoteResponseId: response.id,
        reservationId: reservation.id,
        type: "QUOTE_RESPONSE_ACCEPTED",
        message: "일반 사용자가 견적 응답을 수락했고 업체 최종 확정을 기다립니다.",
        metadata: {
          totalPrice: response.totalPrice,
          vendorConfirmationDueAt: vendorConfirmationDueAt.toISOString()
        }
      });

      return { quoteRequest, reservation };
    });

    revalidateQuoteViews(response.request.planId, response.vendorId);
    return actionSuccess({
      quoteRequest: mapQuoteRequest(result.quoteRequest),
      quoteResponse: mapQuoteResponse(response),
      reservation: mapReservation(result.reservation),
      nextAction:
        result.reservation.status === PrismaReservationStatus.CONFIRMED
          ? "confirmed"
          : "reservation_pending"
    });
  } catch (error) {
    return actionError(getActionError(error), "ACCEPT_QUOTE_RESPONSE_FAILED");
  }
}

export async function acceptQuote(requestId: string): Promise<ActionResult<QuoteRequestData>> {
  try {
    const user = await requireGeneralUser();

    if (!requestId) {
      return actionError("견적 요청 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const latestResponse = await prisma.quoteResponse.findFirst({
      where: {
        requestId,
        request: {
          plan: {
            ownerId: user.id
          }
        }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    if (!latestResponse) {
      return actionError("수락할 견적 응답이 없습니다.", "QUOTE_RESPONSE_REQUIRED");
    }

    const accepted = await acceptQuoteResponse({ quoteResponseId: latestResponse.id });

    if (!accepted.success) {
      return actionError(accepted.error, accepted.code);
    }

    return actionSuccess(accepted.data.quoteRequest);
  } catch (error) {
    return actionError(getActionError(error), "ACCEPT_QUOTE_FAILED");
  }
}

export async function cancelQuote(requestId: string): Promise<ActionResult<QuoteRequestData>> {
  try {
    const user = await requireSessionUser();

    if (!requestId) {
      return actionError("견적 요청 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const request = await prisma.quoteRequest.findFirst({
      where: {
        id: requestId,
        OR: [
          { plan: { ownerId: user.id } },
          ...(user.role === UserRole.VENDOR ? [{ vendorId: user.id }] : [])
        ]
      }
    });

    if (!request) {
      return actionError("견적 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    assertQuoteTransition(mapQuoteStatus(request.status), "CANCELED");

    const updated = await prisma.quoteRequest.update({
      where: { id: request.id },
      data: { status: PrismaQuoteStatus.CANCELED }
    });

    revalidateQuoteViews(updated.planId, updated.vendorId);
    return actionSuccess(mapQuoteRequest(updated));
  } catch (error) {
    return actionError(getActionError(error), "CANCEL_QUOTE_FAILED");
  }
}

export async function calculateQuoteTotal(
  moduleIds: string[]
): Promise<ActionResult<{ totalPrice: number }>> {
  try {
    await requireSessionUser();
    const parsed = idsSchema.safeParse(moduleIds);

    if (!parsed.success) {
      return actionError("모듈 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const modules = await prisma.vendorServiceModule.findMany({
      where: { id: { in: parsed.data }, isActive: true },
      select: { price: true }
    });

    if (modules.length !== parsed.data.length) {
      return actionError("유효하지 않은 모듈이 포함되어 있습니다.", "INVALID_MODULES");
    }

    return actionSuccess({
      totalPrice: modules.reduce((sum, module) => sum + module.price, 0)
    });
  } catch (error) {
    return actionError(getActionError(error), "CALCULATE_QUOTE_TOTAL_FAILED");
  }
}

export async function getQuotesByPlan(
  planId: string
): Promise<ActionResult<QuoteRequestWithResponses[]>> {
  try {
    const user = await requireGeneralUser();

    if (!planId) {
      return actionError("플랜 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: planId, ownerId: user.id },
      select: { id: true }
    });

    if (!plan) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const requests = await prisma.quoteRequest.findMany({
      where: { planId: plan.id },
      include: {
        vendor: true,
        plan: {
          select: {
            id: true,
            title: true,
            type: true,
            scheduledAt: true,
            region: true,
            guestTarget: true,
            budget: true
          }
        },
        reservation: {
          include: {
            vendor: true,
            quoteResponse: {
              include: { vendor: true }
            }
          }
        },
        responses: {
          include: {
            vendor: true,
            reservation: {
              include: {
                vendor: true,
                quoteResponse: {
                  include: { vendor: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const requestsWithModules = await attachSelectedModuleDetails(requests);

    return actionSuccess(requestsWithModules.map(mapQuoteRequestWithResponses));
  } catch (error) {
    return actionError(getActionError(error), "GET_QUOTES_BY_PLAN_FAILED");
  }
}

export async function getQuoteRequestsByPlan(
  planId: string
): Promise<ActionResult<QuoteRequestWithResponses[]>> {
  return getQuotesByPlan(planId);
}

export async function getVendorServiceModules(
  vendorId: string
): Promise<ActionResult<VendorServiceModuleData[]>> {
  try {
    await requireSessionUser();

    if (!vendorId) {
      return actionError("업체 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const modules = await prisma.vendorServiceModule.findMany({
      where: { vendorId, isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
    });

    return actionSuccess(modules.map(mapVendorServiceModuleData));
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_MODULES_FAILED");
  }
}

export async function getQuoteRequestsForVendor(): Promise<
  ActionResult<QuoteRequestForVendorDTO[]>
> {
  try {
    const vendor = await requireVendorUser();

    const requests = await prisma.quoteRequest.findMany({
      where: { vendorId: vendor.id },
      include: {
        vendor: true,
        plan: {
          select: {
            id: true,
            title: true,
            type: true,
            scheduledAt: true,
            region: true,
            guestTarget: true,
            budget: true
          }
        },
        reservation: {
          include: {
            vendor: true,
            quoteResponse: {
              include: { vendor: true }
            }
          }
        },
        responses: {
          include: {
            vendor: true,
            reservation: {
              include: {
                vendor: true,
                quoteResponse: {
                  include: { vendor: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const requestsWithModules = await attachSelectedModuleDetails(requests);

    return actionSuccess(requestsWithModules.map(mapQuoteRequestWithResponses));
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_QUOTE_REQUESTS_FAILED");
  }
}

export async function getVendorQuoteRequests(): Promise<
  ActionResult<QuoteRequestForVendorDTO[]>
> {
  return getQuoteRequestsForVendor();
}
