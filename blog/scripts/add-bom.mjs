// add-bom.mjs — 给 .ps1 文件加 UTF-8 BOM，让 Windows PowerShell 5.x 正确按 UTF-8 解析中文路径。
import { readFileSync, writeFileSync } from 'node:fs'

const targets = [
  'f:/图片/couple-blog/blog/scripts/copy-photos.ps1',
]

for (const p of targets) {
  const c = readFileSync(p, 'utf8')
  if (c.charCodeAt(0) === 0xfeff) {
    console.log(`already has BOM: ${p}`)
    continue
  }
  writeFileSync(p, '\ufeff' + c, 'utf8')
  console.log(`BOM added: ${p}`)
}
