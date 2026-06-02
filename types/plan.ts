import type { InvitationData } from "./invitation";
import type {
  QuoteRequestData,
  QuoteRequestWithResponses,
  QuoteResponseData,
  QuoteStatus
} from "./quote";
import type { ReservationData } from "./reservation";
import type { TransactionData } from "./transaction";
import type { VendorProfileData } from "./user";

export type EventType = "WEDDING" | "FUNERAL";
export type PlanStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export interface EventPlanData {
  id: string;
  userId: string;
  eventType: EventType;
  title: string | null;
  eventDate: string | null;
  location: string | null;
  guestCount: number | null;
  budget: number | null;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanPayload {
  eventType: EventType;
  title?: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
}

export interface UpdatePlanPayload {
  title?: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: number;
}

export interface EventPlanWithDetails extends EventPlanData {
  quoteRequests: QuoteRequestWithResponses[];
  reservations: ReservationData[];
  transactions: TransactionData[];
  invitation: InvitationData | null;
}

export type PlanDashboardNextAction =
  | "create_quote_request"
  | "waiting_for_vendor"
  | "compare_quotes"
  | "accept_quote"
  | "adjustment_requested"
  | "revised_quote_received"
  | "reservation_pending"
  | "confirmed"
  | "canceled";

export interface PlanQuoteStatusData {
  request: QuoteRequestData;
  vendor: VendorProfileData;
  latestResponse: QuoteResponseData | null;
  reservation: ReservationData | null;
  status: QuoteStatus;
  nextAction: PlanDashboardNextAction;
}

export interface PlanQuoteStatusSummary {
  pendingRequests: number;
  respondedQuotes: number;
  acceptedQuotes: number;
  canceledRequests: number;
  reservationsPending: number;
  reservationsConfirmed: number;
  acceptedQuoteRequestId: string | null;
  acceptedQuoteResponseId: string | null;
  reservationId: string | null;
  nextAction: PlanDashboardNextAction;
}

export interface PlanDashboardData extends EventPlanData {
  quoteRequests: PlanQuoteStatusData[];
  summary: PlanQuoteStatusSummary;
}
