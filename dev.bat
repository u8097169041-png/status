@echo off
setlocal
rem ================================================================
rem  SocialVerse - Entwicklungsmodus mit Hot Reload (Windows)
rem  Frontend: http://127.0.0.1:5173   Backend: http://127.0.0.1:3001
rem ================================================================
cd /d "%~dp0"
title SocialVerse (Entwicklung)

where node >nul 2>nul
if errorlevel 1 (
  echo   [Fehler] Node.js wurde nicht gefunden. Bitte die LTS-Version von https://nodejs.org installieren.
  pause
  exit /b 1
)

node scripts\check-setup.mjs
set SETUP_RESULT=%errorlevel%
if "%SETUP_RESULT%"=="1" (
  pause
  exit /b 1
)
if "%SETUP_RESULT%"=="2" (
  echo   Abhaengigkeiten werden installiert ...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo   [Fehler] npm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo   Konfigurationsdatei .env wurde aus .env.example angelegt.
)

echo.
echo   Entwicklungsmodus startet. Der Browser oeffnet sich gleich (http://127.0.0.1:5173).
echo   Aenderungen am Code werden automatisch neu geladen. Zum Beenden: Strg+C
echo.
start "" /b cmd /c "ping -n 7 127.0.0.1 >nul & start "" http://127.0.0.1:5173"
call npm run dev
pause
endlocal
