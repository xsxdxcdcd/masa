-- Two columns that make "logout" and "password changed" mean something for a
-- stateless access token.
--
-- tokenVersion: access tokens carry it as `tv`; JwtStrategy rejects a token
-- whose `tv` differs from the row. Default 0 means every existing token (signed
-- without a `tv` claim, treated as 0) stays valid until it is retired -- no one
-- is logged out by this migration itself.
--
-- familyId: refresh-token rotations in the same lineage share an id, so a token
-- that is presented after it was already rotated can be recognised as a replay
-- and its whole family revoked.
ALTER TABLE "User"
    ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RefreshToken"
    ADD COLUMN "familyId" TEXT;

CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
