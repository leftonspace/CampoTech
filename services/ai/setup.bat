@echo off
REM CampoTech AI Service Quick Setup Script
REM Run this from the services/ai directory

echo.
echo ========================================
echo   CampoTech AI Service Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/5] Checking Python version...
python --version

REM Check if venv exists
if not exist "venv" (
    echo.
    echo [2/5] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
) else (
    echo.
    echo [2/5] Virtual environment already exists
)

REM Activate venv
echo.
echo [3/5] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)

REM Install dependencies
echo.
echo [4/5] Installing dependencies (this may take a few minutes)...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

REM Check if .env exists
if not exist ".env" (
    echo.
    echo [5/5] Creating .env file from example...
    copy .env.example .env >nul
    echo [OK] .env file created
    echo.
    echo ========================================
    echo   IMPORTANT: Configure your .env file
    echo ========================================
    echo.
    echo Please edit .env and add:
    echo   1. OPENAI_API_KEY (get from https://platform.openai.com/api-keys^)
    echo   2. DATABASE_URL (copy from apps/web/.env^)
    echo.
    echo Then run: python main.py
    echo.
    pause
) else (
    echo.
    echo [5/5] .env file already exists
    echo.
    echo ========================================
    echo   Setup Complete!
    echo ========================================
    echo.
    echo To start the AI service, run:
    echo   python main.py
    echo.
    echo The service will be available at:
    echo   http://localhost:8000
    echo.
    echo To test, visit:
    echo   http://localhost:8000/health
    echo.
    pause
)
