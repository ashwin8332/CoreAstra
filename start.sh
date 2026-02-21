#!/bin/bash
# CoreAstra Startup Script for Linux/Mac
# AI-Powered Terminal & Intelligent Control Interface
# Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)

echo ""
echo " ██████╗ ██████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗██████╗  █████╗ "
echo "██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗"
echo "██║     ██║   ██║██████╔╝█████╗  ███████║███████╗   ██║   ██████╔╝███████║"
echo "██║     ██║   ██║██╔══██╗██╔══╝  ██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║"
echo "╚██████╗╚██████╔╝██║  ██║███████╗██║  ██║███████║   ██║   ██║  ██║██║  ██║"
echo " ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝"
echo ""
echo "AI-Powered Terminal & Intelligent Control Interface"
echo "Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    echo "Please install Python 3.10+ using your package manager"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "[INFO] Starting CoreAstra..."
echo ""

# Start Backend
echo "[INFO] Starting Backend Server..."
cd backend

if [ ! -d "venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[INFO] Installing Python dependencies..."
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    echo "[INFO] Creating .env file from template..."
    cp .env.example .env
    echo "[WARNING] Please edit backend/.env and add your API keys!"
fi

# Start backend in background
python main.py &
BACKEND_PID=$!

cd ..

# Start Frontend
echo "[INFO] Starting Frontend Development Server..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing Node.js dependencies..."
    npm install
fi

# Start frontend in background
npm start &
FRONTEND_PID=$!

cd ..

echo ""
echo "[SUCCESS] CoreAstra is starting!"
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
