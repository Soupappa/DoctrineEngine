@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installe Node.js puis relance ce fichier.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo La version du jeu est introuvable dans le dossier dist.
  echo Lance d'abord: npm run build
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 2 /nobreak >nul && start "" http://127.0.0.1:5174/"
node scripts\static-server.cjs

pause
