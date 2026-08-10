-- Zugang zu Instagram und der gewaehlte Beitrag je Gewinnspiel.
ALTER TABLE "Settings" ADD COLUMN "instagramToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "instagramHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "instagramUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "instagramExpires" DATETIME;

ALTER TABLE "GiveawaySource" ADD COLUMN "externalId" TEXT;
ALTER TABLE "GiveawaySource" ADD COLUMN "postLabel" TEXT;
