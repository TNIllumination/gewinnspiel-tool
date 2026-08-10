-- Zeitpunkte fuer die Veroeffentlichungs-Checkliste.
ALTER TABLE "Giveaway" ADD COLUMN "termsPublishedAt" DATETIME;
ALTER TABLE "Giveaway" ADD COLUMN "proofPublishedAt" DATETIME;
ALTER TABLE "Giveaway" ADD COLUMN "lastUploadAt" DATETIME;
