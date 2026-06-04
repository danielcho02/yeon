-- CreateTable
CREATE TABLE "MobileCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "sourceReservationId" TEXT,
    "ownerId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MobileCard_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MobileCard_sourceReservationId_fkey" FOREIGN KEY ("sourceReservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MobileCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileCard_planId_key" ON "MobileCard"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileCard_sourceReservationId_key" ON "MobileCard"("sourceReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileCard_slug_key" ON "MobileCard"("slug");

-- CreateIndex
CREATE INDEX "MobileCard_ownerId_cardType_idx" ON "MobileCard"("ownerId", "cardType");

-- CreateIndex
CREATE INDEX "MobileCard_slug_isPublished_idx" ON "MobileCard"("slug", "isPublished");
