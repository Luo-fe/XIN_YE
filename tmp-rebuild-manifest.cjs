const fs = require('fs'), path = require('path')
const DATA = 'f:/图片/couple-blog/blog/src/data/local-photos-manifest.json'
const PUB = 'f:/图片/couple-blog/blog/public'
const THUMBS = path.join(PUB, 'photo-thumbs')
const newManifest = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const oldIdMap = JSON.parse(fs.readFileSync('f:/图片/couple-blog/old-id-map.json', 'utf8'))
const oldIds = new Set(Object.values(oldIdMap))
const newIds = new Set(newManifest.map(p => p.id))

// 1. 扫描磁盘缩略图文件，分类
const onDisk = [] // {year, id, abs}
function walk(d, year) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { walk(p, e.name); continue }
    if (e.name.endsWith('.webp')) onDisk.push({ year, id: e.name.slice(0, -5), abs: p })
  }
}
walk(THUMBS, null)

// 2. 删除新 id 独有 / 完全孤儿文件（旧 id 保留）
let removed = 0
for (const f of onDisk) {
  const isNewOnly = newIds.has(f.id) && !oldIds.has(f.id)
  const isUnknown = !newIds.has(f.id) && !oldIds.has(f.id)
  if (isNewOnly || isUnknown) {
    fs.unlinkSync(f.abs); removed++
  }
}
console.log('清理多余缩略图:', removed)

// 3. 重建 manifest：旧 id + 旧 year 目录（磁盘实际位置优先）
const onDiskByOldId = new Map()
for (const f of onDisk) if (oldIds.has(f.id)) onDiskByOldId.set(f.id, f)
let fixedRename = 0, stillMissing = []
const rebuilt = newManifest.map(rec => {
  const old = oldIdMap[rec.path]
  if (!old) throw new Error('映射缺失: ' + rec.path)
  // 旧 id 缩略图磁盘位置
  const diskFile = onDiskByOldId.get(old)
  let year = diskFile ? diskFile.year : (rec.thumbPath.split('/')[2] || '2026')
  let thumbPath = `/photo-thumbs/${year}/${old}.webp`
  if (!diskFile) {
    // 磁盘无旧 id 文件：用新 id 文件重命名补上（修复 p8197 等缺失）
    const newThumb = path.join(PUB, rec.thumbPath.slice(1).split('/').join(path.sep))
    if (fs.existsSync(newThumb)) {
      const dest = path.join(THUMBS, year, old + '.webp')
      if (!fs.existsSync(dest)) { fs.renameSync(newThumb, dest); fixedRename++; onDiskByOldId.set(old, { year, id: old, abs: dest }) }
    } else {
      stillMissing.push(`${old} (${rec.path}) 新旧缩略图都不存在`)
    }
  }
  return { ...rec, id: old, thumbPath }
})

// 4. 写回 src/data + public
fs.writeFileSync(DATA, JSON.stringify(rebuilt, null, 2) + '\n')
fs.writeFileSync(path.join(PUB, 'local-photos-manifest.json'), JSON.stringify(rebuilt, null, 2) + '\n')
console.log('manifest 已重建:', rebuilt.length, '条')
console.log('重命名修复缺失缩略图:', fixedRename)
console.log('仍然缺失:', stillMissing.length)
stillMissing.slice(0, 5).forEach(s => console.log('  ', s))

// 5. 最终一致性检查
const thumbs = new Set(rebuilt.map(p => p.thumbPath))
let missing = []
for (const tp of thumbs) if (!fs.existsSync(path.join(PUB, tp.slice(1)))) missing.push(tp)
console.log('重建后 manifest 引用但磁盘缺失:', missing.length)
const diskCount = fs.readdirSync(THUMBS, { recursive: true }).filter(f => f.endsWith('.webp')).length
console.log('磁盘缩略图总数:', diskCount, '（应 ≈ manifest 数 + 旧 id 无记录数）')
