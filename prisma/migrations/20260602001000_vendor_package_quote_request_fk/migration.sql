PRAGMA foreign_keys=OFF;

CREATE TABLE "new_QuoteRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "selectedPackageId" TEXT,
    "requirements" TEXT NOT NULL,
    "selectedModules" JSONB,
    "selectedPackageSnapshot" JSONB,
    "priceSnapshot" JSONB,
    "preferredDate" DATETIME,
    "budget" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteRequest_selectedPackageId_fkey" FOREIGN KEY ("selectedPackageId") REFERENCES "VendorPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_QuoteRequest" (
    "id",
    "planId",
    "vendorId",
    "selectedPackageId",
    "requirements",
    "selectedModules",
    "selectedPackageSnapshot",
    "priceSnapshot",
    "preferredDate",
    "budget",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "planId",
    "vendorId",
    "selectedPackageId",
    "requirements",
    "selectedModules",
    "selectedPackageSnapshot",
    "priceSnapshot",
    "preferredDate",
    "budget",
    "status",
    "createdAt",
    "updatedAt"
FROM "QuoteRequest";

DROP TABLE "QuoteRequest";
ALTER TABLE "new_QuoteRequest" RENAME TO "QuoteRequest";

CREATE INDEX "QuoteRequest_planId_status_idx" ON "QuoteRequest"("planId", "status");
CREATE INDEX "QuoteRequest_vendorId_status_idx" ON "QuoteRequest"("vendorId", "status");
CREATE INDEX "QuoteRequest_selectedPackageId_idx" ON "QuoteRequest"("selectedPackageId");
CREATE UNIQUE INDEX "QuoteRequest_active_planId_vendorId_key"
ON "QuoteRequest"("planId", "vendorId")
WHERE "status" IN ('PENDING', 'RESPONDED', 'ACCEPTED');

PRAGMA foreign_keys=ON;
