@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title 立体感知 - 空间实验室
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
if not exist "%~dp0dist\index.html" goto missing_build
echo 正在启动立体感知实验室，请保留此窗口。
echo 浏览器会自动打开；如未打开，请复制下方显示的地址。
echo.
node "%~dp0scripts\serve-static.mjs" --open %*
set "LAB_EXIT_CODE=%ERRORLEVEL%"
echo.
echo 服务已停止，退出代码：%LAB_EXIT_CODE%
echo 如果上方有错误，请保留窗口中的提示。
pause
exit /b %LAB_EXIT_CODE%

:missing_node
echo 未找到 Node.js。请安装 Node.js 22.14 或更高版本后重试。
pause
exit /b 1

:missing_build
echo 未找到 dist\index.html。请先完整解压运行包，再启动。
pause
exit /b 1
