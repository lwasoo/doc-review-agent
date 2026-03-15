@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title AI Document Review - Install

echo.
echo ============================================================
echo   AI Document Review - Installer (Windows)
echo ============================================================
echo.

cd /d "%~dp0"
echo [INFO] Project root: %CD%
echo.

echo [STEP] Checking Node.js and npm...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Download: https://nodejs.org/
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js: %%i
for /f "tokens=*" %%i in ('npm --version') do echo [OK] npm: %%i
echo.

echo [STEP] Detecting Python (prefer 3.12 / 3.11 / 3.10)...
set "PYTHON_CMD="
py -3.12 --version >nul 2>&1 && set "PYTHON_CMD=py -3.12"
if not defined PYTHON_CMD py -3.11 --version >nul 2>&1 && set "PYTHON_CMD=py -3.11"
if not defined PYTHON_CMD py -3.10 --version >nul 2>&1 && set "PYTHON_CMD=py -3.10"
if not defined PYTHON_CMD (
    python --version >nul 2>&1 && set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
    echo [ERROR] Python not found. Please install Python 3.10+.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('%PYTHON_CMD% --version') do set "PY_VERSION=%%i"
echo [OK] !PY_VERSION!
echo.

echo [STEP] Installing backend dependencies...
cd app\api

if not exist "venv\Scripts\python.exe" (
    echo [INFO] Creating virtual environment in app\api\venv ...
    %PYTHON_CMD% -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment.
    pause
    exit /b 1
)

python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip/setuptools/wheel.
    pause
    exit /b 1
)

pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)
echo [OK] Python dependencies installed.

if not exist ".env" (
    if exist ".env.tpl" (
        copy .env.tpl .env >nul
        echo [OK] Created app\api\.env from template.
    ) else (
        echo [WARN] app\api\.env.tpl not found, skip creating .env
    )
)

set "LLM_PROVIDER="
set "OLLAMA_MODEL="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "K=%%A"
    set "V=%%B"
    if /I "!K!"=="LLM_PROVIDER" set "LLM_PROVIDER=!V!"
    if /I "!K!"=="OLLAMA_MODEL" set "OLLAMA_MODEL=!V!"
)
if not defined OLLAMA_MODEL set "OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M"

if /I "!LLM_PROVIDER!"=="ollama" (
    echo.
    echo [STEP] LLM_PROVIDER=ollama detected. Preparing Ollama and model...
    set "OFFLINE_ROOT=%CD%\..\..\offline_bundle"
    set "OFFLINE_OLLAMA_WIN=!OFFLINE_ROOT!\ollama\windows\OllamaSetup.exe"
    set "OFFLINE_MODELFILE=!OFFLINE_ROOT!\models\Modelfile"

    where ollama >nul 2>&1
    if errorlevel 1 (
        if exist "!OFFLINE_OLLAMA_WIN!" (
            echo [INFO] Found offline Ollama installer: !OFFLINE_OLLAMA_WIN!
            echo [INFO] Launching installer...
            start /wait "" "!OFFLINE_OLLAMA_WIN!"
            where ollama >nul 2>&1
        )
    )

    where ollama >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Ollama not found. Install from: https://ollama.com/download
        echo [WARN] Then run: ollama pull !OLLAMA_MODEL!
    ) else (
        set "MODEL_FOUND="
        for /f "tokens=1" %%M in ('ollama list ^| findstr /R /B /I /C:"!OLLAMA_MODEL! "') do set "MODEL_FOUND=1"

        if not defined MODEL_FOUND (
            if exist "!OFFLINE_MODELFILE!" (
                echo [INFO] Found offline model Modelfile: !OFFLINE_MODELFILE!
                pushd "!OFFLINE_ROOT!\models"
                ollama create !OLLAMA_MODEL! -f Modelfile
                popd
            )
        )

        set "MODEL_FOUND="
        for /f "tokens=1" %%M in ('ollama list ^| findstr /R /B /I /C:"!OLLAMA_MODEL! "') do set "MODEL_FOUND=1"

        if not defined MODEL_FOUND (
            echo [INFO] Offline model not found. Trying online pull...
            ollama pull !OLLAMA_MODEL!
        )

        set "MODEL_FOUND="
        for /f "tokens=1" %%M in ('ollama list ^| findstr /R /B /I /C:"!OLLAMA_MODEL! "') do set "MODEL_FOUND=1"
        if defined MODEL_FOUND (
            echo [OK] Ollama model ready: !OLLAMA_MODEL!
        ) else (
            echo [WARN] Failed to prepare model: !OLLAMA_MODEL!
            echo [WARN] Try manually:
            echo        ollama pull !OLLAMA_MODEL!
        )
    )
)

cd ..\..
echo.

echo [STEP] Installing frontend dependencies...
cd app\ui
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b 1
)
echo [OK] npm dependencies installed.
cd ..\..
echo.

echo ============================================================
echo [DONE] Installation complete.
echo [NEXT] 1) Review app\api\.env
echo [NEXT] 2) Start with start.bat (or start.ps1)
echo ============================================================
echo.

pause

