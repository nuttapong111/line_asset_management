-- Tenant move-out request (owner still settles the deposit)
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "moveOutRequestedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "moveOutNote" TEXT;
