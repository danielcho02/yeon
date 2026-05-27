-- Add a nullable Reservation -> QuoteRequest bridge for the mixed
-- QuoteRequest/legacy Reservation flow used by the vendor dashboard.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventPlanId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "description" TEXT,
    "serviceDate" DATETIME,
    "guestCount" INTEGER,
    "quotedAmount" INTEGER,
    "confirmedAmount" INTEGER,
    "selectedServiceOptions" JSONB,
    "quoteRequestId" TEXT,
    "quoteResponseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_eventPlanId_fkey" FOREIGN KEY ("eventPlanId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_quoteResponseId_fkey" FOREIGN KEY ("quoteResponseId") REFERENCES "QuoteResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Reservation" (
    "confirmedAmount",
    "createdAt",
    "description",
    "eventPlanId",
    "guestCount",
    "id",
    "notes",
    "quoteResponseId",
    "quotedAmount",
    "selectedServiceOptions",
    "serviceCategory",
    "serviceDate",
    "serviceName",
    "status",
    "updatedAt",
    "vendorId"
)
SELECT
    "confirmedAmount",
    "createdAt",
    "description",
    "eventPlanId",
    "guestCount",
    "id",
    "notes",
    "quoteResponseId",
    "quotedAmount",
    "selectedServiceOptions",
    "serviceCategory",
    "serviceDate",
    "serviceName",
    "status",
    "updatedAt",
    "vendorId"
FROM "Reservation";

DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";

CREATE UNIQUE INDEX "Reservation_quoteRequestId_key" ON "Reservation"("quoteRequestId");
CREATE UNIQUE INDEX "Reservation_quoteResponseId_key" ON "Reservation"("quoteResponseId");
CREATE INDEX "Reservation_eventPlanId_status_idx" ON "Reservation"("eventPlanId", "status");
CREATE INDEX "Reservation_vendorId_status_idx" ON "Reservation"("vendorId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
