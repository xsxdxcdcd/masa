-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "receiptFileUrl" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);