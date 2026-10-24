-- AlterTable
ALTER TABLE "CourseOpening" ADD COLUMN     "seatsTaken" INTEGER NOT NULL DEFAULT 0;

-- Backfill seatsTaken from enrollments currently holding a seat (any status
-- except REJECTED/REVOKED), so the atomic seat counter starts consistent with
-- already-existing data on first deploy.
UPDATE "CourseOpening" AS o
SET "seatsTaken" = sub.cnt
FROM (
    SELECT "openingId", COUNT(*) AS cnt
    FROM "Enrollment"
    WHERE "openingId" IS NOT NULL AND "status" NOT IN ('REJECTED', 'REVOKED')
    GROUP BY "openingId"
) AS sub
WHERE o.id = sub."openingId";

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentId_idx" ON "WebhookEvent"("paymentId");
