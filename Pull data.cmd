@echo off
rem Double-click to bring the live site's data to this laptop and make the Excel workbook.
rem Same as: npm run data  (or npm run data:names, to include student names)
cd /d "%~dp0"
title bugHunters: pull data

echo.
echo  Step 1 of 2: downloading the live site's data (names are decrypted on this laptop)...
echo.
call npm run pull
if errorlevel 1 goto failed

echo.
set /p NAMES=" Include student names in the spreadsheet? Staff only. Type y or n, then press Enter: "
echo.
echo  Step 2 of 2: building the Excel workbook...
echo.
if /i "%NAMES%"=="y" (
  call npm run export -- --names
) else (
  call npm run export
)
if errorlevel 1 goto failed

echo.
echo  Done. Opening the exports folder: the newest folder has bughunters.xlsx (start with its "Read me" tab).
start "" "%USERPROFILE%\bughunters-data\v2\exports"
echo.
pause
exit /b 0

:failed
echo.
echo  Something went wrong. Copy the message above and send it to Claude.
echo.
pause
exit /b 1
