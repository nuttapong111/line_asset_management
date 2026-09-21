-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "extraAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "renewalRequestedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "renewalNote" TEXT;

-- CreateTable
CREATE TABLE "RecurringFee" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveOut" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "deposit" DECIMAL(65,30) NOT NULL,
    "unpaidTotal" DECIMAL(65,30) NOT NULL,
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "refundAmount" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "finalElec" DECIMAL(65,30),
    "finalWater" DECIMAL(65,30),
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringFee_unitId_idx" ON "RecurringFee"("unitId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MoveOut_contractId_key" ON "MoveOut"("contractId");

-- AddForeignKey
ALTER TABLE "RecurringFee" ADD CONSTRAINT "RecurringFee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveOut" ADD CONSTRAINT "MoveOut_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
