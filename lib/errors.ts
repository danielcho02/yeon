import type { ActionResult } from "@/types/common";
import { Prisma } from "@/generated/prisma/client";

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionError(error: string, code = "UNKNOWN"): ActionResult<never> {
  return { success: false, error, code };
}

export function getActionError(error: unknown, fallback = "요청 처리 중 오류가 발생했습니다.") {
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
