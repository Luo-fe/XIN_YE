@echo off
chcp 65001 >nul
title couple-blog 外网启动器

set "ROOT=%~dp0"
set "ADMIN_PORT=5174"
set "BLOG_PORT=5173"
set "CLOUDFLARED=%ROOT%cloudflared.exe"

echo ========================================
echo  启动 couple-blog + 外网穿透
echo ========================================
echo.

:: 1. 检查 cloudflared 是否存在，不存在则下载
if not exist "%CLOUDFLARED%" (
    echo [*] 正在下载 cloudflared ...
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o "%CLOUDFLARED%"
    if errorlevel 1 (
        echo [!] 下载失败，请手动下载:
        echo    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
        echo    放到 %ROOT%
        pause
        exit /b 1
    )
    echo [*] 下载完成
)

:: 2. 启动管理后台（端口 5174）
echo [1/3] 启动管理后台 ...
start "Admin" cmd /c "cd /d "%ROOT%admin" && npx vite --host"

:: 3. 等待几秒
timeout /t 3 /nobreak >nul

:: 4. 启动博客前台（端口 5173）
echo [2/3] 启动博客前台 ...
start "Blog" cmd /c "cd /d "%ROOT%blog" && npx vite --host"

:: 5. 再等几秒让服务启动
timeout /t 5 /nobreak >nul

:: 6. 启动 Cloudflare Tunnel（外网穿透）
echo [3/3] 建立外网隧道 ...
echo.
echo 外网隧道建立中，请稍候...
echo 首次启动会显示 "Your quick Tunnel has been created" 和 URL
echo 关闭此窗口即断开外网访问
echo.
echo ========================================
echo  本地地址:
echo    博客: http://localhost:%BLOG_PORT%
echo    后台: http://localhost:%ADMIN_PORT%
echo ========================================
echo.

"%CLOUDFLARED%" tunnel --url http://localhost:%BLOG_PORT%

echo.
echo 隧道已断开
pause