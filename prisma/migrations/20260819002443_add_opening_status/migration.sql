-- CreateEnum
CREATE TYPE "CourseOpeningStatus" AS ENUM ('DRAFT', 'ANNOUNCEMENT', 'OPEN', 'STARTED', 'ENDED');

-- AlterTable
ALTER TABLE "CourseOpening" ADD COLUMN     "announcementEndAt" TIMESTAMP(3),
ADD COLUMN     "announcementStartAt" TIMESTAMP(3),
ADD COLUMN     "status" "CourseOpeningStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: openings that were already published keep being open for registration.
UPDATE "CourseOpening" SET "status" = 'OPEN' WHERE "isPublished" = true;
