@echo off
cd /d "%~dp0"
set PYTHONPATH=%CD%
call dep\Scripts\python.exe main_vehicle.py %*