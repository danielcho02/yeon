import type { ActionResult } from "@/types/common";
import { Prisma } from "@/generated/prisma/client";

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionError(error: string, code = "UNKNOWN"): ActionResult<never> {
  return { success: false, error, code };
}

export function isDatabaseBusyError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";

  return /SQLITE_BUSY|database is locked|database is busy|busy executing a query/i.test(message);
}

export function getActionError(error: unknown, fallback = "요청 처리 중 오류가 발생했습니다.") {
  if (isDatabaseBusyError(error)) {
    return "요청이 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function isPrismaUniqueConstraintError(
  error: unknown,
  target?: string | string[]
) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  if (!target) return true;

  const targets = Array.isArray(target) ? target : [target];
  const metaTarget = error.meta?.target;
  const normalizedMetaTarget = Array.isArray(metaTarget)
    ? metaTarget.join(",")
    : typeof metaTarget === "string"
      ? metaTarget
      : "";

  return targets.some((item) => normalizedMetaTarget.includes(item) || error.message.includes(item));
}
