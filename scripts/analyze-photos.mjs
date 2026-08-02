// analyze-photos.mjs
// 扫描 f:\图片\照片 本地照片源目录，读取 EXIF（拍摄时间/GPS/相机/尺寸），
// 用 sharp 生成缩略图（400px 宽 webp），输出 manifest 到 blog/src/data/local-photos-manifest.json
//
// 分类规则：
//   - 有拍摄时间（EXIF DateTimeOriginal 或文件名可解析）→ hasCaptureTime=true → 流年四季
//   - 仅有文件修改时间 → hasCaptureTime=false → 往昔回忆
//
// 排序：按 timestamp 升序（最早→最新）；无拍摄时间的放到末尾。
// GPS 反查省份：用 DataV 中国省份 GeoJSON 多边形 + ray-casting 精确判断（需联网首次下载，本地缓存）。
//
// 用法： node scripts/analyze-photos.mjs
// 幂等：已存在且源未变的缩略图会跳过生成，加快重跑速度。

import {
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs'
import { join, relative, sep, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import ExifReader from 'exifreader'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const PHOTOS_DIR = 'f:/图片/照片'
const THUMB_DIR = join(ROOT, 'blog/public/photo-thumbs')
const MANIFEST_PATH = join(ROOT, 'blog/src/data/local-photos-manifest.json')

// DataV 中国省份 GeoJSON 缓存路径（首次运行下载，后续从本地读取）
const GEOJSON_CACHE = join(__dirname, '.cache/china-provinces.geo.json')
const GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
const THUMB_WIDTH = 400
const CONCURRENCY = 8

// 稳定 id 分配（见 main()）：path→id 复用映射 + 新 id 计数器
const EXISTING_ID_BY_PATH = new Map()
let NEXT_ID = 1

const pad2 = (n) => String(n).padStart(2, '0')

// ---------- 中国省份 GeoJSON（DataV，精确多边形）----------
let provinceFeatures = null

async function loadProvinceGeoJSON() {
  if (provinceFeatures) return provinceFeatures
  // 先用本地缓存
  if (existsSync(GEOJSON_CACHE)) {
    try {
      provinceFeatures = JSON.parse(readFileSync(GEOJSON_CACHE, 'utf-8'))
      console.log(`省份 GeoJSON 已从缓存加载（${provinceFeatures.length} 个省级行政区）`)
      return provinceFeatures
    } catch {
      /* 损坏则重新下载 */
    }
  }
  console.log('下载 DataV 中国省份 GeoJSON...')
  const resp = await fetch(GEOJSON_URL)
  if (!resp.ok) throw new Error(`GeoJSON 下载失败: HTTP ${resp.status}`)
  const data = await resp.json()
  provinceFeatures = Array.isArray(data.features) ? data.features : []
  mkdirSync(dirname(GEOJSON_CACHE), { recursive: true })
  writeFileSync(GEOJSON_CACHE, JSON.stringify(provinceFeatures))
  console.log(`已缓存 ${provinceFeatures.length} 个省级行政区边界 -> ${GEOJSON_CACHE}`)
  return provinceFeatures
}

// ray-casting：点是否在单环多边形内
function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Polygon: coordinates = [outerRing, hole1, hole2, ...]
function pointInPolygon(point, coords) {
  if (!Array.isArray(coords) || coords.length === 0) return false
  // 外环必在内、内环（洞）必在外
  if (!pointInRing(point, coords[0])) return false
  for (let i = 1; i < coords.length; i++) {
    if (pointInRing(point, coords[i])) return false
  }
  return true
}

// MultiPolygon: coordinates = [polygon1, polygon2, ...]，每个 polygon = [outerRing, hole1, ...]
function pointInMultiPolygon(point, coords) {
  if (!Array.isArray(coords)) return false
  for (const polygon of coords) {
    if (pointInPolygon(point, polygon)) return true
  }
  return false
}

async function provinceFromGps(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  const features = await loadProvinceGeoJSON()
  // GeoJSON 坐标顺序为 [lng, lat]
  const point = [lng, lat]
  for (const feature of features) {
    const name = feature.properties?.name || ''
    if (!name) continue
    const geom = feature.geometry
    if (!geom || !geom.coordinates) continue
    let inside = false
    if (geom.type === 'Polygon') {
      inside = pointInPolygon(point, geom.coordinates)
    } else if (geom.type === 'MultiPolygon') {
      inside = pointInMultiPolygon(point, geom.coordinates)
    }
    if (inside) return name
  }
  return '' // 海外或未匹配
}

// ---------- 市/区 GeoJSON（DataV，按需下载所需省份的点在面内）----------
const CITY_GEOJSON_CACHE = join(__dirname, '.cache/city-districts.geo.json')
const MUNICIPALITIES = new Set(['北京市', '上海市', '天津市', '重庆市'])
let cityDistrictFeatures = null

async function fetchDatavFeatures(adcode) {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()
  return data.features || []
}

async function loadCityDistrictFeatures(neededProvinces) {
  if (cityDistrictFeatures) return cityDistrictFeatures
  if (existsSync(CITY_GEOJSON_CACHE)) {
    try {
      cityDistrictFeatures = JSON.parse(readFileSync(CITY_GEOJSON_CACHE, 'utf-8'))
      const cachedProvs = new Set(cityDistrictFeatures.map((fd) => fd.provinceName))
      const missing = [...neededProvinces].filter((p) => !cachedProvs.has(p))
      if (missing.length === 0) {
        console.log(`市/区 GeoJSON 已从缓存加载（${cityDistrictFeatures.length} 个要素）`)
        return cityDistrictFeatures
      }
      neededProvinces = new Set(missing)
    } catch {
      /* 损坏则重新下载 */
    }
  }
  if (!cityDistrictFeatures) cityDistrictFeatures = []
  // 省名→adcode（来自已加载的省份 GeoJSON）
  const provinces = await loadProvinceGeoJSON()
  const provAdcodeMap = {}
  for (const ft of provinces) {
    const name = ft.properties?.name
    const adcode = ft.properties?.adcode
    if (name && adcode) provAdcodeMap[name] = String(adcode)
  }
  console.log(`下载市/区 GeoJSON（${[...neededProvinces].join('、')}）...`)
  for (const provName of neededProvinces) {
    const adcode = provAdcodeMap[provName]
    if (!adcode) continue
    const isMuni = MUNICIPALITIES.has(provName)
    // level 1：直辖市→区，普通省→地级市
    const l1 = await fetchDatavFeatures(adcode)
    for (const ft of l1) {
      cityDistrictFeatures.push({
        name: ft.properties?.name,
        level: ft.properties?.level,
        adcode: String(ft.properties?.adcode || ''),
        provinceName: provName,
        cityName: isMuni ? '' : ft.properties?.name,
        geometry: ft.geometry,
      })
    }
    if (isMuni) continue
    // level 2：普通省每个地级市→区/县
    for (const city of l1) {
      const cityAdcode = String(city.properties?.adcode || '')
      const cityName = city.properties?.name
      const l2 = await fetchDatavFeatures(cityAdcode)
      for (const ft of l2) {
        cityDistrictFeatures.push({
          name: ft.properties?.name,
          level: ft.properties?.level,
          adcode: String(ft.properties?.adcode || ''),
          provinceName: provName,
          cityName,
          geometry: ft.geometry,
        })
      }
    }
  }
  mkdirSync(dirname(CITY_GEOJSON_CACHE), { recursive: true })
  writeFileSync(CITY_GEOJSON_CACHE, JSON.stringify(cityDistrictFeatures))
  console.log(`已缓存 ${cityDistrictFeatures.length} 个市/区要素 -> ${CITY_GEOJSON_CACHE}`)
  return cityDistrictFeatures
}

// GPS → { city, district }（直辖市 city 为空，district 为终值）
function localityFromGps(lat, lng, provinceName) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !provinceName) return { city: '', district: '' }
  const point = [lng, lat]
  const isMuni = MUNICIPALITIES.has(provinceName)
  let cityHit = ''
  let districtHit = ''
  for (const fd of cityDistrictFeatures || []) {
    if (fd.provinceName !== provinceName) continue
    const geom = fd.geometry
    if (!geom || !geom.coordinates) continue
    let inside = false
    if (geom.type === 'Polygon') inside = pointInPolygon(point, geom.coordinates)
    else if (geom.type === 'MultiPolygon') inside = pointInMultiPolygon(point, geom.coordinates)
    if (!inside) continue
    if (fd.level === 'district') {
      districtHit = fd.name
      if (isMuni) return { city: '', district: districtHit }
    } else if (fd.level === 'city' || fd.level === 'prefecture') {
      cityHit = fd.name
    }
  }
  return { city: cityHit, district: districtHit }
}

