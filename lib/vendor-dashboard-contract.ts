import type {
  VendorDashboardReservationContractDTO,
  VendorDashboardReservationDTO
} from "../types/reservation";

function isNewQuoteRequest(reservation: VendorDashboardReservationDTO) {
  return reservation.status === "PENDING" && reservation.quoteResponseId === null;
}

function isPendingConfirmation(reservation: VendorDashboardReservationDTO) {
  return reservation.status === "PENDING" && reservation.quoteRequestStatus === "ACCEPTED";
}

function isWaitingForUserAcceptance(reservation: VendorDashboardReservationDTO) {
  return (
    reservation.status === "PENDING" &&
    reservation.quoteResponseId !== null &&
    reservation.quoteRequestStatus !== "ACCEPTED"
  );
}

function isConfirmedReservation(reservation: VendorDashboardReservationDTO) {
  return reservation.status === "CONFIRMED" || reservation.status === "COMPLETED";
}

export function buildVendorDashboardReservationContract(
  reservations: VendorDashboardReservationDTO[]
): VendorDashboardReservationContractDTO {
  const newQuoteRequests = reservations.filter(isNewQuoteRequest);
  const pendingConfirmations = reservations.filter(isPendingConfirmation);
  const quoteResponsesWaitingForUserAcceptance = reservations.filter(isWaitingForUserAcceptance);
  const confirmedReservations = reservations.filter(isConfirmedReservation);

  return {
    reservations,
    newQuoteRequests,
    quoteResponsesWaitingForUserAcceptance,
    pendingConfirmations,
    confirmedReservations,
    counts: {
      newRequestsCount: newQuoteRequests.length,
      pendingConfirmationsCount: pendingConfirmations.length,
      confirmedReservationsCount: confirmedReservations.length,
      respondedQuotesCount: quoteResponsesWaitingForUserAcceptance.length
    }
  };
}
