@echo off
REM Start the Vite dev server in a separate window.

set REPO=%~dp0..

netstat -ano | findstr :5173 | findstr LISTENING >nul
if not errorlevel 1 (
    echo [WARN] port 5173 is already in use. Run vite-stop.bat first if a stale instance is running.
    exit /b 1
)

start "vite" cmd /c "cd /d %REPO% && npm -w client run dev"
echo Vite dev server starting at http://localhost:5173
