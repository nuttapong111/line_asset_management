-- CreateEnum
CREATE TYPE "OwnerPlan" AS ENUM ('TRIAL', 'MONTHLY', 'YEARLY', 'PERMANENT');

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "plan" "OwnerPlan" NOT NULL DEFAULT 'TRIAL';
