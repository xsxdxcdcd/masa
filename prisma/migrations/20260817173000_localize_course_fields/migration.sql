-- AlterTable Course: add bilingual fields
ALTER TABLE "Course" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "Course" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Course" ADD COLUMN "descriptionAr" TEXT;
ALTER TABLE "Course" ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "Course" ADD COLUMN "syllabusAr" TEXT;
ALTER TABLE "Course" ADD COLUMN "syllabusEn" TEXT;
ALTER TABLE "Course" ADD COLUMN "durationAr" TEXT;
ALTER TABLE "Course" ADD COLUMN "durationEn" TEXT;

-- Backfill from legacy single-language columns
UPDATE "Course"
SET "titleAr" = "title",
    "titleEn" = "title",
    "descriptionAr" = "description",
    "descriptionEn" = "description",
    "syllabusAr" = "syllabus",
    "syllabusEn" = "syllabus",
    "durationAr" = "duration",
    "durationEn" = "duration";

-- Make required bilingual fields NOT NULL
ALTER TABLE "Course" ALTER COLUMN "titleAr" SET NOT NULL;
ALTER TABLE "Course" ALTER COLUMN "titleEn" SET NOT NULL;

-- Drop legacy single-language columns
ALTER TABLE "Course" DROP COLUMN "title";
ALTER TABLE "Course" DROP COLUMN "description";
ALTER TABLE "Course" DROP COLUMN "syllabus";
ALTER TABLE "Course" DROP COLUMN "duration";

-- AlterTable Module: add bilingual fields
ALTER TABLE "Module" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "Module" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Module" ADD COLUMN "descriptionAr" TEXT;
ALTER TABLE "Module" ADD COLUMN "descriptionEn" TEXT;

UPDATE "Module"
SET "titleAr" = "title",
    "titleEn" = "title",
    "descriptionAr" = "description",
    "descriptionEn" = "description";

ALTER TABLE "Module" ALTER COLUMN "titleAr" SET NOT NULL;
ALTER TABLE "Module" ALTER COLUMN "titleEn" SET NOT NULL;

ALTER TABLE "Module" DROP COLUMN "title";
ALTER TABLE "Module" DROP COLUMN "description";

-- AlterTable LearningOutcome: add bilingual fields
ALTER TABLE "LearningOutcome" ADD COLUMN "descriptionAr" TEXT;
ALTER TABLE "LearningOutcome" ADD COLUMN "descriptionEn" TEXT;

UPDATE "LearningOutcome"
SET "descriptionAr" = "description",
    "descriptionEn" = "description";

ALTER TABLE "LearningOutcome" ALTER COLUMN "descriptionAr" SET NOT NULL;
ALTER TABLE "LearningOutcome" ALTER COLUMN "descriptionEn" SET NOT NULL;

ALTER TABLE "LearningOutcome" DROP COLUMN "description";