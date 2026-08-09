#!/usr/bin/env bash
# Startet das Gewinnspiel-Tool. Alles Weitere erledigt scripts/start.mjs.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js ist noch nicht installiert."
  echo "  Bitte einmalig von https://nodejs.org installieren (Variante LTS)"
  echo "  und dieses Skript danach erneut starten."
  echo
  exit 1
fi

exec node scripts/start.mjs
