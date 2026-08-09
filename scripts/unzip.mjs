// Minimaler ZIP-Leser mit Node-Bordmitteln.
//
// Warum keine Bibliothek? Das Update-Programm muss auch dann laufen, wenn
// die alte Fassung eine noetige Bibliothek noch gar nicht kennt — sonst
// scheitert das Update ausgerechnet bei denen, die es am noetigsten haben.
// Node bringt mit zlib alles mit, was fuer ZIP gebraucht wird.

import { inflateRawSync } from "node:zlib";

const SIG_EOCD = 0x06054b50; // Ende des zentralen Verzeichnisses
const SIG_CENTRAL = 0x02014b50; // Eintrag im zentralen Verzeichnis
const SIG_LOCAL = 0x04034b50; // Kopf einer einzelnen Datei

/// Liest ein ZIP-Archiv und liefert { "pfad/datei.txt": Buffer, ... }.
/// Ordnereintraege werden uebersprungen.
export function unzip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const eocd = findEocd(buf);

  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  const files = {};

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== SIG_CENTRAL) {
      throw new Error(`Beschädigtes Archiv: Eintrag ${i + 1} nicht lesbar.`);
    }

    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (!name.endsWith("/")) {
      files[name] = readLocal(buf, localOffset, method, compressedSize, name);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function findEocd(buf) {
  // Das Schlussverzeichnis steht am Ende, kann aber einen Kommentar
  // hinter sich haben — deshalb rueckwaerts suchen.
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error("Das ist keine gültige ZIP-Datei.");
}

function readLocal(buf, localOffset, method, compressedSize, name) {
  if (buf.readUInt32LE(localOffset) !== SIG_LOCAL) {
    throw new Error(`Beschädigtes Archiv bei „${name}“.`);
  }

  // Die Laengenangaben im lokalen Kopf koennen abweichen — deshalb von dort lesen.
  const nameLength = buf.readUInt16LE(localOffset + 26);
  const extraLength = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const data = buf.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return Buffer.from(data); // unkomprimiert abgelegt
  if (method === 8) return inflateRawSync(data); // Deflate — der Normalfall

  throw new Error(`„${name}“ nutzt ein unbekanntes Packverfahren (${method}).`);
}
