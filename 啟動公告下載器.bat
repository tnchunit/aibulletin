@echo off
chcp 65001 >nul
title 臺南市教育公告 OCR 自動下載助手

cd /d "%~dp0"

echo =======================================================
echo   臺南市教育公告 OCR 自動下載助手
echo =======================================================
echo.

set PYTHON_EXE=
if exist "C:\Program Files\Inkscape\bin\python.exe" (
    set "PYTHON_EXE=C:\Program Files\Inkscape\bin\python.exe"
) else if exist "C:\Program Files\MODA ODF Application Tools\program\python.exe" (
    set "PYTHON_EXE=C:\Program Files\MODA ODF Application Tools\program\python.exe"
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PYTHON_EXE=python"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [錯誤] 找不到可用的 Python 執行環境！
    echo 請確認已安裝 Python 3.10 或 Inkscape。
    pause
    exit /b 1
)

echo 正在啟動後端伺服器 (使用 %PYTHON_EXE%)...
start "" http://localhost:8088
"%PYTHON_EXE%" server.py

pause
