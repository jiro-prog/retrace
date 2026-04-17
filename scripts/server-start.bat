@echo off
REM Start the Retrace Fastify dev server (tsx watch) in a separate window.

set REPO=%~dp0..

netstat -ano | findstr :3000 | findstr LISTENING >nul
if not errorlevel 1 (
    echo [WARN] port 3000 is already in use. Run server-stop.bat first if a stale instance is running.
    exit /b 1
)

start "retrace-server" cmd /c "cd /d %REPO% && npm -w server run dev"
echo Retrace server starting at http://127.0.0.1:3000