// ---------- 文件名时间解析 ----------
// 年份合理性区间（用于过滤 EXIF/文件名解析出的荒谬年份如 2187、2206、1986）
const MIN_YEAR = 1990
const MAX_YEAR = new Date().getFullYear() + 1

function validYear(dtStr) {
  if (!dtStr) return false
  const y = Number(dtStr.slice(0, 4))
  return Number.isFinite(y) && y >= MIN_YEAR && y <= MAX_YEAR
}

function parseDateTimeFromName(filename) {
  // IMG_YYYYMMDD_HHMMSS.jpg
  let m = filename.match(/^IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\./i)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // beauty_YYYYMMDDHHMMSS.jpg / wx_YYYYMMDDHHMMSS.jpg
  m = filename.match(/(?:beauty|wx)_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\./i)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // YYYYMMDDHHmmssmmm.jpg（17 位纯数字，微信导出格式：年月日时分秒+毫秒）
  m = filename.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\d{3}\./)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // YYYYMMDDHHMMSS.jpg（14 位纯数字）
  m = filename.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\./)
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  // 纯 YYYYMMDD.jpg（8 位）
  m = filename.match(/^(\d{4})(\d{2})(\d{2})\./)
  if (m) return `${m[1]}-${m[2]}-${m[3]} 00:00:00`
  // mmexport{13位毫秒}.jpg 或 纯13位毫秒.jpg
  // 注意：必须用词边界 (?<!\d) 和 (?=\.) 避免从 15/17 位数字串中截取 13 位
  // （否则 "336852771246154" 会被截成 13 位产生 2187 年这种荒谬结果）
  m = filename.match(/(?<!\d)(\d{13})\./)
  if (m) {
    const d = new Date(Number(m[1]))
    if (!Number.isNaN(d.getTime())) {
      const dt = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
      if (validYear(dt)) return dt
    }
  }
  return null
}

