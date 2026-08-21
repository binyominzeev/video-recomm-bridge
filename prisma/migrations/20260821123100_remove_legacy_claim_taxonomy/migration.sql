DROP INDEX IF EXISTS "Claim_taxonomyCategoryId_idx";
ALTER TABLE "Claim"
DROP COLUMN IF EXISTS "taxonomyCategoryId",
DROP COLUMN IF EXISTS "taxonomyTopic",
DROP COLUMN IF EXISTS "taxonomyClassifiedAt";