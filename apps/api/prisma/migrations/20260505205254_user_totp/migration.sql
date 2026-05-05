-- TOTP shared secret (encrypted at rest) + the timestamp at which
-- the user finished enrollment. Both null on every existing user;
-- 2FA is opt-in.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
