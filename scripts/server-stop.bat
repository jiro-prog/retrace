@echo off
REM Stop the Retrace Fastify dev server (tsx watch + node child) listening on 3000.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping retrace-server PID %%a ...
    taskkill /f /pid %%a /t >nul 2>&1
    goto :done
)

echo [INFO] no process listening on port 3000.
exit /b 0

:done
exit /b 0
