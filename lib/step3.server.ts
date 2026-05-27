import "server-only";

import { EventType } from "@/generated/prisma/client";

export const mvpEventTypes: EventType[] = [EventType.WEDDING, EventType.FUNERAL];

export function parseEventType(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return Object.values(EventType).includes(value as EventType)
    ? (value as EventType)
    : null;
}

export function parseMvpEventType(value: unknown) {
  const parsed = parseEventType(value);

  if (!parsed) {
    return null;
  }

  return mvpEventTypes.includes(parsed) ? parsed : null;
}

export function buildEventPlanSlug(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = Date.now().toString(36);

  return `${base || "event-plan"}-${suffix}`;
}
