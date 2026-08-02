@echo off
chcp 65001 >nul
echo ============================================
echo 正在安装依赖并启动后台管理
echo ============================================
echo.

echo [1/2] 安装 admin 依赖...
cd /d "f:\图片\couple-blog\admin"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo 安装失败，请检查网络连接后重试
    pause
    exit /b
)
echo 依赖安装完成！
echo.

echo [2/2] 启动 admin 开发服务器...
start "Admin Dev Server" cmd /k "npm run dev"
echo.
echo 服务器已启动，请访问 http://localhost:5174
echo 按任意键退出...
pause >nul