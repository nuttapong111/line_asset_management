-- Trial should start when the owner first activates (login / LINE link), not when admin creates the account.
ALTER TABLE "Owner" ADD COLUMN "trialStartedAt" TIMESTAMP(3);

-- Unactivated, unpaid owners: wait for first login/link
UPDATE "Owner" AS o
SET "trialStartedAt" = NULL,
    "expiresAt" = NULL,
    "subscriptionStatus" = 'TRIAL'
WHERE o."linkedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SubscriptionPayment" sp
    WHERE sp."ownerId" = o."id" AND sp.status = 'APPROVED'
  );

-- Already linked, unpaid: recount trial from LINE link
UPDATE "Owner" AS o
SET "trialStartedAt" = o."linkedAt",
    "expiresAt" = o."linkedAt" + INTERVAL '14 days'
WHERE o."linkedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SubscriptionPayment" sp
    WHERE sp."ownerId" = o."id" AND sp.status = 'APPROVED'
  );

-- Paid owners: keep expiresAt, record that trial already started
UPDATE "Owner" AS o
SET "trialStartedAt" = COALESCE(o."trialStartedAt", o."linkedAt", o."createdAt")
WHERE EXISTS (
  SELECT 1 FROM "SubscriptionPayment" sp
  WHERE sp."ownerId" = o."id" AND sp.status = 'APPROVED'
);
