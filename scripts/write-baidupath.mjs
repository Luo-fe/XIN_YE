/**
 * 手动上传后的 baiduPath 回填工具（方案 B 5.1 备选路径）
 *
 * 场景：网盘客户端把 f:\图片\照片 整文件夹上传到网盘根目录（保持目录结构），
 * 然后用本脚本遍历网盘目录，把 manifest 每条记录的 baiduPath 字段写回。
 *
 * 用法：
 *   node scripts/write-baidupath.mjs                # 自动：遍历网盘 PAN_ROOT → 匹配 → 写回
 *   node scripts/write-baidupath.mjs --dry-run      # 只统计不写入
 *
 * 依赖接口：xpan/file list（已确认该应用可用 errno=0）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_SRC = join(ROOT, 'blog/src/data/local-photos-manifest.json')
const MANIFEST_PUB = join(ROOT, 'blog/public/local-photos-manifest.json')
const TOKEN_FILE = join(ROOT, 'admin/.baidu-token.json')
const PAN_ROOT = process.env.PAN_ROOT || '/小昕昕❤\uFE0F小叶叶' // 与网盘客户端上传的文件夹名一致
const DRY = process.argv.includes('--dry-run')
const H = { 'User-Agent': 'pan.baidu.com' }

const tok = JSON.parse(readFileSync(TOKEN_FILE, 'utf8')).access_token

/** 递归列出网盘目录下所有文件 {path, size} */
async function walk(dir) {
  const out = []
  const url = new URL('https://pan.baidu.com/rest/2.0/xpan/file')
  url.searchParams.set('method', 'list')
  url.searchParams.set('access_token', tok)
  url.searchParams.set('dir', dir)
  url.searchParams.set('limit', 1000)
  const d = await (await fetch(url, { headers: H })).json()
  if (d.errno !== 0) throw new Error(`list ${dir} errno=${d.errno}`)
  for (const it of d.list || []) {
    const p = dir === '/' ? `/${it.server_filename}` : `${dir}/${it.server_filename}`
    if (it.isdir) out.push(...await walk(p))
    else out.push({ path: p, size: it.size, fs_id: it.fs_id })
  }
  return out
}

const manifest = JSON.parse(readFileSync(MANIFEST_SRC, 'utf8'))
console.log(`manifest ${manifest.length} 条 | 网盘根 ${PAN_ROOT}`)
const remote = await walk(PAN_ROOT)
console.log(`网盘找到 ${remote.length} 个文件（目录递归完成）`)
const remoteByPath = new Map(remote.map((f) => [f.path, f]))

// manifest 的 path 是相对路径（如 2026/平遥/xxx.jpg）→ 网盘路径 PAN_ROOT/<path>
let matched = 0
for (const entry of manifest) {
  const rp = `${PAN_ROOT}/${entry.path}`
  const rf = remoteByPath.get(rp)
  if (rf) {
    entry.baiduPath = rp
    entry.baiduFsId = rf.fs_id
    entry.baiduSize = rf.size
    matched++
  }
}
console.log(`匹配成功 ${matched}/${manifest.length}`)
if (!matched) {
  console.log('⚠️  0 匹配。请确认：')
  console.log(`  1) 客户端上传的文件夹名是否为 ${PAN_ROOT}（含 emoji ❤️）`)
  console.log('  2) 目录结构是否与本地 f:\\图片\\照片 一致（可用 --dry-run 试跑，或改用 PAN_ROOT=xxx node scripts/write-baidupath.mjs 指定）')
  process.exit(1)
}
if (DRY) { console.log('dry-run，未写入'); process.exit(0) }
writeFileSync(MANIFEST_SRC, JSON.stringify(manifest, null, 2))
if (existsSync(MANIFEST_PUB)) writeFileSync(MANIFEST_PUB, JSON.stringify(manifest, null, 2))
console.log('已写回 blog/src/data 与 blog/public 的 manifest')
