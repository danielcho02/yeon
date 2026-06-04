import type { VendorProfileData } from "./user";
import type { ReservationData } from "./reservation";
import type { QuoteModule, VendorServiceModuleData } from "./vendor-module";
import type { VendorPackagePriceSnapshot, VendorPackageSnapshot } from "./vendor-package";

export type QuoteStatus = "PENDING" | "RESPONDED" | "ACCEPTED" | "CANCELED";
export type QuoteRequestStatus = QuoteStatus;
export type QuoteResponseStatus = "SUBMITTED" | "ACCEPTED" | "NOT_SELECTED";
export type QuoteProposalRevisionStatus =
  | "SUBMITTED"
  | "ADJUSTMENT_REQUESTED"
  | "REVISED"
  | "ACCEPTED";

export interface BasePackage {
  name: string;
  price: number;
  description: string;
}

export interface QuoteResponseModules {
  basePackage: BasePackage;
  includedModules: QuoteModule[];
  optionalModules: QuoteModule[];
  excludedModules: { id: string; name: string; reason: string }[];
}

export interface QuoteRequestData {
  id: string;
  planId: string;
  vendorId: string;
  requirements: string;
  requestMemo: string;
  selectedPackageId?: string | null;
  selectedPackageSnapshot?: VendorPackageSnapshot | null;
  priceSnapshot?: VendorPackagePriceSnapshot | null;
  selectedModules: string[];
  preferredDate: string | null;
  preferredDateStart: string | null;
  preferredDateEnd: string | null;
  budget: number | null;
  status: QuoteStatus;
  createdAt: string;
}

export interface QuoteResponseData {
  id: string;
  requestId: string;
  vendorId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note: string | null;
  responseMessage: string | null;
  createdAt: string;
  vendor?: VendorProfileData;
  revisions: QuoteProposalRevisionData[];
  currentRevision: QuoteProposalRevisionData | null;
}

export interface QuoteProposalRevisionData {
  id: string;
  quoteResponseId: string;
  requestId: string;
  vendorId: string;
  version: number;
  totalPrice: number;
  memo: string | null;
  adjustmentRequestMemo: string | null;
  plannerRequestedTotalPrice: number | null;
  proposedServiceDate: string | null;
  status: QuoteProposalRevisionStatus;
  createdAt: string;
}

export interface QuoteRequestPlanSummaryDTO {
  id: string;
  title: string;
  eventType: "WEDDING" | "FUNERAL" | string;
  eventDate: string | null;
  location: string | null;
  guestCount: number | null;
  budget: number | null;
}

export interface QuoteRequestWithResponses extends QuoteRequestData {
  vendor?: VendorProfileData;
  plan?: QuoteRequestPlanSummaryDTO;
  selectedModuleDetails?: VendorServiceModuleData[];
  reservation?: ReservationData | null;
  responses: QuoteResponseData[];
}

export interface CreateQuoteRequestPayload {
  planId: string;
  vendorId: string;
  requirements: string;
  requestMemo?: string;
  selectedPackageId?: string;
  selectedModuleIds: string[];
  guestCount?: number;
  preferredDate?: string;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  budget?: number;
}

export interface SubmitQuoteResponsePayload {
  requestId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note?: string;
  responseMessage?: string;
  proposedServiceDate?: string;
}

export interface AcceptQuoteResponsePayload {
  quoteResponseId: string;
  quoteProposalRevisionId?: string;
  reservedDate?: string;
}

export interface RequestQuoteAdjustmentPayload {
  quoteResponseId: string;
  plannerRequestedTotalPrice: number;
  memo: string;
}

export interface SubmitQuoteRevisionPayload {
  quoteResponseId: string;
  totalPrice: number;
  memo?: string;
  proposedServiceDate?: string;
}

export interface AcceptQuoteResult {
  quoteRequest: QuoteRequestData;
  quoteResponse: QuoteResponseData;
  reservation: ReservationData;
  nextAction: "reservation_pending" | "confirmed";
}

export type QuoteLineItemDTO = QuoteModule;
export type VendorModuleDTO = VendorServiceModuleData;
export type QuoteRequestDTO = QuoteRequestData;
export type QuoteResponseDTO = QuoteResponseData;
export type QuoteRequestWithResponsesDTO = QuoteRequestWithResponses;
export type CreateQuoteRequestInput = CreateQuoteRequestPayload;
export type SubmitQuoteResponseInput = SubmitQuoteResponsePayload;
export type AcceptQuoteResponseInput = AcceptQuoteResponsePayload;
export type QuoteRequestForVendorDTO = QuoteRequestWithResponses;

export interface Step4CategoryStatusDTO {
  key: string;
  label: string;
  eventType: "WEDDING" | "FUNERAL";
  comparableGroupKey: string;
  status:
    | "NOT_REQUESTED"
    | "REQUESTED"
    | "RESPONDED"
    | "ADJUSTMENT_REQUESTED"
    | "REVISED"
    | "ACCEPTED_WAITING_VENDOR"
    | "CONFIRMED";
  vendorSummaries: Array<{
    vendorId: string;
    vendorName: string;
    vendorRole: "PRIMARY" | "INCLUDED" | "ADDON" | "OPTIONAL" | "BUNDLE";
    quoteRequestId?: string;
    quoteResponseId?: string;
    reservationId?: string;
    totalPrice?: number;
    status: string;
  }>;
  canCompare: boolean;
  canAccept: boolean;
  nextActionLabel: string;
}

export interface Step3PreparationGroupDTO {
  key: string;
  label: string;
  eventType: "WEDDING" | "FUNERAL";
  mode: "PACKAGE" | "ADDON" | "CONSULTATION";
  vendorId: string;
  vendorName: string;
  vendorRole: "PRIMARY" | "INCLUDED" | "ADDON" | "OPTIONAL" | "BUNDLE";
  comparableGroupKey: string;
  includedModuleIds: string[];
  optionalModuleIds: string[];
  defaultSelectedModuleIds: string[];
}