/**
 * 把 EXIF/字符串时间归一化为 'YYYY-MM-DD HH:mm:ss'（24 小时制）
 * 处理：
 *   - EXIF 格式 "2024:01:02 03:04:05" → "2024-01-02 03:04:05"
 *   - 非法小时 "2025-06-22 24:16:09" → 进位到次日 "2025-06-23 00:16:09"
 * 返回 null 表示无法解析
 */
function normalizeDateTime(raw) {
  if (!raw) return null
  const norm = String(raw).trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  const m = norm.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    let [, y, mo, d, h, mi, s] = m
    let year = Number(y)
    let month = Number(mo)
    let day = Number(d)
    let hour = Number(h)
    const min = Number(mi)
    const sec = Number(s)
    if (hour >= 24) {
      // 进位到次日（处理 beauty_20250622001704.jpg 的 EXIF "24:16:09" 异常）
      const overflowDays = Math.floor(hour / 24)
      hour = hour % 24
      const dt = new Date(Date.UTC(year, month - 1, day, hour, min, sec))
      dt.setUTCDate(dt.getUTCDate() + overflowDays)
      return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:${pad2(dt.getUTCSeconds())}`
    }
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`
  }
  // 尝试整体 Date 解析
  const d = new Date(norm.replace(' ', 'T'))
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  }
  return null
}

