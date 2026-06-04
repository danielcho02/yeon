"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { TransactionStatus, TransactionType as PrismaTransactionType } from "@/generated/prisma/client";
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "@/types/common";
import type {
  CreateSettlementEntryPayload,
  SettlementEntryData,
  SettlementSummary,
  UpdateSettlementEntryPayload
} from "@/types/settlement";

import { requireGeneralUser } from "./_utils";

const createSettlementSchema = z.object({
  planId: z.string().min(1),
  senderName: z.string().trim().min(1, "이름을 입력해 주세요."),
  amount: z.number().int().positive("금액은 0보다 커야 합니다."),
  relation: z.string().trim().optional(),
  message: z.string().trim().optional(),
  type: z.enum(["ONLINE", "OFFLINE"]),
  paidAt: z.string().optional()
});

const updateSettlementSchema = z.object({
  senderName: z.string().trim().min(1, "이름을 입력해 주세요.").optional(),
  amount: z.number().int().positive("금액은 0보다 커야 합니다.").optional(),
  relation: z.string().trim().optional(),
  message: z.string().trim().optional(),
  type: z.enum(["ONLINE", "OFFLINE"]).optional(),
  paidAt: z.string().optional()
});

function revalidateSettlementViews(planId: string) {
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/settlement`);
}

async function assertOwnedPlan(planId: string, ownerId: string) {
  const plan = await prisma.eventPlan.findFirst({
    where: { id: planId, ownerId },
    select: { id: true, type: true }
  });

  if (!plan) {
    throw new Error("플랜을 찾을 수 없습니다.");
  }
  return plan;
}

export async function createSettlementEntry(
  payload: CreateSettlementEntryPayload
): Promise<ActionResult<SettlementEntryData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = createSettlementSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError(
        parsed.error.issues[0]?.message || "입력값을 확인해 주세요.",
        "VALIDATION_ERROR"
      );
    }

    await assertOwnedPlan(parsed.data.planId, user.id);

    const paidAtDate = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

    const transaction = await prisma.transaction.create({
      data: {
        planId: parsed.data.planId,
        payerId: user.id,
        senderName: parsed.data.senderName,
        amount: parsed.data.amount,
        relation: parsed.data.relation || null,
        message: parsed.data.message || null,
        type: parsed.data.type === "ONLINE" ? PrismaTransactionType.ONLINE : PrismaTransactionType.OFFLINE,
        status: TransactionStatus.SUCCEEDED,
        paidAt: paidAtDate,
        reservationId: null
      }
    });

    revalidateSettlementViews(parsed.data.planId);
    return actionSuccess({
      id: transaction.id,
      planId: transaction.planId || "",
      senderName: transaction.senderName || "",
      amount: transaction.amount,
      relation: transaction.relation,
      message: transaction.message,
      type: transaction.type === PrismaTransactionType.ONLINE ? "ONLINE" : "OFFLINE",
      paidAt: transaction.paidAt ? transaction.paidAt.toISOString() : transaction.createdAt.toISOString(),
      createdAt: transaction.createdAt.toISOString()
    });
  } catch (error) {
    return actionError(getActionError(error), "CREATE_SETTLEMENT_ENTRY_FAILED");
  }
}

export async function updateSettlementEntry(
  id: string,
  payload: UpdateSettlementEntryPayload
): Promise<ActionResult<SettlementEntryData>> {
  try {
    const user = await requireGeneralUser();
    const parsed = updateSettlementSchema.safeParse(payload);

    if (!parsed.success) {
      return actionError(
        parsed.error.issues[0]?.message || "입력값을 확인해 주세요.",
        "VALIDATION_ERROR"
      );
    }

    const entry = await prisma.transaction.findUnique({
      where: { id },
      select: { planId: true }
    });

    if (!entry || !entry.planId) {
      return actionError("내역을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: entry.planId, ownerId: user.id },
      select: { id: true }
    });

    if (!plan) {
      return actionError("수정 권한이 없습니다.", "FORBIDDEN");
    }

    const updateData: {
      senderName?: string;
      amount?: number;
      relation?: string | null;
      message?: string | null;
      type?: PrismaTransactionType;
      paidAt?: Date | null;
    } = {};
    if (parsed.data.senderName !== undefined) updateData.senderName = parsed.data.senderName;
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
    if (parsed.data.relation !== undefined) updateData.relation = parsed.data.relation || null;
    if (parsed.data.message !== undefined) updateData.message = parsed.data.message || null;
    if (parsed.data.type !== undefined) {
      updateData.type = parsed.data.type === "ONLINE" ? PrismaTransactionType.ONLINE : PrismaTransactionType.OFFLINE;
    }
    if (parsed.data.paidAt !== undefined) {
      updateData.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData
    });

    if (transaction.planId) {
      revalidateSettlementViews(transaction.planId);
    }

    return actionSuccess({
      id: transaction.id,
      planId: transaction.planId || "",
      senderName: transaction.senderName || "",
      amount: transaction.amount,
      relation: transaction.relation,
      message: transaction.message,
      type: transaction.type === PrismaTransactionType.ONLINE ? "ONLINE" : "OFFLINE",
      paidAt: transaction.paidAt ? transaction.paidAt.toISOString() : transaction.createdAt.toISOString(),
      createdAt: transaction.createdAt.toISOString()
    });
  } catch (error) {
    return actionError(getActionError(error), "UPDATE_SETTLEMENT_ENTRY_FAILED");
  }
}

export async function deleteSettlementEntry(id: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const user = await requireGeneralUser();

    const entry = await prisma.transaction.findUnique({
      where: { id },
      select: { planId: true }
    });

    if (!entry || !entry.planId) {
      return actionError("내역을 찾을 수 없습니다.", "NOT_FOUND");
    }

    const plan = await prisma.eventPlan.findFirst({
      where: { id: entry.planId, ownerId: user.id },
      select: { id: true }
    });

    if (!plan) {
      return actionError("삭제 권한이 없습니다.", "FORBIDDEN");
    }

    await prisma.transaction.delete({
      where: { id }
    });

    if (entry.planId) {
      revalidateSettlementViews(entry.planId);
    }

    return actionSuccess({ success: true });
  } catch (error) {
    return actionError(getActionError(error), "DELETE_SETTLEMENT_ENTRY_FAILED");
  }
}

export async function getSettlementEntries(planId: string): Promise<ActionResult<SettlementEntryData[]>> {
  try {
    const user = await requireGeneralUser();
    await assertOwnedPlan(planId, user.id);

    const transactions = await prisma.transaction.findMany({
      where: { planId, reservationId: null },
      orderBy: { paidAt: "desc" }
    });

    const data: SettlementEntryData[] = transactions.map((t) => ({
      id: t.id,
      planId: t.planId || "",
      senderName: t.senderName || "",
      amount: t.amount,
      relation: t.relation,
      message: t.message,
      type: t.type === PrismaTransactionType.ONLINE ? "ONLINE" : "OFFLINE",
      paidAt: t.paidAt ? t.paidAt.toISOString() : t.createdAt.toISOString(),
      createdAt: t.createdAt.toISOString()
    }));

    return actionSuccess(data);
  } catch (error) {
    return actionError(getActionError(error), "GET_SETTLEMENT_ENTRIES_FAILED");
  }
}

export async function getSettlementSummary(planId: string): Promise<ActionResult<SettlementSummary>> {
  try {
    const user = await requireGeneralUser();
    await assertOwnedPlan(planId, user.id);

    const transactions = await prisma.transaction.findMany({
      where: { planId, reservationId: null },
      select: {
        amount: true,
        relation: true,
        type: true
      }
    });

    const totalAmount = transactions.reduce((acc, t) => acc + t.amount, 0);
    const totalCount = transactions.length;
    const averageAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

    const relationMap = new Map<string, { amount: number; count: number }>();
    const typeMap = new Map<"ONLINE" | "OFFLINE", { amount: number; count: number }>();
    typeMap.set("ONLINE", { amount: 0, count: 0 });
    typeMap.set("OFFLINE", { amount: 0, count: 0 });

    for (const t of transactions) {
      const relation = t.relation || "미분류";
      const relStat = relationMap.get(relation) || { amount: 0, count: 0 };
      relationMap.set(relation, {
        amount: relStat.amount + t.amount,
        count: relStat.count + 1
      });

      const typeKey = t.type === PrismaTransactionType.ONLINE ? "ONLINE" : "OFFLINE";
      const typeStat = typeMap.get(typeKey)!;
      typeMap.set(typeKey, {
        amount: typeStat.amount + t.amount,
        count: typeStat.count + 1
      });
    }

    const byRelation = [...relationMap.entries()]
      .map(([relation, stat]) => ({ relation, ...stat }))
      .sort((a, b) => b.amount - a.amount);

    const byType = [...typeMap.entries()].map(([type, stat]) => ({ type, ...stat }));

    return actionSuccess({
      totalAmount,
      totalCount,
      averageAmount,
      byRelation,
      byType
    });
  } catch (error) {
    return actionError(getActionError(error), "GET_SETTLEMENT_SUMMARY_FAILED");
  }
}
