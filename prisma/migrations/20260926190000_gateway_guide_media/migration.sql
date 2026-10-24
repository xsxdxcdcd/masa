-- Payment methods: how-to media, and which method the student actually used.

-- AlterTable
ALTER TABLE "PaymentGateway"
ADD COLUMN "guideImages" JSONB,
ADD COLUMN "guideVideoUrl" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "gatewayId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_gatewayId_idx" ON "Payment"("gatewayId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gatewayId_fkey"
FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
