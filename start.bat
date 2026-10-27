@echo off
setlocal
rem ================================================================
rem  SocialVerse - Start unter Windows (Produktionsmodus)
rem  Doppelklick genuegt. Beenden mit Strg+C oder durch Schliessen des Fensters.
rem ================================================================
cd /d "%~dp0"
title SocialVerse

echo.
echo   SocialVerse wird vorbereitet ...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [Fehler] Node.js wurde nicht gefunden.
  echo   Bitte installiere die aktuelle LTS-Version von https://nodejs.org
  echo   und starte diese Datei danach erneut.
  echo.
  pause
  exit /b 1
)

node scripts\check-setup.mjs
set SETUP_RESULT=%errorlevel%
if "%SETUP_RESULT%"=="1" (
  echo.
  pause
  exit /b 1
)
if "%SETUP_RESULT%"=="2" (
  echo   Abhaengigkeiten werden installiert. Das dauert beim ersten Mal einige Minuten ...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [Fehler] npm install ist fehlgeschlagen. Pruefe deine Internetverbindung und versuche es erneut.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo   Konfigurationsdatei .env wurde aus .env.example angelegt.
)

set APP_PORT=3001
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
  if /i "%%a"=="PORT" if not "%%b"=="" set APP_PORT=%%b
)

echo   Anwendung wird gebaut ...
call npm run build --silent
if errorlevel 1 (
  echo.
  echo   [Fehler] Der Build ist fehlgeschlagen. Details stehen oben.
  pause
  exit /b 1
)

echo.
echo   SocialVerse startet unter http://127.0.0.1:%APP_PORT%  (oder http://localhost:%APP_PORT%)
echo   Der Browser oeffnet sich gleich automatisch. Zum Beenden: Strg+C
echo.
start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start "" http://127.0.0.1:%APP_PORT%"
call npm start
echo.
echo   SocialVerse wurde beendet.
pause
endlocal
