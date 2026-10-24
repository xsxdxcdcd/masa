-- Operations center settings: a hashed key with a version that invalidates
-- outstanding grants, and an explicit list of admin accounts allowed in.
--
-- Applied by hand so the migration stays additive: two new tables and nothing
-- else. No existing table or column is touched, and both are inert until an
-- admin writes to them through the settings API.

CREATE TABLE "OperationsSetting" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "migratedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,

    CONSTRAINT "OperationsSetting_pkey" PRIMARY KEY ("id")
);

-- Seeded rather than created on first write: every code path that reads this
-- row can then assume it exists, so there is no "row missing" branch to get
-- wrong. `keyHash` stays NULL on purpose -- that is what makes the
-- OPERATIONS_KEY env var remain the active credential until an admin sets one.
INSERT INTO "OperationsSetting" ("id", "keyVersion", "updatedAt")
VALUES ('singleton', 1, CURRENT_TIMESTAMP);

CREATE TABLE "OperationsAllowlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsAllowlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationsAllowlistEntry_userId_key" ON "OperationsAllowlistEntry"("userId");
CREATE INDEX "OperationsAllowlistEntry_grantedById_idx" ON "OperationsAllowlistEntry"("grantedById");

ALTER TABLE "OperationsSetting" ADD CONSTRAINT "OperationsSetting_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationsAllowlistEntry" ADD CONSTRAINT "OperationsAllowlistEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationsAllowlistEntry" ADD CONSTRAINT "OperationsAllowlistEntry_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
