import type { VendorProfileData } from "./user";
import type { ReservationData } from "./reservation";
import type { QuoteModule } from "./vendor-module";

export type QuoteStatus = "PENDING" | "RESPONDED" | "ACCEPTED" | "CANCELED";

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
  createdAt: string;
  vendor?: VendorProfileData;
}

export interface QuoteRequestWithResponses extends QuoteRequestData {
  responses: QuoteResponseData[];
}

export interface CreateQuoteRequestPayload {
  planId: string;
  vendorId: string;
  requirements: string;
  selectedModuleIds: string[];
  preferredDate?: string;
  budget?: number;
}

export interface SubmitQuoteResponsePayload {
  requestId: string;
  basePrice: number;
  modules: QuoteResponseModules;
  totalPrice: number;
  note?: string;
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
