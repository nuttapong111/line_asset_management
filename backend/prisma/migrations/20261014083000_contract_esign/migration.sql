-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "landlordSignatureUrl" TEXT;
ALTER TABLE "Contract" ADD COLUMN "landlordSignedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "tenantSignatureUrl" TEXT;
ALTER TABLE "Contract" ADD COLUMN "tenantSignedAt" TIMESTAMP(3);
