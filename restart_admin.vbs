Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c taskkill /f /im node.exe > nul 2>&1", 0, True
WshShell.CurrentDirectory = "f:\图片\couple-blog\admin"
WshShell.Run "cmd /c start ""Admin Server"" npm run dev", 0, False