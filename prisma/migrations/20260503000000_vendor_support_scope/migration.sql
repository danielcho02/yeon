-- Add explicit vendor support scope for context-safe filtering.
ALTER TABLE "User" ADD COLUMN "supportedEventTypes" JSONB;
ALTER TABLE "User" ADD COLUMN "supportedServiceModules" JSONB;
