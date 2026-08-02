// repair-thumbs.mjs
// 补生成缺失/损坏的缩略图：读取 manifest，凡引用的缩略图文件不存在或 webp 头损坏，
// 就从源图（f:/图片/照片/<path>）重新生成（与 analyze-photos.mjs 相同的参数）。
// 用法： node scripts/repair-thumbs.mjs
import { readFileSync, statSync, mkdirSync, openSync, readSync, closeSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PHOTOS_DIR = 'f:/图片/照片'
const MANIFEST_PATHS = [
  join(ROOT, 'blog/public/local-photos-manifest.json'),
  join(ROOT, 'blog/src/data/local-photos-manifest.json'),
]

const THUMB_WIDTH = 400

function isGoodWebp(absPath) {
  try {
    const st = statSync(absPath)
    if (st.size <= 12) return false
    const fd = openSync(absPath, 'r')
    const head = Buffer.alloc(12)
    readSync(fd, head, 0, 12, 0)
    closeSync(fd)
    return head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP'
  } catch {
    return false
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATHS[0], 'utf8'))
  let fixed = 0
  let skipped = 0
  for (const item of manifest) {
    const thumbAbs = join(ROOT, 'blog/public', item.thumbPath || '')
    if (isGoodWebp(thumbAbs)) {
      skipped++
      continue
    }
    const srcAbs = join(PHOTOS_DIR, item.path || '')
    if (!existsSync(srcAbs)) {
      console.warn(`  源图不存在，跳过 ${item.id}: ${item.path}`)
      continue
    }
    try {
      mkdirSync(dirname(thumbAbs), { recursive: true })
      // failOn:'none'：源图截断（如传输中断的 JPEG）也能解码出可用部分，避免预览图永远空白
      await sharp(srcAbs, { failOn: 'none' })
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlarging: true })
        .webp({ quality: 78 })
        .toFile(thumbAbs)
      console.log(`  已生成 ${item.id} -> ${item.thumbPath}`)
      fixed++
    } catch (e) {
      console.warn(`  生成失败 ${item.id} (${item.path}): ${e.message}`)
    }
  }
  console.log(`\n完成：完好 ${skipped} 个，重新生成 ${fixed} 个`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
