-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "externalId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scopes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "accountId" TEXT,
    "postUrl" TEXT,
    "postExternalId" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "substituteCount" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publicResults" BOOLEAN NOT NULL DEFAULT true,
    "maskUsernames" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Giveaway_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Rule_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "externalId" TEXT,
    "username" TEXT NOT NULL,
    "userRef" TEXT,
    "text" TEXT NOT NULL,
    "commentedAt" DATETIME NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "lots" INTEGER NOT NULL DEFAULT 1,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "rejections" JSONB NOT NULL DEFAULT [],
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Prize_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "seed" TEXT,
    "seedRevealedAt" DATETIME,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "entrantsSnapshot" JSONB NOT NULL,
    "entrantCount" INTEGER NOT NULL,
    "totalLots" INTEGER NOT NULL,
    "committedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawnAt" DATETIME,
    CONSTRAINT "Draw_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrawResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "prizeId" TEXT,
    "rank" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "DrawResult_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawResult_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawResult_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawResultId" TEXT NOT NULL,
    "follows" BOOLEAN,
    "liked" BOOLEAN,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "checkedBy" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "Verification_drawResultId_fkey" FOREIGN KEY ("drawResultId") REFERENCES "DrawResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawResultId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "encryptedData" TEXT,
    "submittedAt" DATETIME,
    "shippedAt" DATETIME,
    "deleteAfter" DATETIME NOT NULL,
    CONSTRAINT "Claim_drawResultId_fkey" FOREIGN KEY ("drawResultId") REFERENCES "DrawResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "actor" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
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
