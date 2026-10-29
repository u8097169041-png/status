@echo off
setlocal
rem ================================================================
rem  SocialVerse - Lokale KI (Ollama) pruefen und einrichten
rem  Fragt vor JEDEM Download nach. Ohne Zustimmung wird nichts installiert.
rem ================================================================
cd /d "%~dp0"
title SocialVerse - Lokale KI einrichten

where node >nul 2>nul
if errorlevel 1 (
  echo   [Fehler] Node.js wurde nicht gefunden. Bitte zuerst https://nodejs.org installieren.
  pause
  exit /b 1
)

node scripts\ai-check.mjs

rem ---- Ollama vorhanden? ----
set "OLLAMA=ollama"
where ollama >nul 2>nul
if not errorlevel 1 goto have_ollama
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
  set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
  goto have_ollama
)

echo   Ollama ist nicht installiert.
where winget >nul 2>nul
if errorlevel 1 goto manual_install
echo.
echo   Ollama kann ueber den Windows-Paketmanager winget installiert werden
echo   (offizielles Paket "Ollama.Ollama", Download ca. 1-2 GB, kostenlos).
choice /c JN /m "  Ollama jetzt installieren"
if errorlevel 2 goto cancelled
winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo   [Hinweis] Die Installation wurde nicht abgeschlossen.
  goto manual_install
)
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
echo   Ollama wurde installiert. Falls es nicht automatisch startet: Startmenue ^> "Ollama" oeffnen.
timeout /t 5 /nobreak >nul

:have_ollama
rem ---- Empfohlenes Modell ermitteln ----
set "MODEL="
set "SIZE="
for /f "tokens=1,2" %%a in ('node scripts\ai-check.mjs --recommend') do (
  set "MODEL=%%a"
  set "SIZE=%%b"
)
if "%MODEL%"=="" goto finish

"%OLLAMA%" list 2>nul | findstr /i /b /c:"%MODEL%" >nul
if not errorlevel 1 (
  echo   Das empfohlene Modell %MODEL% ist bereits installiert.
  goto finish
)

echo.
echo   Empfohlenes Modell fuer diesen Computer: %MODEL%  (Download ca. %SIZE% GB, kostenlos)
choice /c JN /m "  Modell jetzt herunterladen"
if errorlevel 2 goto cancelled
"%OLLAMA%" pull %MODEL%
if errorlevel 1 (
  echo   [Hinweis] Der Download ist fehlgeschlagen. Laeuft Ollama? Startmenue ^> "Ollama" oeffnen und erneut versuchen.
  goto finish
)
goto finish

:manual_install
echo.
echo   Bitte Ollama manuell installieren: https://ollama.com/download/windows
echo   Danach diese Datei erneut ausfuehren.
goto end

:cancelled
echo.
echo   Abgebrochen - es wurde nichts heruntergeladen. SocialVerse nutzt weiter die simulierte KI.
goto end

:finish
echo.
node scripts\ai-check.mjs

:end
echo.
pause
endlocal
