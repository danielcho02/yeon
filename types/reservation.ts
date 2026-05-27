import type { QuoteResponseData } from "./quote";
import type { VendorProfileData } from "./user";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CHANGED"
  | "CANCELED";

export interface ReservationData {
  id: string;
  planId: string;
  vendorId: string;
  quoteRequestId: string | null;
  quoteResponseId: string | null;
  reservedDate: string;
  totalAmount: number;
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
