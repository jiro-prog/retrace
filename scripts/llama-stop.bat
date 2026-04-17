@echo off
REM Stop the llama-server process bound to port 8080.
REM Targets the PID listening on :8080 rather than killing by image name,
REM so it won't clobber another llama-server instance on a different port.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Stopping llama-server PID %%a ...
    taskkill /f /pid %%a
    goto :done
)

echo [INFO] no process listening on port 8080.
exit /b 0

:done
exit /b 0
