#!/bin/bash
# CoreAstra Connection Manager - Backend Startup Script (Linux/Mac)
# This script starts the Flask connection manager backend

echo "============================================================"
echo "CoreAstra Connection Manager Backend"
echo "============================================================"

cd "$(dirname "$0")/backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/Update dependencies
echo "Installing dependencies..."
pip install -r connection_requirements.txt --quiet

echo ""
echo "============================================================"
echo "Starting Connection Manager Backend on http://localhost:8000"
echo "============================================================"
echo ""

# Start Flask application
python connection_app.py
