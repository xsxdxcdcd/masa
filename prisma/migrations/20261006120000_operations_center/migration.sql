-- Operations center: one row per tracked browser, one row per action.
-- Applied by hand (prisma migrate diff output) so the migration stays additive
-- and touches no existing table except the additive User column.
CREATE TABLE "VisitSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'desktop',
    "os" TEXT,
    "browser" TEXT,
    "referrer" TEXT,
    "language" TEXT,
    "screen" TEXT,
    "timezone" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VisitSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "label" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);

-- Unique, not merely indexed: `visitorId` IS the session's identity, so the
-- lookup in resolveSession is a point read and duplicates would be a bug.
CREATE UNIQUE INDEX "VisitSession_visitorId_key" ON "VisitSession"("visitorId");
CREATE INDEX "VisitSession_lastSeenAt_idx" ON "VisitSession"("lastSeenAt");
CREATE INDEX "VisitSession_userId_idx" ON "VisitSession"("userId");
CREATE INDEX "VisitSession_ipAddress_idx" ON "VisitSession"("ipAddress");
CREATE INDEX "VisitEvent_createdAt_idx" ON "VisitEvent"("createdAt");
CREATE INDEX "VisitEvent_sessionId_createdAt_idx" ON "VisitEvent"("sessionId", "createdAt");
CREATE INDEX "VisitEvent_type_idx" ON "VisitEvent"("type");
CREATE INDEX "VisitEvent_label_idx" ON "VisitEvent"("label");

ALTER TABLE "VisitSession" ADD CONSTRAINT "VisitSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitEvent" ADD CONSTRAINT "VisitEvent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "VisitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
