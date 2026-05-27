"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { EventStatus, EventType as PrismaEventType, UserRole } from "@/generated/prisma/client";
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { generateMockAIRecommendation } from "@/lib/mocks/ai-recommendation";
import { prisma } from "@/lib/prisma";
import { buildEventPlanSlug } from "@/lib/step3.server";

import type { ActionResult } from "@/types/common";
import type {
  CreatePlanPayload,
  PlanDashboardData,
  PlanDashboardNextAction,
  PlanQuoteStatusData,
  EventPlanData,
  EventPlanWithDetails,
  UpdatePlanPayload
} from "@/types/plan";
import type { QuoteStatus } from "@/types/quote";
import type { ReservationStatus } from "@/types/reservation";

import {
  mapEventPlan,
  mapInvitation,
  mapQuoteRequest,
  mapQuoteRequestWithResponses,
  mapQuoteResponse,
  mapQuoteStatus,
  mapReservation,
  mapReservationStatus,
  mapTransaction,
  mapVendorProfile,
  parseActionDate,
  requireGeneralUser
} from "./_utils";

const createPlanSchema = z.object({
  eventType: z.enum(["WEDDING", "FUNERAL"]),
  title: z.string().trim().min(1).optional(),
  eventDate: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  guestCount: z.number().int().positive().optional(),
  budget: z.number().int().nonnegative().optional()
});

const updatePlanSchema = z.object({
  title: z.string().trim().min(1).optional(),
  eventDate: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).nullable().optional(),
  guestCount: z.number().int().positive().nullable().optional(),
  budget: z.number().int().nonnegative().nullable().optional()
});

