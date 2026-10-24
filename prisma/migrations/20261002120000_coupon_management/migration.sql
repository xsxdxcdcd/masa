-- Coupon management.
--
-- Adds a human-readable name and attribution (who owns the coupon / which
-- channel it spread through), a scope switch for the "first N" cap, and an
-- immutable CouponRedemption log.
--
-- Redemptions are written ONLY when finance approves an enrollment, and the
-- unique (couponId, studentId, courseId) triple is what enforces "one use per
-- student per course" at the database level. The rows are also the per-course
-- bucket for PER_COURSE caps and the source of the per-coupon stats.
--
-- Existing coupons keep working: `name` defaults to '' and `maxUsesScope` to
-- 'TOTAL' (matching the previous global maxUses behaviour).

CREATE TYPE "CouponMaxScope" AS ENUM ('TOTAL', 'PER_COURSE');

ALTER TABLE "Coupon"
    ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "maxUsesScope" "CouponMaxScope" NOT NULL DEFAULT 'TOTAL',
    ADD COLUMN "sourceName" TEXT,
    ADD COLUMN "channel" TEXT;

ALTER TABLE "Payment"
    ADD COLUMN "couponId" TEXT;

CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountOff" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_paymentId_key" ON "CouponRedemption"("paymentId");
CREATE UNIQUE INDEX "CouponRedemption_couponId_studentId_courseId_key" ON "CouponRedemption"("couponId", "studentId", "courseId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_studentId_idx" ON "CouponRedemption"("studentId");
CREATE INDEX "CouponRedemption_courseId_idx" ON "CouponRedemption"("courseId");
CREATE INDEX "Payment_couponId_idx" ON "Payment"("couponId");

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
