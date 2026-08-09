-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITCH', 'SANDBOX');

-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'COLLECTING', 'COMMITTED', 'DRAWN', 'VERIFYING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('KEYWORD', 'MENTIONS', 'MIN_LENGTH', 'TIMEWINDOW', 'BLOCKLIST', 'DEDUPE', 'BONUS');

-- CreateEnum
CREATE TYPE "DrawResultStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'SUBMITTED', 'SHIPPED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'ERASURE');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "externalId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "platform" "Platform" NOT NULL,
    "accountId" TEXT,
    "postUrl" TEXT,
    "postExternalId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "substituteCount" INTEGER NOT NULL DEFAULT 5,
    "status" "GiveawayStatus" NOT NULL DEFAULT 'DRAFT',
    "publicResults" BOOLEAN NOT NULL DEFAULT true,
    "maskUsernames" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "config" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "externalId" TEXT,
    "username" TEXT NOT NULL,
    "userRef" TEXT,
    "text" TEXT NOT NULL,
    "commentedAt" TIMESTAMP(3) NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "lots" INTEGER NOT NULL DEFAULT 1,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "rejections" JSONB NOT NULL DEFAULT '[]',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "seed" TEXT,
    "seedRevealedAt" TIMESTAMP(3),
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "entrantsSnapshot" JSONB NOT NULL,
    "entrantCount" INTEGER NOT NULL,
    "totalLots" INTEGER NOT NULL,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawnAt" TIMESTAMP(3),

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawResult" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "prizeId" TEXT,
    "rank" INTEGER NOT NULL,
    "status" "DrawResultStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "DrawResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "drawResultId" TEXT NOT NULL,
    "follows" BOOLEAN,
    "liked" BOOLEAN,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "checkedBy" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "drawResultId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "encryptedData" TEXT,
    "submittedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "actor" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_platform_externalId_key" ON "Account"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Giveaway_slug_key" ON "Giveaway"("slug");

-- CreateIndex
CREATE INDEX "Giveaway_status_idx" ON "Giveaway"("status");

-- CreateIndex
CREATE INDEX "Rule_giveawayId_position_idx" ON "Rule"("giveawayId", "position");

-- CreateIndex
CREATE INDEX "Entry_giveawayId_valid_idx" ON "Entry"("giveawayId", "valid");

-- CreateIndex
CREATE INDEX "Entry_giveawayId_username_idx" ON "Entry"("giveawayId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_giveawayId_externalId_key" ON "Entry"("giveawayId", "externalId");

-- CreateIndex
CREATE INDEX "Prize_giveawayId_rank_idx" ON "Prize"("giveawayId", "rank");

-- CreateIndex
CREATE INDEX "Draw_giveawayId_idx" ON "Draw"("giveawayId");

-- CreateIndex
CREATE INDEX "DrawResult_drawId_status_idx" ON "DrawResult"("drawId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DrawResult_drawId_rank_key" ON "DrawResult"("drawId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_drawResultId_key" ON "Verification"("drawResultId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_drawResultId_key" ON "Claim"("drawResultId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_token_key" ON "Claim"("token");

-- CreateIndex
CREATE INDEX "Claim_deleteAfter_idx" ON "Claim"("deleteAfter");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataRequest_subject_idx" ON "DataRequest"("subject");

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_drawResultId_fkey" FOREIGN KEY ("drawResultId") REFERENCES "DrawResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_drawResultId_fkey" FOREIGN KEY ("drawResultId") REFERENCES "DrawResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