function dateTimeToTimestamp(dt) {
  if (!dt) return 0
  const d = new Date(dt.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000)
}

// ---------- 递归扫描 ----------
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'Thumbs.db' || name === '.DS_Store' || name.startsWith('.')) continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) out.push(...walk(p))
    else if (IMAGE_RE.test(name)) out.push(p)
  }
  return out
}

// ---------- EXIF 读取 ----------
async function readExif(absPath) {
  const out = { dateTime: null, gps: null, camera: null }
  try {
    const tags = await ExifReader.load(absPath, { expanded: true })
    // 拍摄时间
    const dtTag =
      tags.exif?.DateTimeOriginal ||
      tags.exif?.CreateDate ||
      tags.DateTimeOriginal ||
      tags.CreateDate ||
      tags.Image?.DateTime
    if (dtTag) {
      const raw = String(dtTag.value || dtTag.description || '').trim()
      const norm = normalizeDateTime(raw)
      if (norm) out.dateTime = norm
    }
    // GPS
    const lat = tags.gps?.Latitude || tags.GPSLatitude
    const lng = tags.gps?.Longitude || tags.GPSLongitude
    if (lat && lng) {
      const latV = typeof lat === 'object' ? lat.value ?? lat.description : lat
      const lngV = typeof lng === 'object' ? lng.value ?? lng.description : lng
      const la = Number(latV)
      const ln = Number(lngV)
      if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) {
        out.gps = [la, ln]
      }
    }
    // 相机
    const make = tags.image?.Make?.description || tags.Make?.description
    const model = tags.image?.Model?.description || tags.Model?.description
    if (make || model) {
      out.camera = { make: make || '', model: model || '' }
    }
  } catch {
    /* 静默忽略：不支持格式/损坏文件/无 EXIF */
  }
  return out
}

/**
 * 综合解析拍摄时间，处理三类 bug：
 *  - EXIF 时间非法（如 "24:16:09"）→ 已在 normalizeDateTime 中进位修正
 *  - EXIF 年份不合理（< 1990 或 > 当前年+1，如 2206/2187 等 EXIF 损坏）→ 回退文件名
 *  - EXIF 年份与文件名年份差异巨大（>2 年，疑似出厂默认时间）→ 回退文件名
 *  - EXIF 完全无效 → 回退文件名
 * 返回 'YYYY-MM-DD HH:mm:ss' 或 null
 */
function resolveCaptureDateTime(exifDateTime, filename) {
  const nameDt = parseDateTimeFromName(filename)
  // 文件名解析出的年份不合理 → 视为无效
  const safeNameDt = validYear(nameDt) ? nameDt : null
  if (!exifDateTime) return safeNameDt
  const exifTs = dateTimeToTimestamp(exifDateTime)
  // EXIF 完全无法解析 → 回退文件名（如未修正的非法时间或空字符串）
  if (exifTs === 0) return safeNameDt || exifDateTime
  // EXIF 年份合理性检查：< 1990 或 > 当前年+1 视为损坏（如 2206、2187）
  const exifYear = Number(exifDateTime.slice(0, 4))
  if (!Number.isFinite(exifYear) || exifYear < MIN_YEAR || exifYear > MAX_YEAR) {
    return safeNameDt
  }
  // EXIF 与文件名年份差异巨大 → 视为 EXIF 异常，回退文件名
  if (safeNameDt) {
    const nameYear = Number(safeNameDt.slice(0, 4))
    if (
      Number.isFinite(nameYear) &&
      Math.abs(exifYear - nameYear) > 2
    ) {
      return safeNameDt
    }
  }
  return exifDateTime
}

