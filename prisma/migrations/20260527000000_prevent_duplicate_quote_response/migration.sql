-- Prevent a vendor from submitting multiple responses to the same quote request.
CREATE UNIQUE INDEX "QuoteResponse_requestId_vendorId_key" ON "QuoteResponse"("requestId", "vendorId");
