-- Make passwordHash optional so Google-only users can exist
-- without a local password.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Stable Google account identifier (the OIDC `sub` claim).
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;

-- Look up users by their Google sub on every callback; unique so the
-- same Google account can't end up linked to two rows.
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
