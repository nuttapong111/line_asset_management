-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING_SLIP', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Owner" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Owner" ADD COLUMN "subscriptionReminderKey" TEXT;

-- Backfill: existing owners get 30-day active trial from now
UPDATE "Owner" SET "expiresAt" = NOW() + INTERVAL '30 days', "subscriptionStatus" = 'TRIAL' WHERE "expiresAt" IS NULL;

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING_SLIP',
    "slipUrl" TEXT,
    "slipUploadedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "extendsTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_billNo_key" ON "SubscriptionPayment"("billNo");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_ownerId_status_idx" ON "SubscriptionPayment"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Owner_expiresAt_idx" ON "Owner"("expiresAt");

-- CreateIndex
CREATE INDEX "Owner_subscriptionStatus_idx" ON "Owner"("subscriptionStatus");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