// ---------- 处理单个文件 ----------
async function processOne(absPath, idx, total) {
  const rel = relative(PHOTOS_DIR, absPath).split(sep).join('/')
  const filename = basename(absPath)
  const st = statSync(absPath)
  const mtime = st.mtimeMs

  // EXIF + 尺寸（sharp.metadata 很快，不解码像素）
  const exif = await readExif(absPath)
  let width = null
  let height = null
  try {
    const meta = await sharp(absPath).metadata()
    width = meta.width || null
    height = meta.height || null
  } catch {
    /* sharp 读不了的格式跳过尺寸 */
  }

  // 拍摄时间：综合 EXIF + 文件名（含异常回退逻辑）
  const captureDt = resolveCaptureDateTime(exif.dateTime, filename)
  const hasCaptureTime = Boolean(captureDt)
  // fallback 到 mtime
  const md = new Date(mtime)
  const mtimeDt = `${md.getFullYear()}-${pad2(md.getMonth() + 1)}-${pad2(md.getDate())} ${pad2(md.getHours())}:${pad2(md.getMinutes())}:${pad2(md.getSeconds())}`
  const dateTime = captureDt || mtimeDt
  const timestamp = dateTimeToTimestamp(dateTime)

  // 省份（仅 GPS 有效时，用 GeoJSON 多边形精确判断）
  const province = exif.gps ? await provinceFromGps(exif.gps[0], exif.gps[1]) : ''

  // 缩略图路径：按年份分目录，文件名用稳定 id（p001...）
  // id 稳定性：优先复用已有 manifest 中同路径记录的 id（网页端删除/日记封面/本地编辑补丁
  // 都引用 id；若按排序位置重编号，删除任意照片会让后续所有 id 位移，全部引用失效）。
  // 新文件才按 max+1 递增分配，保证历史 id 永不变化。
  const year = dateTime ? dateTime.slice(0, 4) : 'unknown'
  let id = EXISTING_ID_BY_PATH.get(rel)
  if (!id) id = `p${String(NEXT_ID++).padStart(4, '0')}`
  const thumbRel = `${year}/${id}.webp`
  const thumbAbs = join(THUMB_DIR, thumbRel)
  const thumbPath = `/photo-thumbs/${thumbRel}`

  // 幂等：缩略图已存在且内容完好则跳过生成。
  // 仅按 size>0 判断不可靠（进程中断会留下截断文件，被当作"已生成"跳过，
  // 前端加载这类损坏 webp 表现为"预览图加载不完整"）——这里额外校验 webp 魔数
  let thumbExisted = false
  try {
    const ts = statSync(thumbAbs)
    if (ts.size > 12) {
      const fd = openSync(thumbAbs, 'r')
      const head = Buffer.alloc(12)
      readSync(fd, head, 0, 12, 0)
      closeSync(fd)
      thumbExisted =
        head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP'
    }
  } catch {
    /* 不存在或读取失败 → 重新生成 */
  }
  if (!thumbExisted) {
    try {
      mkdirSync(dirname(thumbAbs), { recursive: true })
      // failOn:'none'：源图截断（传输中断等）也能解码出可用部分，避免预览图永远空白
      await sharp(absPath, { failOn: 'none' })
        .rotate() // 按 EXIF Orientation 自动旋转
        .resize({ width: THUMB_WIDTH, withoutEnlarging: true })
        .webp({ quality: 78 })
        .toFile(thumbAbs)
    } catch (e) {
      console.warn(`  [thumb fail] ${rel}: ${e.message}`)
    }
  }

  if (idx % 200 === 0 || idx === total) {
    console.log(`  [${idx}/${total}] ${rel}`)
  }

  return {
    id,
    path: rel,
    thumbPath,
    filename,
    dateTime,
    timestamp,
    gps: exif.gps,
    location: { province, city: '', district: '' },
    camera: exif.camera || {},
    dimensions: { width, height },
    hasCaptureTime,
    mtime: Math.floor(mtime / 1000),
  }
}

