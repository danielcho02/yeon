import { Prisma, QuoteStatus } from "@/generated/prisma/client";
import { assertQuoteTransition } from "@/lib/state-machine";
import {
  createWorkflowActivity,
  createWorkflowNotification,
  getPlanHref
} from "@/lib/workflow-events";

type DeclinePendingQuoteRequestInput = {
  requestId: string;
  vendorId: string;
  reason?: string | null;
};

type DeclinePendingQuoteRequestResult = {
  planId: string;
  vendorId: string;
  request: {
    id: string;
    planId: string;
    vendorId: string;
    requirements: string;
    selectedModules: Prisma.JsonValue | null;
    preferredDate: Date | null;
    budget: number | null;
    status: QuoteStatus;
    createdAt: Date;
  };
};

export async function declinePendingQuoteRequest(
  tx: Prisma.TransactionClient,
  input: DeclinePendingQuoteRequestInput
): Promise<DeclinePendingQuoteRequestResult> {
  if (!input.requestId) {
    throw new Error("견적 요청 ID가 필요합니다.");
  }

  const request = await tx.quoteRequest.findUnique({
    where: { id: input.requestId },
    include: {
      plan: {
        select: {
          id: true,
          ownerId: true,
          title: true
        }
      },
      reservation: {
        select: { id: true }
      },
      responses: {
        select: { id: true },
        take: 1
      }
    }
  });

  if (!request) {
    throw new Error("견적 요청을 찾을 수 없습니다.");
  }

  if (request.vendorId !== input.vendorId) {
    throw new Error("이 요청에 응답할 권한이 없습니다.");
  }

  if (request.status !== QuoteStatus.PENDING) {
    throw new Error("응답 가능한 견적 요청이 아닙니다.");
  }

  if (request.reservation) {
    throw new Error("이미 예약 단계로 전환된 요청은 일정 불가로 회신할 수 없습니다.");
  }

  if (request.responses.length > 0) {
    throw new Error("이미 견적 응답이 제출된 요청입니다.");
  }

  assertQuoteTransition("PENDING", "CANCELED");

  const reason = input.reason?.trim() || "업체에서 일정 불가로 응답했습니다.";
  const declined = await tx.quoteRequest.updateMany({
    where: {
      id: request.id,
      vendorId: input.vendorId,
      status: QuoteStatus.PENDING
    },
    data: {
      status: QuoteStatus.CANCELED
    }
  });

  if (declined.count !== 1) {
    throw new Error("이미 처리되었거나 일정 불가로 회신할 수 없는 요청입니다.");
  }

  await createWorkflowNotification(tx, {
    userId: request.plan.ownerId,
    type: "QUOTE_REQUEST_DECLINED",
    title: "업체가 일정 불가로 응답했습니다",
    message: `${request.plan.title} 견적 요청에 일정 불가 응답이 도착했습니다.`,
    href: getPlanHref(request.planId),
    metadata: {
      planId: request.planId,
      vendorId: request.vendorId,
      quoteRequestId: request.id,
      reason
    }
  });

  await createWorkflowActivity(tx, {
    actorId: input.vendorId,
    planId: request.planId,
    vendorId: input.vendorId,
    quoteRequestId: request.id,
    type: "QUOTE_REQUEST_DECLINED",
    message: "업체가 견적 요청을 일정 불가로 거절했습니다.",
    metadata: {
      reason
    }
  });

  return {
    planId: request.planId,
    vendorId: request.vendorId,
    request: {
      id: request.id,
      planId: request.planId,
      vendorId: request.vendorId,
      requirements: request.requirements,
      selectedModules: request.selectedModules,
      preferredDate: request.preferredDate,
      budget: request.budget,
      status: QuoteStatus.CANCELED,
      createdAt: request.createdAt
    }
  };
}
