-- Design flows: bundled slip, shortfall invoice, maintenance appointment, emergency phone
-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'SHORTFALL';

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "shortfall" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bundleId" TEXT;

CREATE TABLE IF NOT EXISTS "PaymentBundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "slipUrl" TEXT,
    "slipUploadedAt" TIMESTAMP(3),
    "ocrAmount" DECIMAL(65,30),
    "ocrMatched" BOOLEAN,
    "ocrAccountMatched" BOOLEAN,
    "ocrParsedAccount" TEXT,
    "ocrNote" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'WAITING_SLIP',
    "shortfall" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentBundle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentBundle_tenantId_status_idx" ON "PaymentBundle"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Payment_bundleId_idx" ON "Payment"("bundleId");

DO $$ BEGIN
  ALTER TABLE "PaymentBundle" ADD CONSTRAINT "PaymentBundle_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "PaymentBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "scheduleSlot" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "technicianName" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "appointmentStatus" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "appointmentNote" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "tenantRespondedAt" TIMESTAMP(3);
ALTER TABLE "Maintenance" ADD COLUMN IF NOT EXISTS "doneConfirmedAt" TIMESTAMP(3);
