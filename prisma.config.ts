import "dotenv/config";
import { defineConfig } from "prisma/config";

// Ohne .env laeuft die App trotzdem: Die Datenbank ist dann einfach die
// Datei gewinnspiel.db im Projektordner.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./gewinnspiel.db",
  },
});
