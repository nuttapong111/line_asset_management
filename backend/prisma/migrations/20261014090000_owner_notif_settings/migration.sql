-- AlterTable
ALTER TABLE "NotifSettings" ADD COLUMN "invoiceDaysBeforeDue" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "OwnerNotifSettings" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "invoiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "invoiceDaysBeforeDue" INTEGER NOT NULL DEFAULT 4,
    "invoiceSendTime" TEXT NOT NULL DEFAULT '08:00',
    "rentReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rentReminderDays" INTEGER[] DEFAULT ARRAY[3, 1]::INTEGER[],
    "rentReminderTime" TEXT NOT NULL DEFAULT '08:00',
    "overdueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueRepeatDays" INTEGER NOT NULL DEFAULT 1,
    "overdueSendTime" TEXT NOT NULL DEFAULT '09:00',
    "contractEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contractReminderDays" INTEGER[] DEFAULT ARRAY[60, 30, 14, 7]::INTEGER[],
    "contractSendTime" TEXT NOT NULL DEFAULT '08:00',
    "notifyTenant" BOOLEAN NOT NULL DEFAULT true,
    "maintEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintUnackHours" INTEGER NOT NULL DEFAULT 1,
    "quietEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '07:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerNotifSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerNotifSettings_ownerId_key" ON "OwnerNotifSettings"("ownerId");

-- AddForeignKey
ALTER TABLE "OwnerNotifSettings" ADD CONSTRAINT "OwnerNotifSettings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
