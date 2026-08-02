// gen-manifest.mjs
// 扫描 public/photos/ 目录，按文件名与所在事件目录推断元数据，生成 photos-manifest.json。
// 仅依赖文件系统与文件名规则，不读 EXIF、不读图片尺寸。

import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const PHOTOS_DIR = 'f:/图片/couple-blog/blog/public/photos'
const MANIFEST_PATH = 'f:/图片/couple-blog/blog/src/data/photos-manifest.json'

// 事件配置：key 为 "<year>/<event>"。fallbackDateTime 为 null 表示必须从文件名解析。
// 位置字段遵循「不瞎编」原则：只有明确可知的才填（如平遥→山西省晋中市；山东之旅→山东省）。
const EVENT_CONFIG = {
  '2023/early': {
    fallbackDateTime: null,
    location: { province: '', city: '' },
  },
  '2024/9-4-afternoon': {
    fallbackDateTime: '2024-09-04 14:00:00',
    location: { province: '', city: '' },
  },
  '2024/misc': {
    fallbackDateTime: null,
    location: { province: '', city: '' },
  },
  '2025/shandong': {
    fallbackDateTime: '2025-07-15 12:00:00',
    location: { province: '山东省', city: '' },
  },
  '2026/jiumu': {
    fallbackDateTime: null,
    location: { province: '', city: '' },
  },
  '2026/pingyao': {
    fallbackDateTime: '2026-05-27 12:00:00',
    location: { province: '山西省', city: '晋中市' },
  },
  '2026/graduation': {
    fallbackDateTime: '2026-06-14 12:00:00',
    location: { province: '', city: '' },
  },
}

const pad2 = (n) => String(n).padStart(2, '0')

// 从文件名推断 dateTime；无法推断时返回 fallback（可能为 null）
function parseDateTime(filename, fallback) {
  // IMG_YYYYMMDD_HHMMSS.jpg
  let m = filename.match(/^IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\./i)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // beauty_YYYYMMDDHHMMSS.jpg
  m = filename.match(/^beauty_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\./i)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // mmexport{13 位毫秒}.jpg 或 纯 13 位毫秒.jpg
  m = filename.match(/(\d{13})\./)
  if (m) {
    const d = new Date(Number(m[1]))
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  }
  return fallback
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const files = walk(PHOTOS_DIR)

const entries = files.map((absPath) => {
  const rel = relative(PHOTOS_DIR, absPath).split(sep).join('/')
  const parts = rel.split('/')
  const eventKey = `${parts[0]}/${parts[1]}`
  const cfg = EVENT_CONFIG[eventKey] || {
    fallbackDateTime: null,
    location: { province: '', city: '' },
  }
  const filename = parts[parts.length - 1]
  const dateTime = parseDateTime(filename, cfg.fallbackDateTime)
  const ts = dateTime ? Math.floor(new Date(dateTime.replace(' ', 'T')).getTime() / 1000) : 0
  return {
    thumbPath: `/photos/${rel}`,
    baiduPath: '',
    shareLink: '',
    dateTime,
    timestamp: ts,
    gps: null,
    location: { ...cfg.location },
    camera: {},
    dimensions: {},
    _eventKey: eventKey,
  }
})

// 按 dateTime 升序（旧→新），同一时刻按路径稳定排序
entries.sort((a, b) => {
  const da = a.dateTime || ''
  const db = b.dateTime || ''
  if (da !== db) return da < db ? -1 : 1
  return a.thumbPath < b.thumbPath ? -1 : 1
})

// 顺序编号 p001..pNNN
const manifest = entries.map((e, i) => {
  const { _eventKey, ...rest } = e
  return { id: `p${String(i + 1).padStart(3, '0')}`, ...rest }
})

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

console.log(`Generated ${manifest.length} entries -> ${MANIFEST_PATH}`)
const summary = {}
for (const e of entries) {
  summary[e._eventKey] = (summary[e._eventKey] || 0) + 1
}
console.log('Distribution by event:')
for (const k of Object.keys(summary).sort()) {
  console.log(`  ${k}: ${summary[k]}`)
}
