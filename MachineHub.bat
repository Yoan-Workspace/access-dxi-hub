@echo off

pushd "%~dp0"

start "" wscript.exe "MachineHub.vbs"

timeout /t 15 /nobreak >nul

start "" "http://localhost:3000"