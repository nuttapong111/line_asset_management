-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL_SLIP', 'GATEWAY');

-- DropForeignKey
ALTER TABLE "Owner" DROP CONSTRAINT "Owner_propertyId_fkey";

-- AlterTable
ALTER TABLE "Owner" DROP COLUMN "propertyId",
ADD COLUMN     "adminId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gatewayRef" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL_SLIP';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "paymentQrUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
