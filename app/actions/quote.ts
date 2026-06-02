"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  Prisma,
  QuoteProposalRevisionStatus as PrismaQuoteProposalRevisionStatus,
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
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { assertQuoteTransition } from "@/lib/state-machine";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getPlanHref,
  getVendorConfirmationDueAt,
  getVendorDashboardHref
} from "@/lib/workflow-events";
import { declinePendingQuoteRequest } from "@/lib/quote-request-decline";
import {
  vendorServiceModuleCategoryMatchesEventType,
  vendorSupportsEventType
} from "@/lib/step3.shared";
import { getCatalogKeyForVendorModule } from "@/lib/vendor-service-modules";
import {
  buildVendorPackageQuoteSnapshots,
  mapVendorPackageData,
  vendorPackageInclude
} from "@/lib/vendor-packages";

import type { ActionResult } from "@/types/common";
import type {
  AcceptQuoteResponsePayload,
  AcceptQuoteResult,
  CreateQuoteRequestPayload,
  RequestQuoteAdjustmentPayload,
  QuoteRequestForVendorDTO,
  QuoteRequestData,
  QuoteRequestWithResponses,
  QuoteResponseData,
  QuoteResponseModules,
  SubmitQuoteRevisionPayload,
  SubmitQuoteResponsePayload,
  Step3PreparationGroupDTO,
  Step4CategoryStatusDTO
} from "@/types/quote";
import type { VendorServiceModuleData } from "@/types/vendor-module";
import type { VendorPackageData } from "@/types/vendor-package";

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
  requestMemo: z.string().trim().min(1).optional(),
  selectedPackageId: z.string().min(1).optional(),
  selectedModuleIds: z.array(z.string().min(1)).min(1),
  guestCount: z.number().int().positive().optional(),
  preferredDate: z.string().trim().min(1).optional(),
  budget: z.number().int().nonnegative().optional()
});

const submitQuoteResponseSchema = z.object({
  requestId: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
  modules: quoteResponseModulesSchema,
  totalPrice: z.number().int(),
  note: z.string().trim().optional(),
  responseMessage: z.string().trim().optional()
});

const acceptQuoteResponseSchema = z.object({
  quoteResponseId: z.string().min(1),
  quoteProposalRevisionId: z.string().min(1).optional(),
  reservedDate: z.string().trim().min(1).optional()
});

const requestQuoteAdjustmentSchema = z.object({
  quoteResponseId: z.string().min(1),
  plannerRequestedTotalPrice: z.number().int().positive(),
  memo: z.string().trim().min(1)
});

const submitQuoteRevisionSchema = z.object({
  quoteResponseId: z.string().min(1),
  totalPrice: z.number().int().positive(),
  memo: z.string().trim().optional()
});

const idsSchema = z.array(z.string().min(1)).min(1);
type ValidationIssue = {
  path: ReadonlyArray<PropertyKey>;
};

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
    modules.includedModules.reduce((sum, module) => sum + module.price, 0) +
    modules.optionalModules.reduce((sum, module) => sum + module.price, 0)
  );
}

function validationHasPath(issues: ValidationIssue[], path: string) {
  return issues.some((issue) => issue.path[0] === path);
}

function getCreateQuoteRequestValidationMessage(issues: ValidationIssue[]) {
  if (validationHasPath(issues, "selectedModuleIds")) {
    return "최소 1개 이상의 서비스를 선택해 주세요.";
  }

  if (validationHasPath(issues, "vendorId")) {
    return "견적 요청을 보낼 업체를 선택해 주세요.";
  }

  if (validationHasPath(issues, "planId")) {
    return "연결할 플랜을 선택해 주세요.";
  }

  if (validationHasPath(issues, "requirements")) {
    return "요청사항을 입력해 주세요.";
  }

  if (validationHasPath(issues, "guestCount")) {
    return "인원 수를 확인해 주세요.";
  }

  if (validationHasPath(issues, "budget")) {
    return "예산을 확인해 주세요.";
  }

  return "입력값을 확인해 주세요.";
}

function getSubmitQuoteResponseValidationMessage(issues: ValidationIssue[]) {
  if (validationHasPath(issues, "requestId")) {
    return "견적 요청 ID가 필요합니다.";
  }

  if (validationHasPath(issues, "modules")) {
    return "견적 항목을 확인해 주세요.";
  }

  if (validationHasPath(issues, "totalPrice")) {
    return "견적 총액을 확인해 주세요.";
  }

  return "입력값을 확인해 주세요.";
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

function getReservationSelectedServiceOptions(modules: QuoteResponseModules) {
  return [...modules.includedModules, ...modules.optionalModules].map((module) => ({
    catalogKey: module.id,
    name: module.name,
    price: module.price,
    pricingType: "FLAT"
  }));
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
  const catalogKey = getCatalogKeyForVendorModule(module);

  return {
    id: module.id,
    vendorId: module.vendorId,
    catalogKey,
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
  T extends { selectedModules: Prisma.JsonValue | null; plan?: { type?: string | null } }
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
      .filter((module) =>
        request.plan?.type
          ? vendorServiceModuleCategoryMatchesEventType(request.plan.type, module.category)
          : true
      )
  }));
}

