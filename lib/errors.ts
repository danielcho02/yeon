import type { ActionResult } from "@/types/common";

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
