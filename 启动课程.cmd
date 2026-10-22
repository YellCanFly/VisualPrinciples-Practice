@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.14 或更高版本。
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  call npm.cmd run setup
  if errorlevel 1 goto failed
  call npm.cmd run build
  if errorlevel 1 goto failed
)
node scripts\serve-static.mjs --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo 启动失败，请查看上方错误信息。
pause
exit /b 1