export async function createQuoteRequest(
  payload: CreateQuoteRequestPayload
): Promise<ActionResult<QuoteRequestData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createQuoteRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError(
        getCreateQuoteRequestValidationMessage(parsed.error.issues),
        "VALIDATION_ERROR"
      );
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
      select: { id: true, name: true, companyName: true, supportedEventTypes: true }
    });

    if (!vendor) {
      return actionError("업체를 찾을 수 없습니다.", "VENDOR_NOT_FOUND");
    }

    if (!vendorSupportsEventType(vendor, plan.type)) {
      return actionError(
        "선택한 업체는 이 행사 유형을 지원하지 않습니다.",
        "VENDOR_EVENT_TYPE_MISMATCH"
      );
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
        vendorId: true,
        name: true,
        category: true,
        price: true,
        pricingType: true,
        description: true,
        isBaseIncluded: true,
        isActive: true,
        sortOrder: true
      },
      orderBy: [{ isBaseIncluded: "desc" }, { sortOrder: "asc" }]
    });

    if (modules.length !== selectedModuleIds.length) {
      return actionError("선택한 모듈이 유효하지 않습니다.", "INVALID_MODULES");
    }

    if (
      modules.some((module) =>
        !vendorServiceModuleCategoryMatchesEventType(plan.type, module.category)
      )
    ) {
      return actionError(
        "행사 유형과 맞지 않는 서비스가 포함되어 있습니다.",
        "INVALID_MODULES"
      );
    }

    const preferredDate = parseActionDate(parsed.data.preferredDate);
    const guestCount = parsed.data.guestCount ?? plan.guestTarget ?? 1;
    const budget = parsed.data.budget ?? plan.budget ?? null;
    let selectedPackageId: string | null = null;
    let selectedPackageSnapshot: Prisma.InputJsonValue | undefined;
    let priceSnapshot: Prisma.InputJsonValue | undefined;
    let quotedAmount = calculateRequestModuleTotal(modules, guestCount);

    if (parsed.data.selectedPackageId) {
      const selectedPackage = await prisma.vendorPackage.findFirst({
        where: {
          id: parsed.data.selectedPackageId,
          vendorId: vendor.id,
          eventType: plan.type,
          isActive: true
        },
        include: vendorPackageInclude
      });

      if (!selectedPackage) {
        return actionError("선택한 패키지가 유효하지 않습니다.", "INVALID_PACKAGE");
      }

      const selectedModuleIdSet = new Set(selectedModuleIds);
      const includedModuleIds = selectedPackage.items
        .filter((item) => item.selectionType === "INCLUDED")
        .map((item) => item.vendorServiceModuleId);

      if (includedModuleIds.length === 0) {
        return actionError("선택한 패키지에 포함 항목이 없습니다.", "INVALID_PACKAGE");
      }

      if (includedModuleIds.some((moduleId) => !selectedModuleIdSet.has(moduleId))) {
        return actionError("패키지 포함 항목이 견적 요청에서 누락되었습니다.", "INVALID_PACKAGE_MODULES");
      }

      if (
        selectedPackage.items.some((item) =>
          item.vendorServiceModule.vendorId !== vendor.id ||
          !item.vendorServiceModule.isActive ||
          !vendorServiceModuleCategoryMatchesEventType(plan.type, item.vendorServiceModule.category)
        )
      ) {
        return actionError("선택한 패키지에 유효하지 않은 항목이 있습니다.", "INVALID_PACKAGE_MODULES");
      }

      const packageDto = mapVendorPackageData(selectedPackage);
      const moduleDtos = modules.map(mapVendorServiceModuleData);
      const snapshots = buildVendorPackageQuoteSnapshots({
        package: packageDto,
        selectedModuleIds,
        allVendorModules: moduleDtos,
        guestCount
      });

      selectedPackageId = selectedPackage.id;
      selectedPackageSnapshot = snapshots.selectedPackageSnapshot as unknown as Prisma.InputJsonValue;
      priceSnapshot = snapshots.priceSnapshot as unknown as Prisma.InputJsonValue;
      quotedAmount = snapshots.priceSnapshot.estimatedTotal;
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteRequest.create({
        data: {
          planId: plan.id,
          vendorId: vendor.id,
          selectedPackageId,
          requirements: parsed.data.requirements,
          selectedModules: selectedModuleIds,
          selectedPackageSnapshot,
          priceSnapshot,
          preferredDate,
          budget,
          status: PrismaQuoteStatus.PENDING
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
          selectedPackageId,
          selectedModuleIds,
          guestCount
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: plan.id,
        vendorId: vendor.id,
        quoteRequestId: created.id,
        type: "QUOTE_REQUEST_CREATED",
        message: "일반 사용자가 업체에 견적 요청을 보냈습니다.",
        metadata: {
          eventType: plan.type,
          selectedPackageId,
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
      return actionError(
        getSubmitQuoteResponseValidationMessage(parsed.error.issues),
        "VALIDATION_ERROR"
      );
    }

    if (parsed.data.totalPrice <= 0) {
      return actionError("견적 총액은 0원보다 커야 합니다.", "INVALID_TOTAL_PRICE");
    }

    const request = await prisma.quoteRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        plan: {
          select: {
            id: true,
            ownerId: true,
            title: true,
            type: true
          }
        },
        reservation: true
      }
    });

    if (!request) {
      return actionError("견적 요청을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (request.vendorId !== vendor.id) {
      return actionError("이 요청에 응답할 권한이 없습니다.", "FORBIDDEN");
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
    const responseMessage = parsed.data.responseMessage ?? parsed.data.note ?? null;
    const responseModules = [
      ...parsed.data.modules.includedModules,
      ...parsed.data.modules.optionalModules
    ];

    if (
      responseModules.some((module) =>
        !vendorServiceModuleCategoryMatchesEventType(request.plan.type, module.category)
      )
    ) {
      return actionError(
        "행사 유형과 맞지 않는 견적 항목이 포함되어 있습니다.",
        "INVALID_MODULES"
      );
    }

    if (totalPrice <= 0) {
      return actionError("견적 총액은 0원보다 커야 합니다.", "INVALID_TOTAL_PRICE");
    }

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
          note: responseMessage
        },
        include: { vendor: true }
      });

      const initialRevision = await tx.quoteProposalRevision.create({
        data: {
          quoteResponseId: created.id,
          requestId: request.id,
          vendorId: request.vendorId,
          version: 1,
          totalPrice,
          memo: responseMessage,
          status: PrismaQuoteProposalRevisionStatus.SUBMITTED
        }
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
            notes: responseMessage ?? request.reservation.notes
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
          quoteProposalRevisionId: initialRevision.id,
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
          quoteProposalRevisionId: initialRevision.id,
          hasNote: Boolean(responseMessage)
        }
      });

      return tx.quoteResponse.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          vendor: true,
          revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
        }
      });
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

