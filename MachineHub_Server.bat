@echo off
pushd "%~dp0"

echo Recherche d'une ancienne instance de server.js...

powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

echo Demarrage du serveur...
".\node\node-v24.16.0-win-x64\node.exe" server.js

pause