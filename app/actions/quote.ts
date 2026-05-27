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
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertQuoteTransition } from "@/lib/state-machine";

import type { ActionResult } from "@/types/common";
import type {
  AcceptQuoteResponsePayload,
  AcceptQuoteResult,
  CreateQuoteRequestPayload,
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

function getReservationServiceName(modules: QuoteResponseModules) {
  return modules.basePackage.name || modules.includedModules[0]?.name || "모듈형 견적 예약";
}

function getReservationServiceCategory(modules: QuoteResponseModules) {
  return modules.includedModules[0]?.category ?? modules.optionalModules[0]?.category ?? null;
}

function buildReservationOptions(
  modules: Array<{ id: string; name: string; price: number }>
) {
  return modules.map((module) => ({
    catalogKey: module.id,
    name: module.name,
    price: module.price,
    pricingType: "FLAT"
  }));
}

function buildRequestServiceName(modules: Array<{ name: string }>) {
  if (modules.length === 0) return "모듈형 견적 요청";
  if (modules.length === 1) return modules[0].name;
  return `${modules[0].name} 외 ${modules.length - 1}개`;
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
      select: { id: true, type: true, scheduledAt: true, guestTarget: true, budget: true }
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
      select: { id: true }
    });

    if (!vendor) {
      return actionError("업체를 찾을 수 없습니다.", "VENDOR_NOT_FOUND");
    }

    const modules = await prisma.vendorServiceModule.findMany({
      where: {
        id: { in: parsed.data.selectedModuleIds },
        vendorId: vendor.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        description: true,
        isBaseIncluded: true,
        sortOrder: true
      },
      orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }]
    });

    if (modules.length !== new Set(parsed.data.selectedModuleIds).size) {
      return actionError("선택한 모듈이 유효하지 않습니다.", "INVALID_MODULES");
    }

    const preferredDate = parseActionDate(parsed.data.preferredDate);
    const quotedAmount =
      parsed.data.budget ??
      modules.reduce((sum, module) => sum + module.price, 0) ??
      plan.budget;

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteRequest.create({
        data: {
          planId: plan.id,
          vendorId: vendor.id,
          requirements: parsed.data.requirements,
          selectedModules: parsed.data.selectedModuleIds,
          preferredDate,
          budget: parsed.data.budget ?? null,
          status: PrismaQuoteStatus.PENDING
        }
      });

      await tx.reservation.create({
        data: {
          eventPlanId: plan.id,
          vendorId: vendor.id,
          quoteRequestId: created.id,
          serviceName: buildRequestServiceName(modules),
          serviceCategory: modules[0]?.category ?? null,
          description: parsed.data.requirements,
          serviceDate: preferredDate ?? plan.scheduledAt ?? null,
          guestCount: plan.guestTarget,
          quotedAmount,
          confirmedAmount: null,
          selectedServiceOptions: buildReservationOptions(modules) as Prisma.InputJsonValue,
          status: PrismaReservationStatus.PENDING,
          notes: parsed.data.requirements
        }
      });

      return created;
    });

    revalidateQuoteViews(plan.id, vendor.id);
    return actionSuccess(mapQuoteRequest(request));
  } catch (error) {
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
        reservation: true
      }
    });

    if (!request) {
      return actionError("견적 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const currentStatus = mapQuoteStatus(request.status);

    if (currentStatus === "PENDING") {
      assertQuoteTransition(currentStatus, "RESPONDED");
    } else if (currentStatus !== "RESPONDED") {
      return actionError("응답 가능한 견적 요청이 아닙니다.", "INVALID_QUOTE_STATUS");
    }

    const totalPrice = calculateModulesTotal(parsed.data.modules);
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
            confirmedAmount: totalPrice,
            selectedServiceOptions: parsed.data.modules as Prisma.InputJsonValue,
            notes: parsed.data.note ?? request.reservation.notes
          }
        });
      }

      return created;
    });

    revalidateQuoteViews(request.planId, request.vendorId);
    return actionSuccess(mapQuoteResponse(response));
  } catch (error) {
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

    if (currentStatus !== "ACCEPTED") {
      assertQuoteTransition(currentStatus, "ACCEPTED");
    }

    const modules = response.modules as unknown as QuoteResponseModules;
    const serviceDate =
      parseActionDate(parsed.data.reservedDate) ??
      response.request.preferredDate ??
      response.request.plan.scheduledAt ??
      null;

    const result = await prisma.$transaction(async (tx) => {
      const quoteRequest =
        currentStatus === "ACCEPTED"
          ? response.request
          : await tx.quoteRequest.update({
              where: { id: response.requestId },
              data: { status: PrismaQuoteStatus.ACCEPTED }
            });

      const existingReservation = response.reservation ?? response.request.reservation;
      const reservation = existingReservation
        ? await tx.reservation.update({
            where: { id: existingReservation.id },
            data: {
              quoteRequestId: response.requestId,
              quoteResponseId: response.id,
              serviceDate: existingReservation.serviceDate ?? serviceDate,
              quotedAmount: response.totalPrice,
              confirmedAmount: existingReservation.confirmedAmount ?? response.totalPrice,
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
              confirmedAmount: response.totalPrice,
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
    const parsed = idsSchema.safeParse(moduleIds);

    if (!parsed.success) {
      return actionError("모듈 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const modules = await prisma.vendorServiceModule.findMany({
      where: { id: { in: parsed.data }, isActive: true },
      select: { price: true }
    });

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
        responses: {
          include: { vendor: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return actionSuccess(requests.map(mapQuoteRequestWithResponses));
  } catch (error) {
    return actionError(getActionError(error), "GET_QUOTES_BY_PLAN_FAILED");
  }
}

export async function getVendorServiceModules(
  vendorId: string
): Promise<ActionResult<VendorServiceModuleData[]>> {
  try {
    if (!vendorId) {
      return actionError("업체 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const modules = await prisma.vendorServiceModule.findMany({
      where: { vendorId, isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
    });

    return actionSuccess(
      modules.map((m) => ({
        id: m.id,
        vendorId: m.vendorId,
        name: m.name,
        category: m.category,
        price: m.price,
        description: m.description,
        isBaseIncluded: m.isBaseIncluded,
        isActive: m.isActive,
        sortOrder: m.sortOrder
      }))
    );
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_MODULES_FAILED");
  }
}

export async function getVendorQuoteRequests(): Promise<ActionResult<QuoteRequestData[]>> {
  try {
    const vendor = await requireVendorUser();

    const requests = await prisma.quoteRequest.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" }
    });

    return actionSuccess(requests.map(mapQuoteRequest));
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_QUOTE_REQUESTS_FAILED");
  }
}
