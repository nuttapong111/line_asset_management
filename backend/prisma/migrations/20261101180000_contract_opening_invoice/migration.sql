-- Opening bill issued when a contract is fully signed
-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'CONTRACT';
