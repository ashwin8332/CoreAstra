@echo off
REM CoreAstra Startup Script for Windows
REM AI-Powered Terminal & Intelligent Control Interface
REM Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)

echo.
echo  ██████╗ ██████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗██████╗  █████╗ 
echo ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗
echo ██║     ██║   ██║██████╔╝█████╗  ███████║███████╗   ██║   ██████╔╝███████║
echo ██║     ██║   ██║██╔══██╗██╔══╝  ██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║
echo ╚██████╗╚██████╔╝██║  ██║███████╗██║  ██║███████║   ██║   ██║  ██║██║  ██║
echo  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
echo.
echo AI-Powered Terminal ^& Intelligent Control Interface
echo Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Starting CoreAstra...
echo.

REM Start Backend
echo [INFO] Starting Backend Server...
cd backend

if not exist venv (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo [INFO] Installing Python dependencies...
pip install -r requirements.txt -q

if not exist .env (
    echo [INFO] Creating .env file from template...
    copy .env.example .env
    echo [WARNING] Please edit backend\.env and add your API keys!
)

start "CoreAstra Backend" cmd /k "venv\Scripts\activate.bat && python main.py"

cd ..

REM Start Frontend
echo [INFO] Starting Frontend Development Server...
cd frontend

if not exist node_modules (
    echo [INFO] Installing Node.js dependencies...
    call npm install
)

start "CoreAstra Frontend" cmd /k "npm start"

cd ..

echo.
echo [SUCCESS] CoreAstra is starting!
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to exit this window...
pause >nul
