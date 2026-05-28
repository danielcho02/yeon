-- Enforce one active quote request per plan/vendor pair.
-- CANCELED requests are excluded so users can retry after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteRequest_active_planId_vendorId_key"
ON "QuoteRequest"("planId", "vendorId")
WHERE "status" IN ('PENDING', 'RESPONDED', 'ACCEPTED');
