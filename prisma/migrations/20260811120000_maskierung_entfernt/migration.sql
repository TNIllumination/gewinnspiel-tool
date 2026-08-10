-- Die Option „Namen maskieren" entfaellt.
--
-- Sie stand seit dem ersten Datenmodell hier, war ueber die Oberflaeche nie
-- einstellbar und wurde nur auf der oertlichen Seite gelesen. Ehrlich umsetzen
-- liesse sie sich ohnehin nicht: Die Pruefsumme entsteht ueber die Klarnamen,
-- und die veroeffentlichte Teilnehmerliste enthaelt sie. Ein Schalter, der
-- Schutz vortaeuscht, ist schlimmer als keiner.
ALTER TABLE "Giveaway" DROP COLUMN "maskUsernames";
