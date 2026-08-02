@echo off
chcp 65001 >nul
title couple-blog 启动器

echo ========================================
echo  启动 couple-blog 服务
echo ========================================
echo.

:: 启动管理后台（端口 5174）
echo [1/2] 启动管理后台...
start "Admin" cmd /c "cd /d "%~dp0admin" && npx vite --host"

:: 等几秒让 admin 先启动起来
timeout /t 3 /nobreak >nul

:: 启动博客前台（端口 5173）
echo [2/2] 启动博客前台...
start "Blog" cmd /c "cd /d "%~dp0blog" && npx vite --host"

echo.
echo 服务启动中，请稍候...
echo.
echo 管理后台: http://localhost:5174
echo 博客前台: http://localhost:5173
echo.
echo 本机 IP: 
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "ip=%%a"
    goto :showip
)
:showip
echo 局域网访问: http://%ip:~1%:5173 （博客）
echo 局域网访问: http://%ip:~1%:5174 （管理后台）
echo.
echo 提示: 其他设备需在同一局域网下才能访问
echo 按任意键退出...
pause >nul