import type { VendorProfileData } from "./user";
import type { ReservationData } from "./reservation";
import type { QuoteModule, VendorServiceModuleData } from "./vendor-module";

export type QuoteStatus = "PENDING" | "RESPONDED" | "ACCEPTED" | "CANCELED";
export type QuoteRequestStatus = QuoteStatus;
export type QuoteResponseStatus = "SUBMITTED" | "ACCEPTED" | "NOT_SELECTED";

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
  selectedModules: string[];
  preferredDate: string | null;
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
  selectedModuleIds: string[];
  guestCount?: number;
  preferredDate?: string;
  budget?: number;
}

export interface SubmitQuoteResponsePayload {
  requestId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note?: string;
  responseMessage?: string;
}

export interface AcceptQuoteResponsePayload {
  quoteResponseId: string;
  reservedDate?: string;
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
