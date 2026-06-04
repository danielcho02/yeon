-- Backfill the modular quote tables that are present in the Prisma schema.
-- IF NOT EXISTS keeps this safe for workspaces that previously used db push.
CREATE TABLE IF NOT EXISTS "VendorServiceModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "isBaseIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorServiceModule_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "QuoteRequest" (
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

CREATE TABLE IF NOT EXISTS "QuoteResponse" (
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

CREATE INDEX IF NOT EXISTS "VendorServiceModule_vendorId_category_isActive_idx" ON "VendorServiceModule"("vendorId", "category", "isActive");
CREATE INDEX IF NOT EXISTS "QuoteRequest_planId_status_idx" ON "QuoteRequest"("planId", "status");
CREATE INDEX IF NOT EXISTS "QuoteRequest_vendorId_status_idx" ON "QuoteRequest"("vendorId", "status");
CREATE INDEX IF NOT EXISTS "QuoteResponse_requestId_idx" ON "QuoteResponse"("requestId");
CREATE INDEX IF NOT EXISTS "QuoteResponse_vendorId_idx" ON "QuoteResponse"("vendorId");
