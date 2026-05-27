-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "selectedServiceOptions" JSONB;

-- CreateTable
CREATE TABLE "VendorServiceOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorServiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "additionalPrice" INTEGER NOT NULL,
    "pricingType" TEXT NOT NULL DEFAULT 'FLAT',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorServiceOption_vendorServiceId_fkey" FOREIGN KEY ("vendorServiceId") REFERENCES "VendorService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VendorServiceOption_vendorServiceId_isActive_idx" ON "VendorServiceOption"("vendorServiceId", "isActive");
