@echo off
REM Start llama.cpp server in a separate window so logs stay visible.
REM Adjust LLAMA_EXE / MODEL paths below if you relocate binaries.

set LLAMA_EXE=C:\Users\sojir\projects\llama.cpp\bin\llama-server.exe
set MODEL=C:\Users\sojir\projects\models\google_gemma-4-E4B-it-Q4_K_M.gguf

if not exist "%LLAMA_EXE%" (
    echo [ERROR] llama-server not found: %LLAMA_EXE%
    exit /b 1
)
if not exist "%MODEL%" (
    echo [ERROR] model not found: %MODEL%
    exit /b 1
)

REM Bail if port 8080 is already bound (prevents silent double-start).
netstat -ano | findstr :8080 | findstr LISTENING >nul
if not errorlevel 1 (
    echo [WARN] port 8080 is already in use. Run llama-stop.bat first if a stale instance is running.
    exit /b 1
)

echo Starting llama-server on 127.0.0.1:8080 ...
REM --reasoning-budget 0 disables the chat-template's <think> mode so that
REM Gemma 4's output goes straight to `content` (required for our
REM response_format: json_schema path).
start "llama-server" "%LLAMA_EXE%" ^
    -m "%MODEL%" ^
    --host 127.0.0.1 --port 8080 ^
    --ctx-size 8192 --n-gpu-layers 999 ^
    --reasoning-budget 0

echo.
echo llama-server is booting in a separate window. Model load takes ~10-20s.
echo Check http://127.0.0.1:8080/health once it's ready.