function revalidatePlanViews(id?: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  if (id) revalidatePath(`/plans/${id}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

function getQuoteRequestNextAction(
  status: QuoteStatus,
  reservationStatus: ReservationStatus | null,
  hasResponse: boolean
): PlanDashboardNextAction {
  if (status === "ACCEPTED") {
    if (reservationStatus === "CONFIRMED") return "confirmed";
    return "reservation_pending";
  }
  if (status === "RESPONDED" && hasResponse) return "accept_quote";
  if (status === "PENDING") return "waiting_for_vendor";
  if (reservationStatus === "CONFIRMED") return "confirmed";
  return "canceled";
}

function getPlanNextAction(items: PlanQuoteStatusData[]): PlanDashboardNextAction {
  if (items.some((item) => item.nextAction === "confirmed")) return "confirmed";
  if (items.some((item) => item.nextAction === "reservation_pending")) {
    return "reservation_pending";
  }
  if (items.some((item) => item.status === "RESPONDED" && item.latestResponse)) {
    return "compare_quotes";
  }
  if (items.some((item) => item.status === "PENDING")) return "waiting_for_vendor";
  if (items.length === 0) return "create_quote_request";
  return "canceled";
}

export async function createPlan(
  payload: CreatePlanPayload
): Promise<ActionResult<EventPlanData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createPlanSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const title =
      parsed.data.title ??
      (parsed.data.eventType === "WEDDING" ? "새 웨딩 플랜" : "새 장례 플랜");
    const scheduledAt = parseActionDate(parsed.data.eventDate);

    const plan = await prisma.eventPlan.create({
      data: {
        ownerId: user.id,
        title,
        slug: buildEventPlanSlug(title),
        type: parsed.data.eventType === "WEDDING" ? PrismaEventType.WEDDING : PrismaEventType.FUNERAL,
        status: EventStatus.ACTIVE,
        region: parsed.data.location ?? null,
        scheduledAt,
        guestTarget: parsed.data.guestCount ?? null,
        budget: parsed.data.budget ?? null,
        aiRecommendation: generateMockAIRecommendation({
          budget: parsed.data.budget ?? null,
          guestCount: parsed.data.guestCount ?? null,
          region: parsed.data.location ?? null,
          eventType: parsed.data.eventType
        })
      }
    });

    revalidatePlanViews(plan.id);
    return actionSuccess(mapEventPlan(plan));
  } catch (error) {
    return actionError(getActionError(error), "CREATE_PLAN_FAILED");
  }
}

export async function updatePlan(
  planId: string,
  payload: UpdatePlanPayload
): Promise<ActionResult<EventPlanData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = updatePlanSchema.safeParse(payload);

    if (!planId || !parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const existing = await prisma.eventPlan.findFirst({
      where: { id: planId, ownerId: user.id },
      select: { id: true }
    });

    if (!existing) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const plan = await prisma.eventPlan.update({
      where: { id: planId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.eventDate !== undefined
          ? { scheduledAt: parseActionDate(parsed.data.eventDate ?? undefined) }
          : {}),
        ...(parsed.data.location !== undefined ? { region: parsed.data.location } : {}),
        ...(parsed.data.guestCount !== undefined ? { guestTarget: parsed.data.guestCount } : {}),
        ...(parsed.data.budget !== undefined ? { budget: parsed.data.budget } : {})
      }
    });

    revalidatePlanViews(plan.id);
    return actionSuccess(mapEventPlan(plan));
  } catch (error) {
    return actionError(getActionError(error), "UPDATE_PLAN_FAILED");
  }
}

export async function getPlanById(
  planId: string
): Promise<ActionResult<EventPlanWithDetails>> {
  try {
    const user = await requireGeneralUser();

    if (!planId) {
      return actionError("플랜 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: planId, ownerId: user.id },
      include: {
        quoteRequests: {
          include: {
            responses: {
              include: {
                vendor: true
              },
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        reservations: {
          include: {
            vendor: true,
            quoteResponse: {
              include: {
                vendor: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        planTransactions: {
          orderBy: { createdAt: "desc" }
        },
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!plan) {
      return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    }

    return actionSuccess({
      ...mapEventPlan(plan),
      quoteRequests: plan.quoteRequests.map(mapQuoteRequestWithResponses),
      reservations: plan.reservations.map(mapReservation),
      transactions: plan.planTransactions.map(mapTransaction),
      invitation: mapInvitation(plan.invitations[0])
    });
  } catch (error) {
    return actionError(getActionError(error), "GET_PLAN_FAILED");
  }
}

export async function getPlansWithQuoteStatus(): Promise<ActionResult<PlanDashboardData[]>> {
  try {
    const user = await requireGeneralUser();

    if (user.role !== UserRole.GENERAL) {
      return actionError("권한이 없습니다.", "FORBIDDEN");
    }

    const plans = await prisma.eventPlan.findMany({
      where: {
        ownerId: user.id,
        type: { in: [PrismaEventType.WEDDING, PrismaEventType.FUNERAL] }
      },
      include: {
        quoteRequests: {
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
            responses: {
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
                }
              },
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        reservations: {
          include: {
            vendor: true,
            quoteResponse: {
              include: {
                vendor: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return actionSuccess(
      plans.map((plan) => {
        const quoteRequests = plan.quoteRequests.map((request): PlanQuoteStatusData => {
          const latestResponse = request.responses[0] ?? null;
          const responseIds = new Set(request.responses.map((response) => response.id));
          const linkedReservation =
            request.responses.find((response) => response.reservation)?.reservation ??
            request.reservation ??
            plan.reservations.find(
              (candidate) =>
                candidate.quoteResponseId !== null && responseIds.has(candidate.quoteResponseId)
            ) ??
            null;
          const status = mapQuoteStatus(request.status);
          const visibleReservation =
            status === "ACCEPTED" || linkedReservation?.status === "CONFIRMED"
              ? linkedReservation
              : null;
          const reservationStatus = visibleReservation
            ? mapReservationStatus(visibleReservation.status)
            : null;

          return {
            request: mapQuoteRequest(request),
            vendor: mapVendorProfile(request.vendor),
            latestResponse: latestResponse ? mapQuoteResponse(latestResponse) : null,
            reservation: visibleReservation ? mapReservation(visibleReservation) : null,
            status,
            nextAction: getQuoteRequestNextAction(
              status,
              reservationStatus,
              latestResponse !== null
            )
          };
        });

        const acceptedQuote = quoteRequests.find((item) => item.status === "ACCEPTED") ?? null;
        const acceptedReservation = acceptedQuote?.reservation ?? null;
        const visibleReservationStatuses = quoteRequests
          .map((item) => item.reservation?.status ?? null)
          .filter((status): status is ReservationStatus => status !== null);

        return {
          ...mapEventPlan(plan),
          quoteRequests,
          summary: {
            pendingRequests: quoteRequests.filter((item) => item.status === "PENDING").length,
            respondedQuotes: quoteRequests.filter((item) => item.status === "RESPONDED").length,
            acceptedQuotes: quoteRequests.filter((item) => item.status === "ACCEPTED").length,
            canceledRequests: quoteRequests.filter((item) => item.status === "CANCELED").length,
            reservationsPending: visibleReservationStatuses.filter((status) => status === "PENDING").length,
            reservationsConfirmed: visibleReservationStatuses.filter((status) => status === "CONFIRMED").length,
            acceptedQuoteRequestId: acceptedQuote?.request.id ?? null,
            acceptedQuoteResponseId:
              acceptedQuote?.latestResponse?.id ?? acceptedQuote?.reservation?.quoteResponseId ?? null,
            reservationId: acceptedReservation?.id ?? null,
            nextAction: getPlanNextAction(quoteRequests)
          }
        };
      })
    );
  } catch (error) {
    return actionError(getActionError(error), "GET_PLANS_WITH_QUOTE_STATUS_FAILED");
  }
}

export async function getUserPlanOverview(): Promise<ActionResult<PlanDashboardData[]>> {
  return getPlansWithQuoteStatus();
}

export async function getUserPlans(): Promise<ActionResult<EventPlanData[]>> {
  try {
    const user = await requireGeneralUser();

    if (user.role !== UserRole.GENERAL) {
      return actionError("권한이 없습니다.", "FORBIDDEN");
    }

    const plans = await prisma.eventPlan.findMany({
      where: { ownerId: user.id, type: { in: [PrismaEventType.WEDDING, PrismaEventType.FUNERAL] } },
      orderBy: { createdAt: "desc" }
    });

    return actionSuccess(plans.map(mapEventPlan));
  } catch (error) {
    return actionError(getActionError(error), "GET_USER_PLANS_FAILED");
  }
}