// ---------- 主流程 ----------
async function main() {
  // 预热省份 GeoJSON（确保并发 worker 不会同时触发下载）
  await loadProvinceGeoJSON()

  // 加载已有 manifest 建立 path→id 映射：同路径照片复用原 id，新照片从 max+1 继续分配
  if (existsSync(MANIFEST_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
      if (Array.isArray(existing)) {
        for (const rec of existing) {
          if (rec.path && rec.id) EXISTING_ID_BY_PATH.set(rec.path, rec.id)
        }
        const maxNum = existing.reduce((mx, rec) => {
          const n = rec.id ? parseInt(rec.id.slice(1), 10) : 0
          return Number.isFinite(n) && n > mx ? n : mx
        }, 0)
        NEXT_ID = maxNum + 1
        console.log(`复用已有 manifest 的 id 映射（${EXISTING_ID_BY_PATH.size} 条，新 id 从 p${String(NEXT_ID).padStart(4, '0')} 起）`)
      }
    } catch {
      /* manifest 损坏则忽略，按全新编号 */
    }
  }

  console.log(`扫描源目录: ${PHOTOS_DIR}`)
  const files = walk(PHOTOS_DIR)
  // 按相对路径排序，保证 id 稳定（重跑结果一致）
  files.sort((a, b) => relative(PHOTOS_DIR, a).localeCompare(relative(PHOTOS_DIR, b), 'zh'))
  console.log(`发现 ${files.length} 张图片，开始处理（并发 ${CONCURRENCY}）...`)

  mkdirSync(THUMB_DIR, { recursive: true })

  const results = new Array(files.length)
  let cursor = 0
  let done = 0

  async function worker() {
    while (cursor < files.length) {
      const i = cursor++
      try {
        results[i] = await processOne(files[i], i + 1, files.length)
      } catch (e) {
        console.warn(`  [skip] ${files[i]}: ${e.message}`)
        results[i] = null
      }
      done++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const manifest = results.filter(Boolean)

  // 排序：有拍摄时间的按 timestamp 升序（最早→最新）；无拍摄时间的放最后
  manifest.sort((a, b) => {
    if (a.hasCaptureTime !== b.hasCaptureTime) return a.hasCaptureTime ? -1 : 1
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.path < b.path ? -1 : 1
  })

  // ---- 市/区反查（DataV GeoJSON 点在面内，仅 GPS+省份有效）----
  const gpsEntries = manifest.filter((m) => m.gps && m.location.province)
  if (gpsEntries.length > 0) {
    const neededProvs = new Set(gpsEntries.map((m) => m.location.province))
    await loadCityDistrictFeatures(neededProvs)
    const coordMap = new Map()
    for (const m of gpsEntries) {
      const key = `${m.gps[0].toFixed(3)},${m.gps[1].toFixed(3)}`
      if (!coordMap.has(key)) coordMap.set(key, [])
      coordMap.get(key).push(m)
    }
    console.log(`\n市/区反查：${coordMap.size} 个唯一坐标...`)
    for (const [, entries] of coordMap) {
      const { city, district } = localityFromGps(entries[0].gps[0], entries[0].gps[1], entries[0].location.province)
      for (const e of entries) {
        e.location.city = city || ''
        e.location.district = district || ''
      }
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  // 统计
  const withCapture = manifest.filter((m) => m.hasCaptureTime).length
  const withGps = manifest.filter((m) => m.gps).length
  const withProvince = manifest.filter((m) => m.location.province).length
  const byYear = {}
  for (const m of manifest) {
    const y = m.dateTime ? m.dateTime.slice(0, 4) : 'unknown'
    byYear[y] = (byYear[y] || 0) + 1
  }
  console.log('\n========== 分析完成 ==========')
  console.log(`总照片: ${manifest.length}`)
  console.log(`有拍摄时间(流年四季): ${withCapture}`)
  console.log(`仅有修改时间(往昔回忆): ${manifest.length - withCapture}`)
  const withCity = manifest.filter((m) => m.location.city).length
  const withDistrict = manifest.filter((m) => m.location.district).length
  console.log(`有 GPS: ${withGps}（其中可识别省份: ${withProvince}）`)
  console.log(`有市/区: ${withCity}市 / ${withDistrict}区`)
  console.log('按年份分布:')
  for (const y of Object.keys(byYear).sort()) {
    console.log(`  ${y}: ${byYear[y]}`)
  }
  console.log(`\nManifest -> ${MANIFEST_PATH}`)
  console.log(`缩略图   -> ${THUMB_DIR}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
