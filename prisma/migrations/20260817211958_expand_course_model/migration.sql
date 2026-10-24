-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assignmentsIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categoryAr" TEXT,
ADD COLUMN     "categoryEn" TEXT,
ADD COLUMN     "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "communityAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "downloadableResources" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "enrollmentDeadline" TIMESTAMP(3),
ADD COLUMN     "excerptAr" TEXT,
ADD COLUMN     "excerptEn" TEXT,
ADD COLUMN     "hoursOfContent" INTEGER,
ADD COLUMN     "introVideoUrl" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "level" "CourseLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "lifetimeAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liveSessionsIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxStudents" INTEGER,
ADD COLUMN     "priceOld" DECIMAL(10,2),
ADD COLUMN     "projectsIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quizzesIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "videoFileUrl" TEXT;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "CourseObjective" (
    "id" TEXT NOT NULL,
    "objectiveAr" TEXT NOT NULL,
    "objectiveEn" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" TEXT NOT NULL,
    "prerequisiteAr" TEXT NOT NULL,
    "prerequisiteEn" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAudience" (
    "id" TEXT NOT NULL,
    "audienceAr" TEXT NOT NULL,
    "audienceEn" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseFaq" (
    "id" TEXT NOT NULL,
    "questionAr" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altAr" TEXT,
    "altEn" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CourseObjective" ADD CONSTRAINT "CourseObjective_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAudience" ADD CONSTRAINT "CourseAudience_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFaq" ADD CONSTRAINT "CourseFaq_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseImage" ADD CONSTRAINT "CourseImage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
