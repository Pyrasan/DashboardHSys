@echo off
cd /d "%~dp0"
call dep\Scripts\python.exe simulation\simulation_app.py %*
