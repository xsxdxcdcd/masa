-- CreateTable
CREATE TABLE "OpeningRequest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloseRequest" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSuggestion" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "categoryAr" TEXT,
    "categoryEn" TEXT,
    "description" TEXT,
    "instructorId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTask" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "dueDate" TIMESTAMP(3),
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openingId" TEXT NOT NULL,

    CONSTRAINT "CourseTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "attachmentUrl" TEXT,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningRequest_instructorId_idx" ON "OpeningRequest"("instructorId");

-- CreateIndex
CREATE INDEX "OpeningRequest_courseId_idx" ON "OpeningRequest"("courseId");

-- CreateIndex
CREATE INDEX "OpeningRequest_status_idx" ON "OpeningRequest"("status");

-- CreateIndex
CREATE INDEX "CloseRequest_instructorId_idx" ON "CloseRequest"("instructorId");

-- CreateIndex
CREATE INDEX "CloseRequest_openingId_idx" ON "CloseRequest"("openingId");

-- CreateIndex
CREATE INDEX "CloseRequest_status_idx" ON "CloseRequest"("status");

-- CreateIndex
CREATE INDEX "CourseSuggestion_instructorId_idx" ON "CourseSuggestion"("instructorId");

-- CreateIndex
CREATE INDEX "CourseSuggestion_status_idx" ON "CourseSuggestion"("status");

-- CreateIndex
CREATE INDEX "CourseTask_openingId_idx" ON "CourseTask"("openingId");

-- CreateIndex
CREATE INDEX "TaskSubmission_enrollmentId_idx" ON "TaskSubmission"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmission_taskId_enrollmentId_key" ON "TaskSubmission"("taskId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "OpeningRequest" ADD CONSTRAINT "OpeningRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningRequest" ADD CONSTRAINT "OpeningRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseRequest" ADD CONSTRAINT "CloseRequest_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseRequest" ADD CONSTRAINT "CloseRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSuggestion" ADD CONSTRAINT "CourseSuggestion_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTask" ADD CONSTRAINT "CourseTask_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CourseTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;