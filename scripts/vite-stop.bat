@echo off
REM Stop any Vite dev server listening on 5173-5179.
REM Targets specific ports rather than killing by image name so unrelated
REM node.exe processes (Fastify, llama-server-adjacent tools) stay untouched.

set STOPPED=0
for %%p in (5173 5174 5175 5176 5177 5178 5179) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo Stopping Vite on port %%p, PID %%a ...
        taskkill /f /pid %%a >nul 2>&1
        set STOPPED=1
    )
)

if %STOPPED%==0 echo [INFO] no Vite dev server found on 5173-5179.
exit /b 0
