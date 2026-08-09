-- Merkfeld fuer die Einstiegsliste: Impressumsfrage beantwortet?
ALTER TABLE "Settings" ADD COLUMN "impressumGeklaert" BOOLEAN NOT NULL DEFAULT false;
