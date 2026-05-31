-- Align the Transaction table with the current Prisma schema and enforce the
-- launch-critical quote request invariant at the database layer.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT,
    "payerId" TEXT,
    "planId" TEXT,
    "senderName" TEXT,
    "amount" INTEGER NOT NULL,
    "relation" TEXT,
    "message" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OFFLINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'MOCK',
    "gatewayReference" TEXT,
    "paidAt" DATETIME,
    "failureReason" TEXT,
    "receiptUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Transaction" (
    "id",
    "reservationId",
    "payerId",
    "amount",
    "type",
    "status",
    "method",
    "gatewayReference",
    "paidAt",
    "failureReason",
    "receiptUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "reservationId",
    "payerId",
    "amount",
    'OFFLINE' AS "type",
    "status",
    "method",
    "gatewayReference",
    "paidAt",
    "failureReason",
    "receiptUrl",
    "createdAt",
    "updatedAt"
FROM "Transaction";

DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";

CREATE UNIQUE INDEX "Transaction_reservationId_key" ON "Transaction"("reservationId");
CREATE INDEX "Transaction_payerId_status_idx" ON "Transaction"("payerId", "status");
CREATE INDEX "Transaction_planId_type_idx" ON "Transaction"("planId", "type");

CREATE TABLE "new_Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventPlanId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "templateId" TEXT,
    "shareUrl" TEXT,
    "content" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT,
    "rsvpStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "attendees" INTEGER,
    "invitationCode" TEXT NOT NULL,
    "sentAt" DATETIME,
    "viewedAt" DATETIME,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_eventPlanId_fkey" FOREIGN KEY ("eventPlanId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Invitation" (
    "id",
    "eventPlanId",
    "senderId",
    "recipientId",
    "isPublished",
    "recipientName",
    "recipientPhone",
    "recipientEmail",
    "message",
    "rsvpStatus",
    "attendees",
    "invitationCode",
    "sentAt",
    "viewedAt",
    "respondedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "eventPlanId",
    "senderId",
    "recipientId",
    false AS "isPublished",
    "recipientName",
    "recipientPhone",
    "recipientEmail",
    "message",
    "rsvpStatus",
    "attendees",
    "invitationCode",
    "sentAt",
    "viewedAt",
    "respondedAt",
    "createdAt",
    "updatedAt"
FROM "Invitation";

DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";

CREATE UNIQUE INDEX "Invitation_shareUrl_key" ON "Invitation"("shareUrl");
CREATE UNIQUE INDEX "Invitation_invitationCode_key" ON "Invitation"("invitationCode");
CREATE INDEX "Invitation_eventPlanId_rsvpStatus_idx" ON "Invitation"("eventPlanId", "rsvpStatus");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
