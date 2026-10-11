@echo off
cd /d "%~dp0"
set PYTHONPATH=%CD%
call dep\Scripts\python.exe -m uvicorn api.api:app --host 0.0.0.0 --port 3002 --reload