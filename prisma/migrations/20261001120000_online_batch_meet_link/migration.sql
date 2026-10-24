-- A batch is either taught in person or online. Online batches carry the
-- classroom link students join from, so the mode and the link are one fact.
CREATE TYPE "DeliveryMode" AS ENUM ('IN_PERSON', 'ONLINE');

ALTER TABLE "CourseOpening"
    ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'IN_PERSON',
    ADD COLUMN "meetLink" TEXT;
