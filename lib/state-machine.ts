import type { QuoteStatus } from "@/types/quote";
import type { ReservationStatus } from "@/types/reservation";

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  PENDING: ["RESPONDED", "CANCELED"],
  RESPONDED: ["ACCEPTED", "CANCELED"],
  ACCEPTED: [],
  CANCELED: []
};

const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELED"],
  CONFIRMED: ["CHANGED", "CANCELED"],
  REJECTED: [],
  CHANGED: ["CONFIRMED"],
  CANCELED: [],
  COMPLETED: []
};

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`[${entity}] 상태 전이 불가: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertQuoteTransition(current: QuoteStatus, next: QuoteStatus): void {
  if (!QUOTE_TRANSITIONS[current]?.includes(next)) {
    throw new InvalidTransitionError("QuoteRequest", current, next);
  }
}

export function assertReservationTransition(
  current: ReservationStatus,
  next: ReservationStatus
): void {
  if (!RESERVATION_TRANSITIONS[current]?.includes(next)) {
    throw new InvalidTransitionError("Reservation", current, next);
  }
}
