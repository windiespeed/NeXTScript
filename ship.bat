@echo off
if "%~1"=="" (
    echo Error: Please provide a commit message.
    echo Usage: ship "commit message"
    exit /b 1
)
git add app/ components/ lib/ types/ package.json package-lock.json .env.local.example README.md ship.bat ship.sh
git commit -m "%~1"
git push
