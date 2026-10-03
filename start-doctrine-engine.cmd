@echo off
cd /d "%~dp0"
start "Doctrine Engine Server" cmd /k "npm.cmd run serve"
ping 127.0.0.1 -n 3 >nul
start "" "http://127.0.0.1:5174/"
