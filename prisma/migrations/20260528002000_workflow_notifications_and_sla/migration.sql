-- Add launch-readiness workflow observability and vendor confirmation SLA.
ALTER TABLE "Reservation" ADD COLUMN "vendorConfirmationDueAt" DATETIME;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" DATETIME,
  "metadata" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "planId" TEXT,
  "vendorId" TEXT,
  "quoteRequestId" TEXT,
  "quoteResponseId" TEXT,
  "reservationId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");
CREATE INDEX "ActivityLog_planId_createdAt_idx" ON "ActivityLog"("planId", "createdAt");
CREATE INDEX "ActivityLog_vendorId_createdAt_idx" ON "ActivityLog"("vendorId", "createdAt");
CREATE INDEX "ActivityLog_quoteRequestId_createdAt_idx" ON "ActivityLog"("quoteRequestId", "createdAt");
CREATE INDEX "ActivityLog_reservationId_createdAt_idx" ON "ActivityLog"("reservationId", "createdAt");
CREATE INDEX "ActivityLog_type_createdAt_idx" ON "ActivityLog"("type", "createdAt");
