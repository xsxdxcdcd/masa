-- AlterTable
ALTER TABLE "Course" DROP COLUMN "endDate",
DROP COLUMN "enrollmentDeadline",
DROP COLUMN "isPublished",
DROP COLUMN "maxStudents",
DROP COLUMN "price",
DROP COLUMN "priceOld",
DROP COLUMN "startDate";

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "openingId" TEXT;

-- CreateTable
CREATE TABLE "CourseOpening" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "enrollmentDeadline" TIMESTAMP(3),
    "price" DECIMAL(10,2) NOT NULL,
    "priceOld" DECIMAL(10,2),
    "maxStudents" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "CourseOpening_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CourseOpening" ADD CONSTRAINT "CourseOpening_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOpening" ADD CONSTRAINT "CourseOpening_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

