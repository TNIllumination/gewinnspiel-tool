-- Mehrere Plattformen pro Gewinnspiel, ein gemeinsamer Lostopf.
--
-- Von Hand geschrieben, weil vorhandene Gewinnspiele erhalten bleiben sollen:
-- Die bisherige Einzelplattform wandert in GiveawaySource, und jede vorhandene
-- Teilnahme bekommt die Plattform ihres Gewinnspiels zugewiesen. Erst danach
-- fallen die alten Spalten weg.

PRAGMA foreign_keys=OFF;

-- ── Veranstalterangaben (fuer die Teilnahmebedingungen) ─────────────────────
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'settings',
    "organizer" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "publishBaseUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- ── Quellen: je Plattform ein Beitrag ───────────────────────────────────────
CREATE TABLE "GiveawaySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postUrl" TEXT,
    CONSTRAINT "GiveawaySource_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bestehende Gewinnspiele uebernehmen: aus einer Plattform wird eine Quelle.
INSERT INTO "GiveawaySource" ("id", "giveawayId", "platform", "postUrl")
SELECT lower(hex(randomblob(16))), "id", "platform", "postUrl" FROM "Giveaway";

CREATE UNIQUE INDEX "GiveawaySource_giveawayId_platform_key"
  ON "GiveawaySource"("giveawayId", "platform");

-- ── Entry: Plattform und Fingerabdruck ──────────────────────────────────────
-- Die Plattform kommt aus dem zugehoerigen Gewinnspiel, solange die Spalte
-- dort noch existiert.
CREATE TABLE "new_Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'SANDBOX',
    "externalId" TEXT,
    "username" TEXT NOT NULL,
    "userRef" TEXT,
    "text" TEXT NOT NULL,
    "commentedAt" DATETIME NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT,
    "lots" INTEGER NOT NULL DEFAULT 1,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "rejections" JSONB NOT NULL DEFAULT [],
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Entry" ("id", "giveawayId", "platform", "externalId", "username",
                         "userRef", "text", "commentedAt", "likeCount",
                         "lots", "valid", "rejections", "importedAt")
SELECT e."id", e."giveawayId", COALESCE(g."platform", 'SANDBOX'), e."externalId",
       e."username", e."userRef", e."text", e."commentedAt", e."likeCount",
       e."lots", e."valid", e."rejections", e."importedAt"
FROM "Entry" e LEFT JOIN "Giveaway" g ON g."id" = e."giveawayId";

DROP TABLE "Entry";
ALTER TABLE "new_Entry" RENAME TO "Entry";

CREATE UNIQUE INDEX "Entry_giveawayId_externalId_key" ON "Entry"("giveawayId", "externalId");
CREATE UNIQUE INDEX "Entry_giveawayId_platform_fingerprint_key" ON "Entry"("giveawayId", "platform", "fingerprint");
CREATE INDEX "Entry_giveawayId_valid_idx" ON "Entry"("giveawayId", "valid");
CREATE INDEX "Entry_giveawayId_username_idx" ON "Entry"("giveawayId", "username");

-- ── Giveaway: Einzelplattform faellt weg ────────────────────────────────────
CREATE TABLE "new_Giveaway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "accountId" TEXT,
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

INSERT INTO "new_Giveaway" ("id", "title", "slug", "description", "accountId",
                            "startsAt", "endsAt", "substituteCount", "status",
                            "publicResults", "maskUsernames", "retentionDays",
                            "createdAt", "updatedAt")
SELECT "id", "title", "slug", "description", "accountId",
       "startsAt", "endsAt", "substituteCount", "status",
       "publicResults", "maskUsernames", "retentionDays",
       "createdAt", "updatedAt"
FROM "Giveaway";

DROP TABLE "Giveaway";
ALTER TABLE "new_Giveaway" RENAME TO "Giveaway";

CREATE UNIQUE INDEX "Giveaway_slug_key" ON "Giveaway"("slug");
CREATE INDEX "Giveaway_status_idx" ON "Giveaway"("status");

-- ── Draw: wie viele Raenge Gewinner sind ────────────────────────────────────
ALTER TABLE "Draw" ADD COLUMN "winnerSlots" INTEGER NOT NULL DEFAULT 1;

PRAGMA foreign_keys=ON;
