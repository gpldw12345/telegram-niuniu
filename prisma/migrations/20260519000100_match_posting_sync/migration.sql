-- AlterTable
ALTER TABLE "Match"
ADD COLUMN "sportTitle" TEXT,
ADD COLUMN "isPostEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "oddsSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Match_isPostEnabled_commenceTime_idx" ON "Match"("isPostEnabled", "commenceTime");
