-- Paper certificate handover: record when a certificate was printed and which
-- staff member released it. Nullable so existing rows stay valid and an
-- on-screen-only certificate stays distinguishable from a printed one.

-- AlterTable
ALTER TABLE "Certificate"
ADD COLUMN "printedAt" TIMESTAMP(3),
ADD COLUMN "printedById" TEXT;

-- CreateIndex
CREATE INDEX "Certificate_printedById_idx" ON "Certificate"("printedById");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_printedById_fkey"
FOREIGN KEY ("printedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
