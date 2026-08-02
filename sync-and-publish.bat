@echo off
chcp 65001 >nul
REM ============================================
REM  一键同步 + 发布到 GitHub Pages
REM  用法：双击运行（在 f:\图片\couple-blog 下）
REM  步骤：1) 重新分析照片并生成缩略图/manifest
REM        2) 提交所有改动
REM        3) push（触发 GitHub Actions 自动构建上线，约 2 分钟）
REM ============================================
cd /d "%~dp0"

echo [1/3] 分析照片 + 生成缩略图/manifest（无新增照片时跳过也可）...
call node scripts\analyze-photos.mjs
if errorlevel 1 (
  echo  !! 分析失败，请查看上方错误信息
  pause
  exit /b 1
)

echo [2/3] 提交改动...
git add -A
git commit -m "更新内容：照片/日记/配置（%date% %time%）"
if errorlevel 1 (
  echo  !! 没有可提交的改动（或提交失败）
)

echo [3/3] 推送到 GitHub（触发自动部署）...
git push origin main
if errorlevel 1 (
  echo  !! push 失败，请检查网络或认证
  pause
  exit /b 1
)

echo.
echo ✅ 已发布！GitHub Actions 正在构建（约 2 分钟）...
echo    打开 https://github.com/Luo-fe/XIN_YE/actions 查看进度
echo    完成地址：https://luo-fe.github.io/XIN_YE/
pause