export async function requestQuoteAdjustment(
  payload: RequestQuoteAdjustmentPayload
): Promise<ActionResult<QuoteResponseData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = requestQuoteAdjustmentSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("희망 조정 금액과 조정 요청 메모를 입력해 주세요.", "VALIDATION_ERROR");
    }

    const response = await prisma.quoteResponse.findFirst({
      where: {
        id: parsed.data.quoteResponseId,
        request: { plan: { ownerId: user.id } }
      },
      include: {
        vendor: true,
        revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
        request: {
          include: {
            plan: { select: { id: true, title: true, ownerId: true } },
            reservation: true
          }
        }
      }
    });

    if (!response) {
      return actionError("견적 응답을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (mapQuoteStatus(response.request.status) !== "RESPONDED") {
      return actionError("응답 완료 상태의 제안만 조정 요청할 수 있습니다.", "INVALID_QUOTE_STATUS");
    }

    if (response.request.reservation) {
      return actionError("이미 예약 요청이 생성된 제안은 조정 요청할 수 없습니다.", "RESERVATION_ALREADY_EXISTS");
    }

    const latestRevision = response.revisions[0] ?? null;

    if (!latestRevision) {
      return actionError("조정 요청할 제안 버전을 찾을 수 없습니다.", "QUOTE_REVISION_NOT_FOUND");
    }

    if (latestRevision.status === PrismaQuoteProposalRevisionStatus.ADJUSTMENT_REQUESTED) {
      return actionError("이미 조정 요청을 보냈습니다.", "QUOTE_ADJUSTMENT_ALREADY_REQUESTED");
    }

    if (
      latestRevision.status !== PrismaQuoteProposalRevisionStatus.SUBMITTED &&
      latestRevision.status !== PrismaQuoteProposalRevisionStatus.REVISED
    ) {
      return actionError("조정 요청 가능한 제안 상태가 아닙니다.", "INVALID_QUOTE_REVISION_STATUS");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const revision = await tx.quoteProposalRevision.update({
        where: { id: latestRevision.id },
        data: {
          status: PrismaQuoteProposalRevisionStatus.ADJUSTMENT_REQUESTED,
          adjustmentRequestMemo: parsed.data.memo,
          plannerRequestedTotalPrice: parsed.data.plannerRequestedTotalPrice
        }
      });

      await createWorkflowNotification(tx, {
        userId: response.vendorId,
        type: "QUOTE_ADJUSTMENT_REQUESTED",
        title: "조정 요청 도착",
        message: `${response.request.plan.title} 제안에 대한 조정 요청이 도착했습니다.`,
        href: getVendorDashboardHref(),
        metadata: {
          planId: response.request.planId,
          quoteRequestId: response.requestId,
          quoteResponseId: response.id,
          quoteProposalRevisionId: revision.id,
          plannerRequestedTotalPrice: parsed.data.plannerRequestedTotalPrice
        }
      });

      await createWorkflowActivity(tx, {
        actorId: user.id,
        planId: response.request.planId,
        vendorId: response.vendorId,
        quoteRequestId: response.requestId,
        quoteResponseId: response.id,
        type: "QUOTE_ADJUSTMENT_REQUESTED",
        message: "일반 사용자가 제안 조정을 요청했습니다.",
        metadata: {
          quoteProposalRevisionId: revision.id,
          adjustmentRequestMemo: parsed.data.memo,
          plannerRequestedTotalPrice: parsed.data.plannerRequestedTotalPrice
        }
      });

      return tx.quoteResponse.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          vendor: true,
          revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
        }
      });
    });

    revalidateQuoteViews(response.request.planId, response.vendorId);
    return actionSuccess(mapQuoteResponse(updated));
  } catch (error) {
    return actionError(getActionError(error), "REQUEST_QUOTE_ADJUSTMENT_FAILED");
  }
}

