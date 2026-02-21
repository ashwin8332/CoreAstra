@echo off
REM CoreAstra Connection Manager - Backend Startup Script (Windows)
REM This script starts the Flask connection manager backend

echo ============================================================
echo CoreAstra Connection Manager Backend
echo ============================================================

cd /d "%~dp0backend"

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/Update dependencies
echo Installing dependencies...
pip install -r connection_requirements.txt --quiet

echo.
echo ============================================================
echo Starting Connection Manager Backend on http://localhost:8000
echo ============================================================
echo.

REM Start Flask application
python connection_app.py
