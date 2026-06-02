import type { PlanDashboardNextAction, PlanQuoteStatusData } from "@/types/plan";
import type { QuoteProposalRevisionStatus, QuoteStatus } from "@/types/quote";
import type { ReservationStatus } from "@/types/reservation";

export function resolveQuoteRequestNextAction({
  quoteStatus,
  reservationStatus,
  currentRevisionStatus,
  hasResponse
}: {
  quoteStatus: QuoteStatus;
  reservationStatus: ReservationStatus | null;
  currentRevisionStatus?: QuoteProposalRevisionStatus | null;
  hasResponse: boolean;
}): PlanDashboardNextAction {
  if (quoteStatus === "ACCEPTED") {
    if (reservationStatus === "CONFIRMED") return "confirmed";
    return "reservation_pending";
  }

  if (reservationStatus === "CONFIRMED") return "confirmed";

  if (quoteStatus === "RESPONDED" && hasResponse) {
    if (currentRevisionStatus === "ADJUSTMENT_REQUESTED") return "adjustment_requested";
    if (currentRevisionStatus === "REVISED") return "revised_quote_received";
    return "accept_quote";
  }

  if (quoteStatus === "PENDING") return "waiting_for_vendor";
  return "canceled";
}

export function resolvePlanNextAction(items: PlanQuoteStatusData[]): PlanDashboardNextAction {
  if (items.some((item) => item.nextAction === "confirmed")) return "confirmed";
  if (items.some((item) => item.nextAction === "reservation_pending")) return "reservation_pending";
  if (items.some((item) => item.nextAction === "revised_quote_received")) return "revised_quote_received";
  if (items.some((item) => item.nextAction === "adjustment_requested")) return "adjustment_requested";
  if (items.some((item) => item.status === "RESPONDED" && item.latestResponse)) return "compare_quotes";
  if (items.some((item) => item.status === "PENDING")) return "waiting_for_vendor";
  if (items.length === 0) return "create_quote_request";
  return "canceled";
}