export async function submitQuoteRevision(
  payload: SubmitQuoteRevisionPayload
): Promise<ActionResult<QuoteResponseData>> {
  try {
    const vendor = await requireVendorUser();
    const parsed = submitQuoteRevisionSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("수정 제안 금액과 메모를 확인해 주세요.", "VALIDATION_ERROR");
    }

    const response = await prisma.quoteResponse.findFirst({
      where: { id: parsed.data.quoteResponseId, vendorId: vendor.id },
      include: {
        vendor: true,
        revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
        request: {
          include: {
            plan: { select: { id: true, title: true, ownerId: true } },
            reservation: true
          }
        }
      }
    });

    if (!response) {
      return actionError("견적 응답을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (mapQuoteStatus(response.request.status) !== "RESPONDED") {
      return actionError("수정 제안을 제출할 수 있는 요청 상태가 아닙니다.", "INVALID_QUOTE_STATUS");
    }

    if (response.request.reservation) {
      return actionError("이미 예약 요청이 생성된 제안은 수정할 수 없습니다.", "RESERVATION_ALREADY_EXISTS");
    }

    const latestRevision = response.revisions[0] ?? null;

    if (!latestRevision || latestRevision.status !== PrismaQuoteProposalRevisionStatus.ADJUSTMENT_REQUESTED) {
      return actionError("플래너 조정 요청이 있는 제안만 수정할 수 있습니다.", "QUOTE_ADJUSTMENT_NOT_REQUESTED");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const revision = await tx.quoteProposalRevision.create({
        data: {
          quoteResponseId: response.id,
          requestId: response.requestId,
          vendorId: response.vendorId,
          version: latestRevision.version + 1,
          totalPrice: parsed.data.totalPrice,
          memo: parsed.data.memo ?? null,
          status: PrismaQuoteProposalRevisionStatus.REVISED
        }
      });

      await createWorkflowNotification(tx, {
        userId: response.request.plan.ownerId,
        type: "QUOTE_REVISION_RECEIVED",
        title: "수정 제안 도착",
        message: `${response.request.plan.title}에 대한 수정 제안이 도착했습니다.`,
        href: getPlanHref(response.request.planId),
        metadata: {
          planId: response.request.planId,
          vendorId: response.vendorId,
          quoteRequestId: response.requestId,
          quoteResponseId: response.id,
          quoteProposalRevisionId: revision.id,
          totalPrice: revision.totalPrice
        }
      });

      await createWorkflowActivity(tx, {
        actorId: vendor.id,
        planId: response.request.planId,
        vendorId: vendor.id,
        quoteRequestId: response.requestId,
        quoteResponseId: response.id,
        type: "QUOTE_REVISION_SUBMITTED",
        message: "업체가 수정 제안을 제출했습니다.",
        metadata: {
          quoteProposalRevisionId: revision.id,
          totalPrice: revision.totalPrice,
          hasMemo: Boolean(parsed.data.memo)
        }
      });

      return tx.quoteResponse.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          vendor: true,
          revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
        }
      });
    });

    revalidateQuoteViews(response.request.planId, response.vendorId);
    return actionSuccess(mapQuoteResponse(updated));
  } catch (error) {
    return actionError(getActionError(error), "SUBMIT_QUOTE_REVISION_FAILED");
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
            quoteProposalRevision: true,
            quoteResponse: {
              include: {
                vendor: true,
                revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
              }
            }
          }
        },
        revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
        request: {
          include: {
            plan: true,
            reservation: {
              include: {
                vendor: true,
                quoteProposalRevision: true,
                quoteResponse: {
                  include: {
                    vendor: true,
                    revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
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
      return actionError("이미 수락된 견적입니다.", "QUOTE_ALREADY_ACCEPTED");
    }

    if (currentStatus !== "RESPONDED") {
      return actionError(
        "업체 응답이 도착한 견적만 수락할 수 있습니다.",
        "INVALID_QUOTE_STATUS"
      );
    }

    assertQuoteTransition(currentStatus, "ACCEPTED");

    const latestRevision = response.revisions[0] ?? null;
    const acceptedRevision = parsed.data.quoteProposalRevisionId
      ? response.revisions.find((revision) => revision.id === parsed.data.quoteProposalRevisionId)
      : latestRevision;

    if (parsed.data.quoteProposalRevisionId && !acceptedRevision) {
      return actionError("선택한 수정 제안을 찾을 수 없습니다.", "QUOTE_REVISION_NOT_FOUND");
    }

    if (latestRevision?.status === PrismaQuoteProposalRevisionStatus.ADJUSTMENT_REQUESTED) {
      return actionError("업체의 수정 제안이 도착한 뒤 수락할 수 있습니다.", "QUOTE_REVISION_PENDING");
    }

    if (acceptedRevision && latestRevision && acceptedRevision.id !== latestRevision.id) {
      return actionError("최신 제안만 수락할 수 있습니다.", "STALE_QUOTE_REVISION");
    }

    if (
      acceptedRevision &&
      acceptedRevision.status !== PrismaQuoteProposalRevisionStatus.SUBMITTED &&
      acceptedRevision.status !== PrismaQuoteProposalRevisionStatus.REVISED
    ) {
      return actionError("수락 가능한 제안 상태가 아닙니다.", "INVALID_QUOTE_REVISION_STATUS");
    }

    const acceptedTotalPrice = acceptedRevision?.totalPrice ?? response.totalPrice;
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
              quoteProposalRevisionId: acceptedRevision?.id ?? existingReservation.quoteProposalRevisionId,
              serviceDate: existingReservation.serviceDate ?? serviceDate,
              quotedAmount: acceptedTotalPrice,
              confirmedAmount: null,
              vendorConfirmationDueAt,
              selectedServiceOptions: getReservationSelectedServiceOptions(modules) as Prisma.InputJsonValue,
              status: PrismaReservationStatus.PENDING,
              notes:
                existingReservation.notes ??
                "견적 응답 수락으로 생성된 예약입니다. 업체 확정 대기 중입니다."
            },
            include: {
              vendor: true,
              quoteProposalRevision: true,
              quoteResponse: {
                include: {
                  vendor: true,
                  revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
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
              quoteProposalRevisionId: acceptedRevision?.id ?? null,
              serviceName: getReservationServiceName(modules),
              serviceCategory: getReservationServiceCategory(modules),
              serviceDate,
              guestCount: response.request.plan.guestTarget,
              quotedAmount: acceptedTotalPrice,
              confirmedAmount: null,
              vendorConfirmationDueAt,
              selectedServiceOptions: getReservationSelectedServiceOptions(modules) as Prisma.InputJsonValue,
              status: PrismaReservationStatus.PENDING,
              notes: "견적 응답 수락으로 생성된 예약입니다. 업체 확정 대기 중입니다."
            },
            include: {
              vendor: true,
              quoteProposalRevision: true,
              quoteResponse: {
                include: {
                  vendor: true,
                  revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
                }
              }
            }
          });

      if (acceptedRevision) {
        await tx.quoteProposalRevision.update({
          where: { id: acceptedRevision.id },
          data: { status: PrismaQuoteProposalRevisionStatus.ACCEPTED }
        });
      }

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
          quoteProposalRevisionId: acceptedRevision?.id ?? "",
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
          totalPrice: acceptedTotalPrice,
          quoteProposalRevisionId: acceptedRevision?.id ?? "",
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

export async function declineQuoteRequest(
  requestId: string,
  reason?: string
): Promise<ActionResult<QuoteRequestData>> {
  try {
    const vendor = await requireVendorUser();

    if (!requestId) {
      return actionError("견적 요청 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const declined = await prisma.$transaction((tx) =>
      declinePendingQuoteRequest(tx, {
        requestId,
        vendorId: vendor.id,
        reason
      })
    );

    revalidateQuoteViews(declined.planId, declined.vendorId);
    return actionSuccess(mapQuoteRequest(declined.request));
  } catch (error) {
    return actionError(getActionError(error), "DECLINE_QUOTE_REQUEST_FAILED");
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

    const modules = await withPrismaRetry(() =>
      prisma.vendorServiceModule.findMany({
        where: { id: { in: parsed.data }, isActive: true },
        select: { price: true }
      })
    );

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

    const requestsWithModules = await withPrismaRetry(async () => {
      const plan = await prisma.eventPlan.findFirst({
        where: { id: planId, ownerId: user.id },
        select: { id: true }
      });

      if (!plan) return null;

      const requests = await prisma.quoteRequest.findMany({
        where: { planId: plan.id, vendor: { isActive: true } },
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
              quoteProposalRevision: true,
              quoteResponse: {
                include: {
                  vendor: true,
                  revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
                }
              }
            }
          },
          responses: {
            include: {
              vendor: true,
              revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
              reservation: {
                include: {
                  vendor: true,
                  quoteProposalRevision: true,
                  quoteResponse: {
                    include: {
                      vendor: true,
                      revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return attachSelectedModuleDetails(requests);
    });

    if (!requestsWithModules) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

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
  vendorId: string,
  eventType?: "WEDDING" | "FUNERAL"
): Promise<ActionResult<VendorServiceModuleData[]>> {
  try {
    await requireSessionUser();

    if (!vendorId) {
      return actionError("업체 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    if (eventType && eventType !== "WEDDING" && eventType !== "FUNERAL") {
      return actionError("행사 유형을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const filteredModules = await withPrismaRetry(async () => {
      if (eventType) {
        const vendor = await prisma.user.findFirst({
          where: {
            id: vendorId,
            role: UserRole.VENDOR,
            vendorApprovalStatus: VendorApprovalStatus.APPROVED,
            isActive: true
          },
          select: { id: true, supportedEventTypes: true }
        });

        if (!vendor || !vendorSupportsEventType(vendor, eventType)) {
          return [];
        }
      }

      const modules = await prisma.vendorServiceModule.findMany({
        where: { vendorId, isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
      });

      return eventType
        ? modules.filter((module) =>
            vendorServiceModuleCategoryMatchesEventType(eventType, module.category)
          )
        : modules;
    });

    return actionSuccess(filteredModules.map(mapVendorServiceModuleData));
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_MODULES_FAILED");
  }
}

export async function getVendorPackages(
  vendorId: string,
  eventType?: "WEDDING" | "FUNERAL"
): Promise<ActionResult<VendorPackageData[]>> {
  try {
    await requireSessionUser();

    if (!vendorId) {
      return actionError("업체 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    if (eventType && eventType !== "WEDDING" && eventType !== "FUNERAL") {
      return actionError("행사 유형을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const packages = await withPrismaRetry(async () => {
      if (eventType) {
        const vendor = await prisma.user.findFirst({
          where: {
            id: vendorId,
            role: UserRole.VENDOR,
            vendorApprovalStatus: VendorApprovalStatus.APPROVED,
            isActive: true
          },
          select: { id: true, supportedEventTypes: true }
        });

        if (!vendor || !vendorSupportsEventType(vendor, eventType)) {
          return [];
        }
      }

      return prisma.vendorPackage.findMany({
        where: {
          vendorId,
          isActive: true,
          ...(eventType ? { eventType } : {})
        },
        include: vendorPackageInclude,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
    });

    return actionSuccess(packages.map(mapVendorPackageData));
  } catch (error) {
    return actionError(getActionError(error), "GET_VENDOR_PACKAGES_FAILED");
  }
}

export async function getQuoteRequestsForVendor(): Promise<
  ActionResult<QuoteRequestForVendorDTO[]>
> {
  try {
    const vendor = await requireVendorUser();

    const requestsWithModules = await withPrismaRetry(async () => {
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
              quoteProposalRevision: true,
              quoteResponse: {
                include: {
                  vendor: true,
                  revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
                }
              }
            }
          },
          responses: {
            include: {
              vendor: true,
              revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
              reservation: {
                include: {
                  vendor: true,
                  quoteProposalRevision: true,
                  quoteResponse: {
                    include: {
                      vendor: true,
                      revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return attachSelectedModuleDetails(requests);
    });

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

function resolveVendorRoleAndGroup(
  vendorName: string,
  eventType: "WEDDING" | "FUNERAL"
): { role: "PRIMARY" | "INCLUDED" | "ADDON" | "OPTIONAL" | "BUNDLE"; comparableGroupKey: string } {
  const name = vendorName.toLowerCase();
  if (eventType === "WEDDING") {
    if (name.includes("가든") || name.includes("모먼트") || name.includes("웨딩") || name.includes("홀")) {
      return { role: "PRIMARY", comparableGroupKey: "wedding_venue_package" };
    }
    if (name.includes("플로") || name.includes("오르세") || name.includes("꽃") || name.includes("데코")) {
      return { role: "ADDON", comparableGroupKey: "wedding_floral_upgrade" };
    }
    return { role: "OPTIONAL", comparableGroupKey: `wedding_generic_${vendorName}` };
  } else {
    if (name.includes("의전") || name.includes("한결") || name.includes("장례")) {
      return { role: "BUNDLE", comparableGroupKey: "funeral_basic_service" };
    }
    return { role: "OPTIONAL", comparableGroupKey: `funeral_generic_${vendorName}` };
  }
}

const WEDDING_CATEGORIES = [
  { key: "venue", name: "예식장/공간", dbCategory: ["VENUE"] },
  { key: "catering", name: "식음료", dbCategory: ["CATERING"] },
  { key: "floral", name: "플라워/장식", dbCategory: ["DECORATION"] },
  { key: "invitation", name: "초대장", dbCategory: ["INVITATION"] },
  { key: "etc", name: "기타 옵션", dbCategory: ["PHOTO", "DRESS", "MAKEUP", "CEREMONY"] },
];

const FUNERAL_CATEGORIES = [
  { key: "funeralHall", name: "장례식장", dbCategory: ["FUNERAL_HALL"] },
  { key: "meal", name: "문상객 식사", dbCategory: ["MEAL"] },
  { key: "obituary", name: "부고 안내", dbCategory: ["OBITUARY"] },
  { key: "hearse", name: "운구", dbCategory: ["TRANSPORT", "CEREMONY"] },
  { key: "altarFloral", name: "제단꽃/화환", dbCategory: ["WREATH"] },
];

export async function getStep3PreparationGroups(
  planId: string,
  vendorId: string
): Promise<ActionResult<Step3PreparationGroupDTO[]>> {
  try {
    await requireSessionUser();

    const plan = await prisma.eventPlan.findUnique({
      where: { id: planId },
      select: { type: true }
    });
    if (!plan) return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");

    const vendor = await prisma.user.findFirst({
      where: { id: vendorId, role: UserRole.VENDOR },
      select: { id: true, name: true, companyName: true }
    });
    if (!vendor) return actionError("업체를 찾을 수 없습니다.", "VENDOR_NOT_FOUND");

    const modules = await prisma.vendorServiceModule.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: { sortOrder: "asc" }
    });

    const eventType = plan.type === "WEDDING" ? "WEDDING" : "FUNERAL";
    const { role, comparableGroupKey } = resolveVendorRoleAndGroup(vendor.companyName ?? vendor.name, eventType);

    const categories = eventType === "WEDDING" ? WEDDING_CATEGORIES : FUNERAL_CATEGORIES;
    const groups: Step3PreparationGroupDTO[] = [];

    for (const cat of categories) {
      const catModules = modules.filter(m => cat.dbCategory.includes(m.category));
      if (catModules.length === 0) continue;

      const includedModuleIds = catModules.filter(m => m.isBaseIncluded).map(m => m.id);
      const optionalModuleIds = catModules.filter(m => !m.isBaseIncluded).map(m => m.id);

      groups.push({
        key: cat.key,
        label: cat.name,
        eventType,
        mode: role === "PRIMARY" || role === "BUNDLE" ? "PACKAGE" : "ADDON",
        vendorId: vendor.id,
        vendorName: vendor.companyName ?? vendor.name,
        vendorRole: role,
        comparableGroupKey,
        includedModuleIds,
        optionalModuleIds,
        defaultSelectedModuleIds: includedModuleIds.length > 0 ? includedModuleIds : [catModules[0].id]
      });
    }

    return actionSuccess(groups);
  } catch (error) {
    return actionError(getActionError(error), "GET_STEP3_PREPARATION_GROUPS_FAILED");
  }
}

export async function getStep4DashboardData(
  planId: string
): Promise<ActionResult<Step4CategoryStatusDTO[]>> {
  try {
    const user = await requireGeneralUser();

    const { plan, requests, reservations, modules } = await withPrismaRetry(async () => {
      const plan = await prisma.eventPlan.findFirst({
        where: { id: planId, ownerId: user.id },
        select: { id: true, type: true }
      });
      if (!plan) return { plan: null, requests: [], reservations: [], modules: [] };

      const requests = await prisma.quoteRequest.findMany({
        where: { planId: plan.id, vendor: { isActive: true } },
        include: {
          vendor: true,
          responses: {
            include: {
              vendor: true,
              revisions: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] }
            }
          },
          reservation: { include: { quoteProposalRevision: true } }
        }
      });

      const reservations = await prisma.reservation.findMany({
        where: { eventPlanId: plan.id, vendor: { isActive: true } },
        include: { vendor: true, quoteRequest: true }
      });

      const allSelectedModuleIds = Array.from(
        new Set(
          requests.flatMap(req => {
            if (Array.isArray(req.selectedModules)) {
              return req.selectedModules.filter((id): id is string => typeof id === "string");
            }
            return [];
          })
        )
      );

      const modules = allSelectedModuleIds.length > 0
        ? await prisma.vendorServiceModule.findMany({
            where: { id: { in: allSelectedModuleIds } }
          })
        : [];

      return { plan, requests, reservations, modules };
    });

    if (!plan) return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");

    const eventType = plan.type === "WEDDING" ? "WEDDING" : "FUNERAL";
    const moduleCategoryMap = new Map(modules.map(m => [m.id, m.category]));

    const categories = eventType === "WEDDING" ? WEDDING_CATEGORIES : FUNERAL_CATEGORIES;
    const dashboard: Step4CategoryStatusDTO[] = [];

    for (const cat of categories) {
      const matchedRequests = requests.filter(req => {
        const { role } = resolveVendorRoleAndGroup(req.vendor.companyName ?? req.vendor.name, eventType);
        
        if (role === "PRIMARY" || role === "BUNDLE") {
          return cat.key === (eventType === "WEDDING" ? "venue" : "funeralHall");
        }

        const reqModuleIds = Array.isArray(req.selectedModules)
          ? req.selectedModules.filter((id): id is string => typeof id === "string")
          : [];
        const hasMatchingModule = reqModuleIds.some(id => {
          const mCat = moduleCategoryMap.get(id);
          return mCat && cat.dbCategory.includes(mCat);
        });

        return hasMatchingModule;
      });

      const matchedReservations = reservations.filter(res => {
        const { role } = resolveVendorRoleAndGroup(res.vendor.companyName ?? res.vendor.name, eventType);
        
        if (role === "PRIMARY" || role === "BUNDLE") {
          return cat.key === (eventType === "WEDDING" ? "venue" : "funeralHall");
        }

        if (res.serviceCategory && cat.dbCategory.includes(res.serviceCategory)) return true;
        
        if (res.quoteRequestId) {
          return matchedRequests.some(req => req.id === res.quoteRequestId);
        }

        return false;
      });

      let status: Step4CategoryStatusDTO["status"] = "NOT_REQUESTED";
      const hasConfirmed = matchedReservations.some(r => r.status === "CONFIRMED" || r.status === "COMPLETED");
      const hasAccepted = matchedRequests.some(req => req.status === "ACCEPTED") || 
                          matchedReservations.some(r => r.status === "PENDING" && r.quoteRequest?.status === "ACCEPTED");
      const hasAdjustmentRequested = matchedRequests.some(
        req => req.status === "RESPONDED" && req.responses[0]?.revisions[0]?.status === "ADJUSTMENT_REQUESTED"
      );
      const hasRevised = matchedRequests.some(
        req => req.status === "RESPONDED" && req.responses[0]?.revisions[0]?.status === "REVISED"
      );
      const hasResponded = matchedRequests.some(req => req.status === "RESPONDED");
      const hasPending = matchedRequests.some(req => req.status === "PENDING");

      if (hasConfirmed) {
        status = "CONFIRMED";
      } else if (hasAccepted) {
        status = "ACCEPTED_WAITING_VENDOR";
      } else if (hasRevised) {
        status = "REVISED";
      } else if (hasAdjustmentRequested) {
        status = "ADJUSTMENT_REQUESTED";
      } else if (hasResponded) {
        status = "RESPONDED";
      } else if (hasPending) {
        status = "REQUESTED";
      }

      const vendorSummariesMap = new Map<string, Step4CategoryStatusDTO["vendorSummaries"][number]>();

      for (const req of matchedRequests) {
        const { role } = resolveVendorRoleAndGroup(req.vendor.companyName ?? req.vendor.name, eventType);
        const resp = req.responses[0];
        const currentRevision = resp?.revisions[0] ?? null;
        const res = matchedReservations.find(r => r.quoteRequestId === req.id || r.vendorId === req.vendorId);
        
        vendorSummariesMap.set(req.vendorId, {
          vendorId: req.vendorId,
          vendorName: req.vendor.companyName ?? req.vendor.name,
          vendorRole: role,
          quoteRequestId: req.id,
          quoteResponseId: resp?.id,
          reservationId: res?.id,
          totalPrice: currentRevision?.totalPrice ?? resp?.totalPrice ?? res?.quotedAmount ?? undefined,
          status: currentRevision?.status ?? req.status
        });
      }

      for (const res of matchedReservations) {
        if (!vendorSummariesMap.has(res.vendorId)) {
          const { role } = resolveVendorRoleAndGroup(res.vendor.companyName ?? res.vendor.name, eventType);
          vendorSummariesMap.set(res.vendorId, {
            vendorId: res.vendorId,
            vendorName: res.vendor.companyName ?? res.vendor.name,
            vendorRole: role,
            reservationId: res.id,
            totalPrice: res.quotedAmount ?? undefined,
            status: res.status
          });
        }
      }

      const vendorSummaries = Array.from(vendorSummariesMap.values());

      const primarySummary = vendorSummaries.find(v => v.vendorRole === "PRIMARY" || v.vendorRole === "BUNDLE") ?? vendorSummaries[0];
      const comparableGroupKey = primarySummary 
        ? resolveVendorRoleAndGroup(primarySummary.vendorName, eventType).comparableGroupKey
        : `${eventType.toLowerCase()}_generic`;

      const respondedSameGroup = vendorSummaries.filter(v => 
        (v.status === "RESPONDED" || v.status === "REVISED") &&
        resolveVendorRoleAndGroup(v.vendorName, eventType).comparableGroupKey === comparableGroupKey
      );
      const canCompare = respondedSameGroup.length >= 2;
      const canAccept = status === "RESPONDED" || status === "REVISED";

      let nextActionLabel = "견적 요청하기";
      if (status === "REQUESTED") nextActionLabel = "응답 대기 중";
      else if (status === "ADJUSTMENT_REQUESTED") nextActionLabel = "업체 수정 제안 대기";
      else if (status === "REVISED") nextActionLabel = "수정 제안 확인 및 수락";
      else if (status === "RESPONDED") nextActionLabel = "제안서 검토 및 수락";
      else if (status === "ACCEPTED_WAITING_VENDOR") nextActionLabel = "업체 확정 대기 중";
      else if (status === "CONFIRMED") nextActionLabel = "예약 확정 완료";

      dashboard.push({
        key: cat.key,
        label: cat.name,
        eventType,
        comparableGroupKey,
        status,
        vendorSummaries,
        canCompare,
        canAccept,
        nextActionLabel
      });
    }

    return actionSuccess(dashboard);
  } catch (error) {
    return actionError(getActionError(error), "GET_STEP4_DASHBOARD_DATA_FAILED");
  }
}
