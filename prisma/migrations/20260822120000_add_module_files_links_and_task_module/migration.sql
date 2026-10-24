-- Add independent lecture materials (files + links) to Module
ALTER TABLE "Module" ADD COLUMN "files" JSONB,
                   ADD COLUMN "links" JSONB;

-- Optionally assign a CourseTask to a specific lecture (module) of its course
ALTER TABLE "CourseTask" ADD COLUMN "moduleId" TEXT;

-- Foreign key + index for CourseTask.moduleId
ALTER TABLE "CourseTask"
    ADD CONSTRAINT "CourseTask_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CourseTask_moduleId_idx" ON "CourseTask" ("moduleId");