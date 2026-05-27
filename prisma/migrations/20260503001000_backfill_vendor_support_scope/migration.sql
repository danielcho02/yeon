-- Backfill existing vendor accounts without running seed.
UPDATE "User"
SET "name" = "companyName"
WHERE "role" = 'VENDOR'
  AND "companyName" IS NOT NULL
  AND "companyName" != '';

UPDATE "User"
SET
  "supportedEventTypes" = '["WEDDING"]',
  "supportedServiceModules" = '["venue"]'
WHERE "email" = 'venue@yeon.local';

UPDATE "User"
SET
  "supportedEventTypes" = '[]',
  "supportedServiceModules" = '[]'
WHERE "email" = 'catering@yeon.local';

UPDATE "User"
SET
  "supportedEventTypes" = '["FUNERAL"]',
  "supportedServiceModules" = '["funeralHall","memorialTable","hearse"]'
WHERE "email" = 'memorial@yeon.local';
