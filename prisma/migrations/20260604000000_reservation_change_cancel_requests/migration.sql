CREATE TABLE "ReservationChangeRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "plannerId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "requestedServiceDate" DATETIME,
  "requestedGuestCount" INTEGER,
  "requestedNotes" TEXT,
  "requestedReason" TEXT NOT NULL,
  "requestedSelectedServiceOptions" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "vendorDecisionMemo" TEXT,
  "decidedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReservationChangeRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationChangeRequest_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationChangeRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReservationCancellationRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "plannerId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "vendorDecisionMemo" TEXT,
  "decidedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReservationCancellationRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationCancellationRequest_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationCancellationRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReservationChangeRequest_reservationId_status_idx" ON "ReservationChangeRequest"("reservationId", "status");
CREATE INDEX "ReservationChangeRequest_vendorId_status_createdAt_idx" ON "ReservationChangeRequest"("vendorId", "status", "createdAt");
CREATE INDEX "ReservationChangeRequest_plannerId_status_createdAt_idx" ON "ReservationChangeRequest"("plannerId", "status", "createdAt");

CREATE INDEX "ReservationCancellationRequest_reservationId_status_idx" ON "ReservationCancellationRequest"("reservationId", "status");
CREATE INDEX "ReservationCancellationRequest_vendorId_status_createdAt_idx" ON "ReservationCancellationRequest"("vendorId", "status", "createdAt");
CREATE INDEX "ReservationCancellationRequest_plannerId_status_createdAt_idx" ON "ReservationCancellationRequest"("plannerId", "status", "createdAt");
