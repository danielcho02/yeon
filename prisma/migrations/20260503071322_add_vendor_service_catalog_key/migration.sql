-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VendorService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "catalogKey" TEXT,
    "pricingType" TEXT NOT NULL DEFAULT 'FLAT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" INTEGER NOT NULL,
    "maxGuests" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorService_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VendorService" ("basePrice", "createdAt", "description", "eventType", "id", "isActive", "maxGuests", "module", "name", "updatedAt", "vendorId") SELECT "basePrice", "createdAt", "description", "eventType", "id", "isActive", "maxGuests", "module", "name", "updatedAt", "vendorId" FROM "VendorService";
DROP TABLE "VendorService";
ALTER TABLE "new_VendorService" RENAME TO "VendorService";
CREATE INDEX "VendorService_vendorId_eventType_idx" ON "VendorService"("vendorId", "eventType");
CREATE INDEX "VendorService_eventType_module_idx" ON "VendorService"("eventType", "module");
CREATE INDEX "VendorService_eventType_module_catalogKey_idx" ON "VendorService"("eventType", "module", "catalogKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
