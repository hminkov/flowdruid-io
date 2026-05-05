-- Track whether an org has finished its first-run setup. Existing
-- orgs are pre-marked as onboarded so they don't get redirected
-- through the new onboarding wizard. New rows default to NULL,
-- which the SPA reads as "needs onboarding".
ALTER TABLE "Organisation" ADD COLUMN "onboardedAt" TIMESTAMP(3);
UPDATE "Organisation" SET "onboardedAt" = NOW() WHERE "deletedAt" IS NULL;
