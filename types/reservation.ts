import type { QuoteResponseData, QuoteStatus } from "./quote";
import type { VendorProfileData } from "./user";
import type { VendorPackagePriceSnapshot, VendorPackageSnapshot } from "./vendor-package";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CHANGED"
  | "CANCELED"
  | "COMPLETED";

export type ReservationRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ReservationChangeRequestData {
  id: string;
  reservationId: string;
  plannerId: string;
  vendorId: string;
  requestedServiceDate: string | null;
  requestedGuestCount: number | null;
  requestedNotes: string | null;
  requestedReason: string;
  requestedSelectedServiceOptions: VendorDashboardSelectedServiceOptionDTO[] | null;
  status: ReservationRequestStatus;
  vendorDecisionMemo: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationCancellationRequestData {
  id: string;
  reservationId: string;
  plannerId: string;
  vendorId: string;
  reason: string;
  status: ReservationRequestStatus;
  vendorDecisionMemo: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationData {
  id: string;
  planId: string;
  vendorId: string;
  quoteRequestId: string | null;
  quoteResponseId: string | null;
  quoteProposalRevisionId: string | null;
  reservedDate: string;
  totalAmount: number;
  vendorConfirmationDueAt: string | null;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  vendor?: VendorProfileData;
  quoteResponse?: QuoteResponseData;
  pendingChangeRequest?: ReservationChangeRequestData | null;
  pendingCancellationRequest?: ReservationCancellationRequestData | null;
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
  selectedPackageSnapshot?: VendorPackageSnapshot | null;
  priceSnapshot?: VendorPackagePriceSnapshot | null;
  selectedServiceOptions: VendorDashboardSelectedServiceOptionDTO[] | null;
  pendingChangeRequests?: ReservationChangeRequestData[];
  pendingCancellationRequests?: ReservationCancellationRequestData[];
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

export interface VendorDashboardReservationChangeRequestDTO extends ReservationChangeRequestData {
  reservation: VendorDashboardReservationDTO;
}

export interface VendorDashboardReservationCancellationRequestDTO extends ReservationCancellationRequestData {
  reservation: VendorDashboardReservationDTO;
}

export interface VendorDashboardReservationCountsDTO {
  newRequestsCount: number;
  pendingConfirmationsCount: number;
  confirmedReservationsCount: number;
  respondedQuotesCount: number;
  pendingChangeRequestsCount: number;
  pendingCancellationRequestsCount: number;
}

export interface VendorDashboardReservationContractDTO {
  reservations: VendorDashboardReservationDTO[];
  newQuoteRequests: VendorDashboardReservationDTO[];
  quoteResponsesWaitingForUserAcceptance: VendorDashboardReservationDTO[];
  pendingConfirmations: VendorDashboardReservationDTO[];
  confirmedReservations: VendorDashboardReservationDTO[];
  pendingChangeRequests: VendorDashboardReservationChangeRequestDTO[];
  pendingCancellationRequests: VendorDashboardReservationCancellationRequestDTO[];
  counts: VendorDashboardReservationCountsDTO;
}
