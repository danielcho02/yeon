import type { QuoteResponseData, QuoteStatus } from "./quote";
import type { VendorProfileData } from "./user";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CHANGED"
  | "CANCELED"
  | "COMPLETED";

export interface ReservationData {
  id: string;
  planId: string;
  vendorId: string;
  quoteRequestId: string | null;
  quoteResponseId: string | null;
  reservedDate: string;
  totalAmount: number;
  vendorConfirmationDueAt: string | null;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  vendor?: VendorProfileData;
  quoteResponse?: QuoteResponseData;
}

export interface CreateReservationPayload {
  planId: string;
  vendorId: string;
  quoteResponseId?: string;
  reservedDate: string;
  totalAmount: number;
}

export interface VendorDashboardSelectedServiceOptionDTO {
  catalogKey: string | null;
  name: string;
  price: number;
  pricingType: string;
  quantity?: number;
  subtotal?: number;
}

export interface VendorDashboardReservationDTO {
  id: string;
  serviceName: string;
  serviceCategory: string | null;
  serviceDate: string | null;
  guestCount: number | null;
  quotedAmount: number | null;
  confirmedAmount: number | null;
  vendorConfirmationDueAt: string | null;
  notes: string | null;
  requestMemo: string | null;
  responseMessage: string | null;
  status: ReservationStatus;
  quoteRequestId: string | null;
  quoteResponseId: string | null;
  quoteRequestStatus: QuoteStatus | null;
  selectedServiceOptions: VendorDashboardSelectedServiceOptionDTO[] | null;
  eventPlan: {
    id: string;
    title: string;
    type?: string;
    region?: string | null;
    scheduledAt?: string | null;
    hostName?: string | null;
    honoreeName?: string | null;
  };
  vendor: {
    id: string;
    name: string;
    companyName: string | null;
    location: string | null;
  };
}

export interface VendorDashboardReservationCountsDTO {
  newRequestsCount: number;
  pendingConfirmationsCount: number;
  confirmedReservationsCount: number;
  respondedQuotesCount: number;
}

export interface VendorDashboardReservationContractDTO {
  reservations: VendorDashboardReservationDTO[];
  newQuoteRequests: VendorDashboardReservationDTO[];
  quoteResponsesWaitingForUserAcceptance: VendorDashboardReservationDTO[];
  pendingConfirmations: VendorDashboardReservationDTO[];
  confirmedReservations: VendorDashboardReservationDTO[];
  counts: VendorDashboardReservationCountsDTO;
}
