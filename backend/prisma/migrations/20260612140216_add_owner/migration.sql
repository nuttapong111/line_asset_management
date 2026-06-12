-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "propertyId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "inviteExpiry" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_inviteToken_key" ON "Owner"("inviteToken");

-- CreateIndex
CREATE INDEX "Owner_lineUserId_idx" ON "Owner"("lineUserId");

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
