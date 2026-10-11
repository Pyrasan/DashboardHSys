@echo off
REM ================================================
REM SecurePass - Install Dependencies
REM ================================================

echo [INFO] Installing dependencies to dep\ folder...
echo.

REM Create virtual environment
if not exist "%~dp0dep" (
    echo [1/5] Creating virtual environment...
    python -m venv dep
)

REM Install core dependencies
echo [2/5] Installing core dependencies...
call "%~dp0dep\Scripts\pip.exe" install opencv-python numpy paho-mqtt

REM Install FastAPI dependencies
echo [3/5] Installing FastAPI dependencies...
call "%~dp0dep\Scripts\pip.exe" install fastapi uvicorn pydantic pydantic-settings python-jose passlib aiosqlite

REM Install AI dependencies (these may fail if CMake is not installed)
echo [4/5] Installing AI dependencies...
call "%~dp0dep\Scripts\pip.exe" install ultralytics paddleocr

REM Install face-recognition (requires CMake for dlib)
echo [5/5] Installing face-recognition...
call "%~dp0dep\Scripts\pip.exe" install face-recognition

echo.
echo [DONE] Dependencies installed!
echo.
echo If face-recognition failed, you need:
echo   1. Install CMake: https://cmake.org/download/
echo   2. Add CMake to PATH
echo   3. Or use global Python instead
echo.
pause
