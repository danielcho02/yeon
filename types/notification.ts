import type { Prisma } from "@/generated/prisma/client";

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  linkHref: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  metadata: Prisma.JsonValue | null;
}

export interface MarkAllNotificationsAsReadResult {
  updatedCount: number;
}

export type NotificationData = NotificationDTO;
