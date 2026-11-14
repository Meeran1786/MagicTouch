@echo off
REM MagicTouch - Windows launcher (webcam version). Double-click this file.
REM Starts a small local server, then opens the app fullscreen in Edge.
cd /d "%~dp0"
start "MagicTouch server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
timeout /t 2 >nul
set EDGE_A=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
set EDGE_B=C:\Program Files\Microsoft\Edge\Application\msedge.exe
if exist "%EDGE_A%" (set "EDGE_PATH=%EDGE_A%") else if exist "%EDGE_B%" (set "EDGE_PATH=%EDGE_B%") else (start "" http://localhost:8080/ & exit /b 0)
start "" "%EDGE_PATH%" --user-data-dir="%LOCALAPPDATA%\magictouch-edge" --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen --app=http://localhost:8080/
