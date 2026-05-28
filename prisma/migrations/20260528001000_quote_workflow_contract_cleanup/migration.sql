-- Normalize the launch quote workflow contract.
-- 1. VendorServiceModule pricing is explicit instead of inferred from text.
-- 2. Reservation cancellation status uses CANCELED consistently.

ALTER TABLE "VendorServiceModule" ADD COLUMN "pricingType" TEXT NOT NULL DEFAULT 'FLAT';

UPDATE "VendorServiceModule"
SET "pricingType" = 'PER_GUEST'
WHERE
  "category" IN ('CATERING', 'MEAL')
  AND (
    "name" LIKE '%1인%' OR
    "name" LIKE '%인당%' OR
    "name" LIKE '%명당%' OR
    "name" LIKE '%/인%' OR
    "name" LIKE '%/명%' OR
    "description" LIKE '%1인%' OR
    "description" LIKE '%인당%' OR
    "description" LIKE '%명당%' OR
    "description" LIKE '%/인%' OR
    "description" LIKE '%/명%' OR
    lower("name") LIKE '%per guest%' OR
    lower("name") LIKE '%per person%' OR
    lower("description") LIKE '%per guest%' OR
    lower("description") LIKE '%per person%'
  );

UPDATE "Reservation"
SET "status" = 'CANCELED'
WHERE "status" = 'CANCELLED';
