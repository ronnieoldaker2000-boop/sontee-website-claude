@echo off
cd /d "%~dp0"
echo Starting SONTEE server...
echo.
echo Landing page: http://localhost:3000
echo Admin panel:  http://localhost:3000/admin
echo.
echo Keep this window open. Close it to stop the server.
echo.
node server.mjs
pause
