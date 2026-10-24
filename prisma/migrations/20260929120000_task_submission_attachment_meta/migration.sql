-- The student's submitted file, as the instructor sees it: name, type, size.
-- Additive only: existing rows keep their attachmentUrl and read back NULL for
-- the new columns, so no submission is rewritten and no default is invented.
ALTER TABLE "TaskSubmission" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "TaskSubmission" ADD COLUMN "attachmentType" TEXT;
ALTER TABLE "TaskSubmission" ADD COLUMN "attachmentSize" INTEGER;
