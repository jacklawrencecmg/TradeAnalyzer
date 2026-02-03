@echo off
REM Ultimate Fantasy Football Trade Analyzer Runner for Windows
REM This script sets up and runs the Streamlit app

echo ====================================================
echo Ultimate Fantasy Football Trade Analyzer
echo ====================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from python.org
    pause
    exit /b 1
)

echo [OK] Python found
python --version
echo.

REM Check if pip is installed
pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is not installed or not in PATH
    pause
    exit /b 1
)

echo [OK] pip found
echo.

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed successfully
echo.

REM Run the Streamlit app
echo Starting Streamlit app...
echo The app will open in your browser automatically.
echo Press Ctrl+C to stop the server.
echo.
streamlit run app.py

pause
