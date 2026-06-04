"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "@/types/common";
import type {
  MarkAllNotificationsAsReadResult,
  NotificationDTO
} from "@/types/notification";

import { requireSessionUser } from "./_utils";

type NotificationLike = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

const notificationIdSchema = z.string().min(1);

function revalidateNotificationViews() {
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

function mapNotification(notification: NotificationLike): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkHref: notification.href,
    isRead: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    metadata: notification.metadata
  };
}

export async function getNotifications(): Promise<ActionResult<NotificationDTO[]>> {
  try {
    const user = await requireSessionUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return actionSuccess(notifications.map(mapNotification));
  } catch (error) {
    return actionError(getActionError(error), "GET_NOTIFICATIONS_FAILED");
  }
}

export async function getUnreadNotificationCount(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const user = await requireSessionUser();
    const count = await prisma.notification.count({
      where: { userId: user.id, readAt: null }
    });

    return actionSuccess({ count });
  } catch (error) {
    return actionError(getActionError(error), "GET_UNREAD_NOTIFICATIONS_FAILED");
  }
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<ActionResult<NotificationDTO>> {
  try {
    const user = await requireSessionUser();
    const parsed = notificationIdSchema.safeParse(notificationId);

    if (!parsed.success) {
      return actionError("알림 ID가 필요합니다.", "VALIDATION_ERROR");
    }

    const notification = await prisma.notification.findFirst({
      where: { id: parsed.data, userId: user.id }
    });

    if (!notification) {
      return actionError("알림을 찾을 수 없습니다.", "NOT_FOUND");
    }

    if (notification.readAt) {
      return actionSuccess(mapNotification(notification));
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() }
    });

    revalidateNotificationViews();
    return actionSuccess(mapNotification(updated));
  } catch (error) {
    return actionError(getActionError(error), "MARK_NOTIFICATION_READ_FAILED");
  }
}

export async function markAllNotificationsAsRead(): Promise<
  ActionResult<MarkAllNotificationsAsReadResult>
> {
  try {
    const user = await requireSessionUser();
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() }
    });

    revalidateNotificationViews();
    return actionSuccess({ updatedCount: result.count });
  } catch (error) {
    return actionError(getActionError(error), "MARK_ALL_NOTIFICATIONS_READ_FAILED");
  }
}
