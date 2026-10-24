-- A live session now belongs to a batch (CourseOpening) instead of the course,
-- and carries a bilingual title plus an optional duration.
--
-- The table was written by nothing in the app (it was only ever read, through a
-- course-level include), so it is expected to be empty -- but this migration is
-- written so that it does not matter. Adding the NOT NULL columns in one shot
-- would fail on a non-empty table, so the old title is copied across first and
-- only then are the columns tightened.
--
-- If the table is not empty the migration aborts instead of guessing: a session
-- scheduled at the course level cannot be attributed to one of its batches, and
-- guessing would show students the wrong classroom link.

-- AlterTable: add the new columns as nullable so the copy below can run.
ALTER TABLE "LiveSession"
ADD COLUMN "openingId" TEXT,
ADD COLUMN "titleAr" TEXT,
ADD COLUMN "titleEn" TEXT,
ADD COLUMN "durationMinutes" INTEGER;

-- Preserve what the old course-scoped rows had.
UPDATE "LiveSession" SET "titleAr" = "title";

-- Refuse to migrate blindly. Rows left at the course level cannot be attributed
-- to one of its batches -- there may be several, with different rooms and
-- different dates -- so dropping them would delete real classes and keeping them
-- would show students a link to the wrong batch's classroom. There is no write
-- path in the app for this table (it was only ever read), so the expected state
-- is empty and this block never fires; if it does, the deploy stops here rather
-- than losing rows, and the rows get moved to a batch by hand.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "LiveSession") THEN
        RAISE EXCEPTION 'LiveSession still holds % course-level row(s) that cannot be attributed to a batch. Reassign them to an opening, then re-run this migration.', (SELECT COUNT(*) FROM "LiveSession");
    END IF;
END $$;

-- AlterTable: now that nothing is missing, tighten to NOT NULL.
ALTER TABLE "LiveSession"
ALTER COLUMN "openingId" SET NOT NULL,
ALTER COLUMN "titleAr" SET NOT NULL,
ALTER COLUMN "titleEn" SET NOT NULL;

-- AlterTable: drop the course scoping.
ALTER TABLE "LiveSession" DROP CONSTRAINT "LiveSession_courseId_fkey";
ALTER TABLE "LiveSession" DROP COLUMN "courseId",
DROP COLUMN "title";

-- CreateIndex
CREATE INDEX "LiveSession_openingId_scheduledAt_idx" ON "LiveSession"("openingId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;