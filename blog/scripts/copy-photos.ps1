﻿﻿# copy-photos.ps1
# 精选拷贝情侣博客照片到 public/photos/<year>/<event>/ 结构。
# 路径含中文与空格，全部用双引号包裹；使用 -LiteralPath 避免通配符歧义。

$ErrorActionPreference = 'Stop'

$root = 'f:\图片\couple-blog\blog\public\photos'
$src = 'f:\图片\照片'

if (!(Test-Path -LiteralPath $root)) {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
}

# 每条: @{ Src = 源绝对路径; Dst = 目标绝对路径 }
$jobs = @(
    # ===== 2023/early (8 张，覆盖 9/11/12 月) =====
    @{ Src = "$src\2023\IMG_20230923_215430.jpg";       Dst = "$root\2023\early\IMG_20230923_215430.jpg" }
    @{ Src = "$src\2023\IMG_20231116_125802.jpg";       Dst = "$root\2023\early\IMG_20231116_125802.jpg" }
    @{ Src = "$src\2023\beauty_20231115205750.jpg";     Dst = "$root\2023\early\beauty_20231115205750.jpg" }
    @{ Src = "$src\2023\mmexport1700060213033.jpg";     Dst = "$root\2023\early\mmexport1700060213033.jpg" }
    @{ Src = "$src\2023\IMG_20231210_182941.jpg";       Dst = "$root\2023\early\IMG_20231210_182941.jpg" }
    @{ Src = "$src\2023\IMG_20231214_180535.jpg";       Dst = "$root\2023\early\IMG_20231214_180535.jpg" }
    @{ Src = "$src\2023\IMG_20231224_170925.jpg";       Dst = "$root\2023\early\IMG_20231224_170925.jpg" }
    @{ Src = "$src\2023\IMG_20231225_204243.jpg";       Dst = "$root\2023\early\IMG_20231225_204243.jpg" }

    # ===== 2024/9-4-afternoon (8 张，间隔挑 5N3A69xx) =====
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6916.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6916.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6919.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6919.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6925.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6925.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6930.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6930.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6935.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6935.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6940.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6940.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6945.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6945.JPG" }
    @{ Src = "$src\2024\photo\9.4下午2点\5N3A6950.JPG"; Dst = "$root\2024\9-4-afternoon\5N3A6950.JPG" }

    # ===== 2024/misc (8 张，13 位毫秒时间戳散图，覆盖 4-5 月) =====
    @{ Src = "$src\2024\photo\1712213440011.jpg"; Dst = "$root\2024\misc\1712213440011.jpg" }
    @{ Src = "$src\2024\photo\1712285567824.jpg"; Dst = "$root\2024\misc\1712285567824.jpg" }
    @{ Src = "$src\2024\photo\1713346884019.jpg"; Dst = "$root\2024\misc\1713346884019.jpg" }
    @{ Src = "$src\2024\photo\1713348486749.jpg"; Dst = "$root\2024\misc\1713348486749.jpg" }
    @{ Src = "$src\2024\photo\1716029979480.jpg"; Dst = "$root\2024\misc\1716029979480.jpg" }
    @{ Src = "$src\2024\photo\1716041834151.jpg"; Dst = "$root\2024\misc\1716041834151.jpg" }
    @{ Src = "$src\2024\photo\1716548835887.jpg"; Dst = "$root\2024\misc\1716548835887.jpg" }
    @{ Src = "$src\2024\photo\1716549219642.jpg"; Dst = "$root\2024\misc\1716549219642.jpg" }

    # ===== 2025/shandong (8 张，间隔挑 DSC036xx) =====
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03605.JPG"; Dst = "$root\2025\shandong\DSC03605.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03610.JPG"; Dst = "$root\2025\shandong\DSC03610.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03616.JPG"; Dst = "$root\2025\shandong\DSC03616.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03620.JPG"; Dst = "$root\2025\shandong\DSC03620.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03626.JPG"; Dst = "$root\2025\shandong\DSC03626.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03630.JPG"; Dst = "$root\2025\shandong\DSC03630.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03635.JPG"; Dst = "$root\2025\shandong\DSC03635.JPG" }
    @{ Src = "$src\2025\山东之旅\公主驾到之百元大照\DSC03641.JPG"; Dst = "$root\2025\shandong\DSC03641.JPG" }

    # ===== 2026/jiumu (10 张，覆盖 1/1、1/3、1/4、1/5、1/8、1/9) =====
    @{ Src = "$src\2026\九木\IMG_20260101_123926.jpg"; Dst = "$root\2026\jiumu\IMG_20260101_123926.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260101_210017.jpg"; Dst = "$root\2026\jiumu\IMG_20260101_210017.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260103_152448.jpg"; Dst = "$root\2026\jiumu\IMG_20260103_152448.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260103_195132.jpg"; Dst = "$root\2026\jiumu\IMG_20260103_195132.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260104_131702.jpg"; Dst = "$root\2026\jiumu\IMG_20260104_131702.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260104_133232.jpg"; Dst = "$root\2026\jiumu\IMG_20260104_133232.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260105_193444.jpg"; Dst = "$root\2026\jiumu\IMG_20260105_193444.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260108_114954.jpg"; Dst = "$root\2026\jiumu\IMG_20260108_114954.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260108_161238.jpg"; Dst = "$root\2026\jiumu\IMG_20260108_161238.jpg" }
    @{ Src = "$src\2026\九木\IMG_20260109_124835.jpg"; Dst = "$root\2026\jiumu\IMG_20260109_124835.jpg" }

    # ===== 2026/pingyao (精修 10 + 底片 5 = 15 张) =====
    # 精修（小写 .jpg，质量更好）全部拷贝
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0032.jpg"; Dst = "$root\2026\pingyao\IMG_0032.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0036.jpg"; Dst = "$root\2026\pingyao\IMG_0036.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0038.jpg"; Dst = "$root\2026\pingyao\IMG_0038.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0050.jpg"; Dst = "$root\2026\pingyao\IMG_0050.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0053.jpg"; Dst = "$root\2026\pingyao\IMG_0053.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0067.jpg"; Dst = "$root\2026\pingyao\IMG_0067.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0071.jpg"; Dst = "$root\2026\pingyao\IMG_0071.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0077.jpg"; Dst = "$root\2026\pingyao\IMG_0077.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0087.jpg"; Dst = "$root\2026\pingyao\IMG_0087.jpg" }
    @{ Src = "$src\2026\平遥之大小姐出行！\精修\IMG_0093.jpg"; Dst = "$root\2026\pingyao\IMG_0093.jpg" }
    # 底片（大写 .JPG）挑 5 张，编号与精修不重叠，避免 Windows 大小写冲突
    @{ Src = "$src\2026\平遥之大小姐出行！\底片\IMG_0030.JPG"; Dst = "$root\2026\pingyao\IMG_0030.JPG" }
    @{ Src = "$src\2026\平遥之大小姐出行！\底片\IMG_0040.JPG"; Dst = "$root\2026\pingyao\IMG_0040.JPG" }
    @{ Src = "$src\2026\平遥之大小姐出行！\底片\IMG_0048.JPG"; Dst = "$root\2026\pingyao\IMG_0048.JPG" }
    @{ Src = "$src\2026\平遥之大小姐出行！\底片\IMG_0058.JPG"; Dst = "$root\2026\pingyao\IMG_0058.JPG" }
    @{ Src = "$src\2026\平遥之大小姐出行！\底片\IMG_0078.JPG"; Dst = "$root\2026\pingyao\IMG_0078.JPG" }

    # ===== 2026/graduation (6.14 4人 8 + 604付摄四人 5 + 第一日 5 + 第二日 5 = 23 张) =====
    # 6.14 4人
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07385.JPG"; Dst = "$root\2026\graduation\DSC07385.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07388.JPG"; Dst = "$root\2026\graduation\DSC07388.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07391.JPG"; Dst = "$root\2026\graduation\DSC07391.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07420.JPG"; Dst = "$root\2026\graduation\DSC07420.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07430.JPG"; Dst = "$root\2026\graduation\DSC07430.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07440.JPG"; Dst = "$root\2026\graduation\DSC07440.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07450.JPG"; Dst = "$root\2026\graduation\DSC07450.JPG" }
    @{ Src = "$src\2026\毕业照\6.14 4人\DSC07460.JPG"; Dst = "$root\2026\graduation\DSC07460.JPG" }
    # 604付摄四人
    @{ Src = "$src\2026\毕业照\604付摄四人\IMG_2620.JPG"; Dst = "$root\2026\graduation\IMG_2620.JPG" }
    @{ Src = "$src\2026\毕业照\604付摄四人\IMG_2664.JPG"; Dst = "$root\2026\graduation\IMG_2664.JPG" }
    @{ Src = "$src\2026\毕业照\604付摄四人\IMG_2700.JPG"; Dst = "$root\2026\graduation\IMG_2700.JPG" }
    @{ Src = "$src\2026\毕业照\604付摄四人\IMG_2740.JPG"; Dst = "$root\2026\graduation\IMG_2740.JPG" }
    @{ Src = "$src\2026\毕业照\604付摄四人\IMG_2777.JPG"; Dst = "$root\2026\graduation\IMG_2777.JPG" }
    # 付摄相机第一日
    @{ Src = "$src\2026\毕业照\付摄相机第一日\IMG_2784.JPG"; Dst = "$root\2026\graduation\IMG_2784.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第一日\IMG_2821.JPG"; Dst = "$root\2026\graduation\IMG_2821.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第一日\IMG_2845.JPG"; Dst = "$root\2026\graduation\IMG_2845.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第一日\IMG_2869.JPG"; Dst = "$root\2026\graduation\IMG_2869.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第一日\IMG_2906.JPG"; Dst = "$root\2026\graduation\IMG_2906.JPG" }
    # 付摄相机第二日
    @{ Src = "$src\2026\毕业照\付摄相机第二日\IMG_2932.JPG"; Dst = "$root\2026\graduation\IMG_2932.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第二日\IMG_2940.JPG"; Dst = "$root\2026\graduation\IMG_2940.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第二日\IMG_2950.JPG"; Dst = "$root\2026\graduation\IMG_2950.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第二日\IMG_2968.JPG"; Dst = "$root\2026\graduation\IMG_2968.JPG" }
    @{ Src = "$src\2026\毕业照\付摄相机第二日\IMG_2985.JPG"; Dst = "$root\2026\graduation\IMG_2985.JPG" }
)

$copied = 0
$skipped = 0
$failed = @()

foreach ($j in $jobs) {
    if (!(Test-Path -LiteralPath $j.Src)) {
        $skipped++
        $failed += $j.Src
        continue
    }
    $dstDir = Split-Path -Parent $j.Dst
    if (!(Test-Path -LiteralPath $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }
    try {
        Copy-Item -LiteralPath $j.Src -Destination $j.Dst -Force
        $copied++
    } catch {
        $failed += $j.Src
    }
}

Write-Host ("Copied: {0} / {1}, Skipped/Failed: {2}" -f $copied, $jobs.Count, ($jobs.Count - $copied))
if ($failed.Count -gt 0) {
    Write-Host "`nFailed/Skipped files:"
    $failed | ForEach-Object { Write-Host "  - $_" }
}
