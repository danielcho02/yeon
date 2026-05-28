import "server-only";

import { Prisma } from "@/generated/prisma/client";

export const VENDOR_CONFIRMATION_SLA_DAYS = 3;

type WorkflowMetadata = Prisma.InputJsonObject;

type WorkflowRefs = {
  actorId?: string | null;
  planId?: string | null;
  vendorId?: string | null;
  quoteRequestId?: string | null;
  quoteResponseId?: string | null;
  reservationId?: string | null;
  metadata?: WorkflowMetadata;
};

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  metadata?: WorkflowMetadata;
};

type ActivityLogInput = WorkflowRefs & {
  type: string;
  message: string;
};

function metadataData(metadata: WorkflowMetadata | undefined) {
  return metadata ? { metadata } : {};
}

export function getVendorConfirmationDueAt(now = new Date()) {
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + VENDOR_CONFIRMATION_SLA_DAYS);
  return dueAt;
}

export function getPlanHref(planId: string) {
  return `/plans/${planId}`;
}

export function getVendorDashboardHref() {
  return "/vendor/dashboard";
}

export async function createWorkflowNotification(
  tx: Prisma.TransactionClient,
  input: NotificationInput
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href ?? null,
      ...metadataData(input.metadata)
    }
  });
}

export async function createWorkflowActivity(
  tx: Prisma.TransactionClient,
  input: ActivityLogInput
) {
  return tx.activityLog.create({
    data: {
      actorId: input.actorId ?? null,
      planId: input.planId ?? null,
      vendorId: input.vendorId ?? null,
      quoteRequestId: input.quoteRequestId ?? null,
      quoteResponseId: input.quoteResponseId ?? null,
      reservationId: input.reservationId ?? null,
      type: input.type,
      message: input.message,
      ...metadataData(input.metadata)
    }
  });
}
