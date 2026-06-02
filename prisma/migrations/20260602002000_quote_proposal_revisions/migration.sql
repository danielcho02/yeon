CREATE TABLE "QuoteProposalRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteResponseId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "memo" TEXT,
    "adjustmentRequestMemo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteProposalRevision_quoteResponseId_fkey" FOREIGN KEY ("quoteResponseId") REFERENCES "QuoteResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteProposalRevision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteProposalRevision_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuoteProposalRevision_quoteResponseId_version_key" ON "QuoteProposalRevision"("quoteResponseId", "version");
CREATE INDEX "QuoteProposalRevision_requestId_createdAt_idx" ON "QuoteProposalRevision"("requestId", "createdAt");
CREATE INDEX "QuoteProposalRevision_vendorId_status_idx" ON "QuoteProposalRevision"("vendorId", "status");

ALTER TABLE "Reservation" ADD COLUMN "quoteProposalRevisionId" TEXT REFERENCES "QuoteProposalRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Reservation_quoteProposalRevisionId_key" ON "Reservation"("quoteProposalRevisionId");
