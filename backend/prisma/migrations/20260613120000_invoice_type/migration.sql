-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RENT', 'UTILITY');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'RENT';

-- CreateIndex (unique per unit/month/year/type)
CREATE UNIQUE INDEX "Invoice_unitId_month_year_type_key" ON "Invoice"("unitId", "month", "year", "type");

-- AlterTable (notification defaults for new admins — existing rows unchanged)
-- rentReminderDays and overdueRepeatDays are updated via app settings UI
