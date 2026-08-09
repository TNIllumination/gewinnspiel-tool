#!/usr/bin/env bash
# Holt die neueste Fassung von GitHub und tauscht die Programmdateien aus.
# Datenbank und Schlüssel bleiben unberührt.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js ist noch nicht installiert."
  echo "  Bitte einmalig von https://nodejs.org installieren (Variante LTS)."
  echo
  exit 1
fi

exec node scripts/update.mjs
