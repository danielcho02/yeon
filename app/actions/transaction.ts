"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { TransactionStatus, TransactionType as PrismaTransactionType } from "@/generated/prisma/client";
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "@/types/common";
import type {
  CreateTransactionPayload,
  TransactionData,
  TransactionSummary
} from "@/types/transaction";

import { mapTransaction, requireGeneralUser } from "./_utils";

const createTransactionSchema = z.object({
  planId: z.string().min(1),
  senderName: z.string().trim().min(1),
  amount: z.number().int().positive(),
  relation: z.string().trim().optional(),
  message: z.string().trim().optional(),
  type: z.enum(["ONLINE", "OFFLINE"])
});

const bulkCreateTransactionSchema = z.array(createTransactionSchema).min(1).max(200);

function revalidateTransactionViews(planId?: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  if (planId) revalidatePath(`/plans/${planId}`);
}

async function assertOwnedPlan(planId: string, ownerId: string) {
  const plan = await prisma.eventPlan.findFirst({
    where: { id: planId, ownerId },
    select: { id: true }
  });

  if (!plan) {
    throw new Error("플랜을 찾을 수 없습니다.");
  }
}

export async function createTransaction(
  payload: CreateTransactionPayload
): Promise<ActionResult<TransactionData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createTransactionSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    await assertOwnedPlan(parsed.data.planId, user.id);

    const transaction = await prisma.transaction.create({
      data: {
        planId: parsed.data.planId,
        payerId: user.id,
        senderName: parsed.data.senderName,
        amount: parsed.data.amount,
        relation: parsed.data.relation ?? null,
        message: parsed.data.message ?? null,
        type:
          parsed.data.type === "ONLINE"
            ? PrismaTransactionType.ONLINE
            : PrismaTransactionType.OFFLINE,
        status: TransactionStatus.SUCCEEDED
      }
    });

    revalidateTransactionViews(transaction.planId ?? undefined);
    return actionSuccess(mapTransaction(transaction));
  } catch (error) {
    return actionError(getActionError(error), "CREATE_TRANSACTION_FAILED");
  }
}

export async function bulkCreateTransactions(
  payloads: CreateTransactionPayload[]
): Promise<ActionResult<TransactionData[]>> {
  try {
    const user = await requireGeneralUser();
    const parsed = bulkCreateTransactionSchema.safeParse(payloads);

    if (!parsed.success) {
      return actionError("입력값을 확인해 주세요.", "VALIDATION_ERROR");
    }

    const planIds = [...new Set(parsed.data.map((payload) => payload.planId))];
    await Promise.all(planIds.map((planId) => assertOwnedPlan(planId, user.id)));

    const transactions = await prisma.$transaction(
      parsed.data.map((payload) =>
        prisma.transaction.create({
          data: {
            planId: payload.planId,
            payerId: user.id,
            senderName: payload.senderName,
            amount: payload.amount,
            relation: payload.relation ?? null,
            message: payload.message ?? null,
            type:
              payload.type === "ONLINE"
                ? PrismaTransactionType.ONLINE
                : PrismaTransactionType.OFFLINE,
            status: TransactionStatus.SUCCEEDED
          }
        })
      )
    );

    planIds.forEach((planId) => revalidateTransactionViews(planId));
    return actionSuccess(transactions.map(mapTransaction));
  } catch (error) {
    return actionError(getActionError(error), "BULK_CREATE_TRANSACTIONS_FAILED");
  }
}

export async function getTransactionSummary(
  planId: string
): Promise<ActionResult<TransactionSummary>> {
  try {
    const user = await requireGeneralUser();

    if (!planId) {
      return actionError("플랜 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    await assertOwnedPlan(planId, user.id);

    const transactions = await prisma.transaction.findMany({
      where: { planId },
      select: {
        amount: true,
        relation: true,
        type: true
      }
    });

    const byRelationMap = new Map<string, { amount: number; count: number }>();
    let onlineAmount = 0;
    let offlineAmount = 0;

    for (const transaction of transactions) {
      if (transaction.type === PrismaTransactionType.ONLINE) {
        onlineAmount += transaction.amount;
      } else {
        offlineAmount += transaction.amount;
      }

      const relation = transaction.relation ?? "미분류";
      const current = byRelationMap.get(relation) ?? { amount: 0, count: 0 };
      byRelationMap.set(relation, {
        amount: current.amount + transaction.amount,
        count: current.count + 1
      });
    }

    return actionSuccess({
      totalAmount: onlineAmount + offlineAmount,
      totalCount: transactions.length,
      onlineAmount,
      offlineAmount,
      byRelation: [...byRelationMap.entries()].map(([relation, value]) => ({
        relation,
        amount: value.amount,
        count: value.count
      }))
    });
  } catch (error) {
    return actionError(getActionError(error), "GET_TRANSACTION_SUMMARY_FAILED");
  }
}
