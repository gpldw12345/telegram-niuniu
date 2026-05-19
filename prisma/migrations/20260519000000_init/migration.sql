-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'HALF_TIME', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BetWindowType" AS ENUM ('PRE_MATCH', 'HALF_TIME');

-- CreateEnum
CREATE TYPE "BetWindowStatus" AS ENUM ('CLOSED', 'OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('ONE_X_TWO', 'ASIAN_HANDICAP', 'CORRECT_SCORE');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST', 'PUSHED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'BET_STAKE', 'BET_WIN', 'BET_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('ADMIN', 'BET', 'SETTLEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OddsSource" AS ENUM ('ODDS_API', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "TelegramUser" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "pointsBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "oddsApiEventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "halftimeHomeScore" INTEGER,
    "halftimeAwayScore" INTEGER,
    "groupChatId" TEXT,
    "preMatchMessageId" TEXT,
    "halfTimeMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetWindow" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "BetWindowType" NOT NULL,
    "status" "BetWindowStatus" NOT NULL DEFAULT 'CLOSED',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "windowType" "BetWindowType" NOT NULL,
    "source" "OddsSource" NOT NULL DEFAULT 'ODDS_API',
    "bookmakerKey" TEXT,
    "bookmakerTitle" TEXT,
    "raw" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOffer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "market" "MarketType" NOT NULL,
    "selectionKey" TEXT NOT NULL,
    "selectionLabel" TEXT NOT NULL,
    "teamSide" TEXT,
    "handicap" DECIMAL(5,2),
    "correctHomeScore" INTEGER,
    "correctAwayScore" INTEGER,
    "odds" DECIMAL(10,2) NOT NULL,
    "source" "OddsSource" NOT NULL DEFAULT 'ODDS_API',
    "raw" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "offerId" TEXT,
    "market" "MarketType" NOT NULL,
    "selectionKey" TEXT NOT NULL,
    "selectionLabel" TEXT NOT NULL,
    "teamSide" TEXT,
    "handicap" DECIMAL(5,2),
    "correctHomeScore" INTEGER,
    "correctAwayScore" INTEGER,
    "odds" DECIMAL(10,2) NOT NULL,
    "stake" DECIMAL(18,2) NOT NULL,
    "potentialPayout" DECIMAL(18,2) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "settlementNote" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUser_telegramId_key" ON "TelegramUser"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramUser_username_idx" ON "TelegramUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Match_oddsApiEventId_key" ON "Match"("oddsApiEventId");

-- CreateIndex
CREATE INDEX "Match_commenceTime_idx" ON "Match"("commenceTime");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "BetWindow_status_idx" ON "BetWindow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BetWindow_matchId_type_key" ON "BetWindow"("matchId", "type");

-- CreateIndex
CREATE INDEX "OddsSnapshot_matchId_windowType_capturedAt_idx" ON "OddsSnapshot"("matchId", "windowType", "capturedAt");

-- CreateIndex
CREATE INDEX "MarketOffer_matchId_windowId_market_isActive_idx" ON "MarketOffer"("matchId", "windowId", "market", "isActive");

-- CreateIndex
CREATE INDEX "MarketOffer_selectionKey_idx" ON "MarketOffer"("selectionKey");

-- CreateIndex
CREATE INDEX "Bet_userId_placedAt_idx" ON "Bet"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "Bet_matchId_status_idx" ON "Bet"("matchId", "status");

-- CreateIndex
CREATE INDEX "Bet_windowId_status_idx" ON "Bet"("windowId", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceType_referenceId_idx" ON "WalletTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "AuditLog_actorAdminId_createdAt_idx" ON "AuditLog"("actorAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "BetWindow" ADD CONSTRAINT "BetWindow_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOffer" ADD CONSTRAINT "MarketOffer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOffer" ADD CONSTRAINT "MarketOffer_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "BetWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "BetWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MarketOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
