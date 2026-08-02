@echo off
echo Fixing PowerShell execution policy...
reg add "HKCU\Software\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d RemoteSigned /f

echo.
echo ============================================
echo Step 1: Checking node.exe processes
echo ============================================
tasklist /fi "imagename eq node.exe" /v
echo.

echo ============================================
echo Step 2: Checking port 5174
echo ============================================
netstat -ano | findstr ":5174"
echo.

echo ============================================
echo Step 3: Killing existing node processes
echo ============================================
taskkill /f /im node.exe
echo Done.
echo.

echo ============================================
echo Step 4: Starting admin dev server
echo ============================================
cd /d "f:\图片\couple-blog\admin"
echo Current directory: %cd%
start "Admin Dev Server" cmd /c "npm run dev"
echo Server started in a new window.
echo ============================================
echo ALL DONE
echo ============================================
pause