-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "ocrAccountMatched" BOOLEAN;
ALTER TABLE "Payment" ADD COLUMN "ocrParsedAccount" TEXT;
ALTER TABLE "Payment" ADD COLUMN "ocrNote" TEXT;
