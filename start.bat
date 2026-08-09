@echo off
REM Doppelklick genuegt. Alles Weitere erledigt scripts\start.mjs.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js ist noch nicht installiert.
  echo.
  echo   Bitte einmalig von https://nodejs.org herunterladen
  echo   ^(die grosse gruene Schaltflaeche, Variante "LTS"^),
  echo   installieren und danach diese Datei erneut doppelklicken.
  echo.
  pause
  exit /b 1
)

node scripts\start.mjs

REM Nur im Fehlerfall stehenbleiben — bei sauberem Beenden
REM (Knopf im Tool) schliesst sich das Fenster von selbst.
if errorlevel 1 pause
