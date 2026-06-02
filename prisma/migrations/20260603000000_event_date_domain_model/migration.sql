ALTER TABLE "QuoteRequest" ADD COLUMN "preferredDateStart" DATETIME;
ALTER TABLE "QuoteRequest" ADD COLUMN "preferredDateEnd" DATETIME;

ALTER TABLE "QuoteProposalRevision" ADD COLUMN "proposedServiceDate" DATETIME;
