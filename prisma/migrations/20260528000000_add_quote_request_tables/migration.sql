PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "selectedModules" JSONB,
    "preferredDate" DATETIME,
    "budget" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuoteResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "modules" JSONB NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteResponse_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "QuoteRequest_planId_status_idx" ON "QuoteRequest"("planId", "status");
CREATE INDEX "QuoteRequest_vendorId_status_idx" ON "QuoteRequest"("vendorId", "status");
CREATE INDEX "QuoteResponse_requestId_idx" ON "QuoteResponse"("requestId");
CREATE INDEX "QuoteResponse_vendorId_idx" ON "QuoteResponse"("vendorId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;