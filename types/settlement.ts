export type SettlementMethod = "ONLINE" | "OFFLINE";

export interface SettlementEntryData {
  id: string;
  planId: string;
  senderName: string;
  amount: number;
  relation: string | null;
  message: string | null;
  type: SettlementMethod;
  paidAt: string;
  createdAt: string;
}

export interface CreateSettlementEntryPayload {
  planId: string;
  senderName: string;
  amount: number;
  relation?: string;
  message?: string;
  type: SettlementMethod;
  paidAt?: string; // ISO string format or YYYY-MM-DD
}

export interface UpdateSettlementEntryPayload {
  senderName?: string;
  amount?: number;
  relation?: string;
  message?: string;
  type?: SettlementMethod;
  paidAt?: string; // ISO string format or YYYY-MM-DD
}

export interface SettlementSummary {
  totalAmount: number;
  totalCount: number;
  averageAmount: number;
  byRelation: { relation: string; amount: number; count: number }[];
  byType: { type: SettlementMethod; amount: number; count: number }[];
}
