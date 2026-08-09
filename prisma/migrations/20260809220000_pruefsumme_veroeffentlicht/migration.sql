-- Zeitpunkt, zu dem die Pruefsumme oeffentlich wurde. Ohne ihn laesst sich
-- nicht belegen, dass sie vor der Ziehung feststand.
ALTER TABLE "Draw" ADD COLUMN "commitPublishedAt" DATETIME;
