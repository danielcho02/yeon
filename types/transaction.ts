export type TransactionType = "ONLINE" | "OFFLINE";

export interface TransactionData {
  id: string;
  planId: string;
  senderName: string;
  amount: number;
  relation: string | null;
  message: string | null;
  type: TransactionType;
  createdAt: string;
}

export interface CreateTransactionPayload {
  planId: string;
  senderName: string;
  amount: number;
  relation?: string;
  message?: string;
  type: TransactionType;
}

export interface TransactionSummary {
  totalAmount: number;
  totalCount: number;
  onlineAmount: number;
  offlineAmount: number;
  byRelation: { relation: string; amount: number; count: number }[];
}
