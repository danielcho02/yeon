-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GENERAL',
    "phone" TEXT,
    "companyName" TEXT,
    "bio" TEXT,
    "imageUrl" TEXT,
    "location" TEXT,
    "emailVerifiedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "hostName" TEXT,
    "honoreeName" TEXT,
    "venueName" TEXT,
    "region" TEXT,
    "scheduledAt" DATETIME,
    "guestTarget" INTEGER,
    "budget" INTEGER,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "aiRecommendation" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventPlanId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "description" TEXT,
    "serviceDate" DATETIME,
    "guestCount" INTEGER,
    "quotedAmount" INTEGER,
    "confirmedAmount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_eventPlanId_fkey" FOREIGN KEY ("eventPlanId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "eventPlanId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'STORY',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_eventPlanId_fkey" FOREIGN KEY ("eventPlanId") REFERENCES "EventPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "vendorId" TEXT,
    "eventPlanId" TEXT,
    "reservationId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Review_eventPlanId_fkey" FOREIGN KEY ("eventPlanId") REFERENCES "EventPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'MOCK',
    "gatewayReference" TEXT,
    "paidAt" DATETIME,
    "failureReason" TEXT,
    "receiptUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventPlanId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EventPlan_slug_key" ON "EventPlan"("slug");

-- CreateIndex
CREATE INDEX "EventPlan_ownerId_status_idx" ON "EventPlan"("ownerId", "status");

-- CreateIndex
CREATE INDEX "EventPlan_type_scheduledAt_idx" ON "EventPlan"("type", "scheduledAt");

-- CreateIndex
CREATE INDEX "Reservation_eventPlanId_status_idx" ON "Reservation"("eventPlanId", "status");

-- CreateIndex
CREATE INDEX "Reservation_vendorId_status_idx" ON "Reservation"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_authorId_category_idx" ON "Post"("authorId", "category");

-- CreateIndex
CREATE INDEX "Post_eventPlanId_isPublished_idx" ON "Post"("eventPlanId", "isPublished");

-- CreateIndex
CREATE INDEX "Review_vendorId_rating_idx" ON "Review"("vendorId", "rating");

-- CreateIndex
CREATE INDEX "Review_eventPlanId_isPublished_idx" ON "Review"("eventPlanId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reservationId_key" ON "Transaction"("reservationId");

-- CreateIndex
CREATE INDEX "Transaction_payerId_status_idx" ON "Transaction"("payerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_invitationCode_key" ON "Invitation"("invitationCode");

-- CreateIndex
CREATE INDEX "Invitation_eventPlanId_rsvpStatus_idx" ON "Invitation"("eventPlanId", "rsvpStatus");
