CREATE TABLE IF NOT EXISTS "VendorPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorPackage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "VendorPackageModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "vendorServiceModuleId" TEXT NOT NULL,
    "selectionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorPackageModule_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "VendorPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorPackageModule_vendorServiceModuleId_fkey" FOREIGN KEY ("vendorServiceModuleId") REFERENCES "VendorServiceModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VendorPackage_vendorId_eventType_isActive_idx" ON "VendorPackage"("vendorId", "eventType", "isActive");
CREATE INDEX IF NOT EXISTS "VendorPackage_vendorId_eventType_sortOrder_idx" ON "VendorPackage"("vendorId", "eventType", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "VendorPackageModule_packageId_vendorServiceModuleId_key" ON "VendorPackageModule"("packageId", "vendorServiceModuleId");
CREATE INDEX IF NOT EXISTS "VendorPackageModule_packageId_selectionType_idx" ON "VendorPackageModule"("packageId", "selectionType");
CREATE INDEX IF NOT EXISTS "VendorPackageModule_vendorServiceModuleId_idx" ON "VendorPackageModule"("vendorServiceModuleId");

ALTER TABLE "QuoteRequest" ADD COLUMN "selectedPackageId" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "selectedPackageSnapshot" JSONB;
ALTER TABLE "QuoteRequest" ADD COLUMN "priceSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "QuoteRequest_selectedPackageId_idx" ON "QuoteRequest"("selectedPackageId");
