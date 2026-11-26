@echo off
rem Double-click to start the MagicTouch wall on a Windows PC. Needs Node.js 18+ (nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org/ and run this again. & pause & exit /b 1)
start "" cmd /c "timeout /t 2 >nul & start chrome --start-fullscreen http://localhost:8090/ || start http://localhost:8090/"
node server\index.js
