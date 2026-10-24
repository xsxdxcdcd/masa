-- Whether a course is taught live on Meet or delivered as pre-recorded
-- videos. The column default is LIVE because that is what the academy currently
-- sells; a course is not "half live": the two formats are presented through
-- different surfaces, so the value is stored once and enforced on write rather
-- than inferred per lesson.

-- CreateEnum
CREATE TYPE "CourseContentType" AS ENUM ('LIVE', 'RECORDED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "contentType" "CourseContentType" NOT NULL DEFAULT 'LIVE';

-- The default only decides what an existing course looks like until its own
-- content is read back: a course that already ships lesson videos is delivered
-- through the video surface, so it is RECORDED. Leaving it LIVE would hand it
-- two contradicting promises -- the player refuses to show videos on a live
-- course, so those lessons would be unreachable. Lessons grouped under a chapter
-- count as well; they belong to the same course.
--
-- A course that somehow has BOTH lesson videos and a meeting schedule lands on
-- RECORDED, and the schedule stays in the table untouched: dropping an
-- instructor's meetings silently would be worse than leaving them to be
-- deleted, and switching the type back to LIVE is refused until the schedule is
-- gone.
UPDATE "Course" c
SET "contentType" = 'RECORDED'
WHERE EXISTS (
    SELECT 1
    FROM "Module" m
    WHERE m."courseId" = c."id"
      AND m."videoUrl" IS NOT NULL
      AND BTRIM(m."videoUrl") <> ''
);
