import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Next.js baut im Dev-Modus haeufig neu auf. Ohne Cache im globalThis
// entstuenden dabei immer neue Verbindungspools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Standard: eine Datei im Projektordner. So laeuft die App ohne
  // Einrichtung, und die Daten bleiben auf dem eigenen Rechner.
  const url = process.env.DATABASE_URL ?? "file:./gewinnspiel.db";
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
