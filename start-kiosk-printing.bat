@echo off
setlocal

set "APP_URL=https://tastytables.in/management.html"
set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME_EXE%" (
  set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

if not exist "%CHROME_EXE%" (
  set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if not exist "%CHROME_EXE%" (
  echo Chrome was not found in Program Files.
  echo Please install Google Chrome or update CHROME_EXE in this file.
  pause
  exit /b 1
)

start "" "%CHROME_EXE%" --kiosk-printing --start-maximized --new-window "%APP_URL%"
