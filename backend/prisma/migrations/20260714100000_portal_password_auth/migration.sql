-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "lineUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "username" TEXT;
ALTER TABLE "Admin" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Admin" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "username" TEXT;
ALTER TABLE "Owner" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Owner" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_username_key" ON "Owner"("username");
