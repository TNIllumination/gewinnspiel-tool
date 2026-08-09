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
pause
