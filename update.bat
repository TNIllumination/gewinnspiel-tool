@echo off
REM Holt die neueste Fassung von GitHub und tauscht die Programmdateien aus.
REM Deine Datenbank und deine Schluessel bleiben unberuehrt.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js ist noch nicht installiert.
  echo   Bitte einmalig von https://nodejs.org installieren ^(Variante "LTS"^).
  echo.
  pause
  exit /b 1
)

node scripts\update.mjs
pause
