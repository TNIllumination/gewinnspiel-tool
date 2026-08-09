-- Hochladen zu GitHub: Ziel und verschluesselter Zugangsschluessel.
ALTER TABLE "Settings" ADD COLUMN "githubRepo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "githubToken" TEXT NOT NULL DEFAULT '';
-- Aufbewahrung der veroeffentlichten Seiten, genannt in der Datenschutzerklaerung.
ALTER TABLE "Settings" ADD COLUMN "publishRetentionMonths" INTEGER NOT NULL DEFAULT 6;
-- Eigene Teilnahmebedingungen je Gewinnspiel.
ALTER TABLE "Giveaway" ADD COLUMN "customTerms" TEXT;
