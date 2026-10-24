-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "chapterId" TEXT,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing course that has modules gets one default chapter
-- and all of its (currently ungrouped) modules are assigned to it.
DO $$
DECLARE
    c RECORD;
    inserted_id TEXT;
BEGIN
    FOR c IN
        SELECT DISTINCT "courseId"
        FROM "Module"
        WHERE "chapterId" IS NULL
    LOOP
        INSERT INTO "Chapter" ("id", "titleAr", "titleEn", "orderIndex", "createdAt", "updatedAt", "courseId")
        VALUES (gen_random_uuid(), 'محتوى الدورة', 'Course Content', 0, NOW(), NOW(), c."courseId")
        RETURNING "id" INTO inserted_id;

        UPDATE "Module"
        SET "chapterId" = inserted_id
        WHERE "courseId" = c."courseId" AND "chapterId" IS NULL;
    END LOOP;
END $$;