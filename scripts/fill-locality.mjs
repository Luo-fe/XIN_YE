/**
 * 一次性脚本：为已有 manifest 的 GPS 照片补全市/区（DataV GeoJSON 点在面内）
 * 用法：node scripts/fill-locality.mjs
 * 比 analyze-photos.mjs 全量重跑快得多（不重读 EXIF、不重生缩略图）。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'blog/src/data/local-photos-manifest.json')
const PROVINCE_GEOJSON_CACHE = join(__dirname, '.cache/china-provinces.geo.json')
const CITY_GEOJSON_CACHE = join(__dirname, '.cache/city-districts.geo.json')
const DATAV_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound'

const MUNICIPALITIES = new Set(['北京市', '上海市', '天津市', '重庆市'])

// ---- point-in-polygon（与 analyze-photos.mjs 一致）----
function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function pointInPolygon(point, coords) {
  if (!Array.isArray(coords) || coords.length === 0) return false
  if (!pointInRing(point, coords[0])) return false
  for (let i = 1; i < coords.length; i++) if (pointInRing(point, coords[i])) return false
  return true
}
function pointInMultiPolygon(point, coords) {
  if (!Array.isArray(coords)) return false
  for (const polygon of coords) if (pointInPolygon(point, polygon)) return true
  return false
}
function geomContains(point, geom) {
  if (!geom || !geom.coordinates) return false
  if (geom.type === 'Polygon') return pointInPolygon(point, geom.coordinates)
  if (geom.type === 'MultiPolygon') return pointInMultiPolygon(point, geom.coordinates)
  return false
}

// ---- 加载省份 GeoJSON，建 省名→adcode 映射 ----
function buildProvinceAdcodeMap() {
  const feats = JSON.parse(readFileSync(PROVINCE_GEOJSON_CACHE, 'utf-8'))
  const map = {}
  for (const f of feats) {
    const name = f.properties?.name
    const adcode = f.properties?.adcode
    if (name && adcode) map[name] = String(adcode)
  }
  return map
}

async function fetchDatavFeatures(adcode) {
  const url = `${DATAV_BASE}/${adcode}_full.json`
  const resp = await fetch(url)
  if (!resp.ok) {
    console.warn(`  [datav] ${adcode} HTTP ${resp.status}`)
    return []
  }
  const data = await resp.json()
  return data.features || []
}

// ---- 加载/下载市/区 GeoJSON ----
async function loadCityDistrictFeatures(neededProvinces, provAdcodeMap) {
  // 本地缓存
  if (existsSync(CITY_GEOJSON_CACHE)) {
    const cached = JSON.parse(readFileSync(CITY_GEOJSON_CACHE, 'utf-8'))
    const cachedProvs = new Set(cached.map((f) => f.provinceName))
    const missing = [...neededProvinces].filter((p) => !cachedProvs.has(p))
    if (missing.length === 0) {
      console.log(`市/区 GeoJSON 已从缓存加载（${cached.length} 个要素）`)
      return cached
    }
    neededProvinces = new Set(missing)
    // 合并：在 cached 基础上追加 missing
    var base = cached
  }

  const features = base || []
  console.log(`下载市/区 GeoJSON（${[...neededProvinces].join('、')}）...`)
  for (const provName of neededProvinces) {
    const adcode = provAdcodeMap[provName]
    if (!adcode) {
      console.warn(`  跳过 ${provName}：无 adcode`)
      continue
    }
    const isMuni = MUNICIPALITIES.has(provName)
    // level 1：直辖市→区，普通省→地级市
    const l1 = await fetchDatavFeatures(adcode)
    for (const f of l1) {
      features.push({
        name: f.properties?.name,
        level: f.properties?.level,
        adcode: String(f.properties?.adcode || ''),
        provinceName: provName,
        cityName: isMuni ? '' : f.properties?.name,
        geometry: f.geometry,
      })
    }
    if (isMuni) continue
    // level 2：普通省每个地级市→区
    for (const city of l1) {
      const cityAdcode = String(city.properties?.adcode || '')
      const cityName = city.properties?.name
      const l2 = await fetchDatavFeatures(cityAdcode)
      for (const f of l2) {
        features.push({
          name: f.properties?.name,
          level: f.properties?.level,
          adcode: String(f.properties?.adcode || ''),
          provinceName: provName,
          cityName,
          geometry: f.geometry,
        })
      }
    }
  }
  mkdirSync(dirname(CITY_GEOJSON_CACHE), { recursive: true })
  writeFileSync(CITY_GEOJSON_CACHE, JSON.stringify(features))
  console.log(`已缓存 ${features.length} 个市/区要素 -> ${CITY_GEOJSON_CACHE}`)
  return features
}

// GPS → { city, district }
function localityFromGps(lat, lng, provinceName, features) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { city: '', district: '' }
  const point = [lng, lat]
  const isMuni = MUNICIPALITIES.has(provinceName)
  let cityHit = ''
  let districtHit = ''
  for (const f of features) {
    if (f.provinceName !== provinceName) continue
    if (!geomContains(point, f.geometry)) continue
    // 命中
    if (f.level === 'district') {
      districtHit = f.name
      if (isMuni) return { city: '', district: districtHit } // 直辖市区即终值
    } else if (f.level === 'city' || f.level === 'prefecture') {
      cityHit = f.name
    }
  }
  return { city: cityHit, district: districtHit }
}

// ---- 主流程 ----
console.log('读取 manifest...')
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
console.log(`共 ${manifest.length} 张照片`)

const gpsEntries = manifest.filter((m) => m.gps && m.location?.province)
console.log(`有 GPS+省份：${gpsEntries.length}`)

if (gpsEntries.length === 0) {
  console.log('无 GPS 照片，退出')
  process.exit(0)
}

const provAdcodeMap = buildProvinceAdcodeMap()
const neededProvinces = new Set(gpsEntries.map((m) => m.location.province))
console.log(`涉及省份：${[...neededProvinces].join('、')}`)

const features = await loadCityDistrictFeatures(neededProvinces, provAdcodeMap)

// 唯一坐标（3 位小数 ~100m）
const coordMap = new Map()
for (const m of gpsEntries) {
  const key = `${m.gps[0].toFixed(3)},${m.gps[1].toFixed(3)}`
  if (!coordMap.has(key)) coordMap.set(key, { lat: m.gps[0], lng: m.gps[1], province: m.location.province, entries: [] })
  coordMap.get(key).entries.push(m)
}
console.log(`唯一坐标：${coordMap.size} 个`)

let withCity = 0,
  withDistrict = 0
for (const [, info] of coordMap) {
  const { city, district } = localityFromGps(info.lat, info.lng, info.province, features)
  for (const e of info.entries) {
    e.location.city = city || ''
    e.location.district = district || ''
    // 直辖市：city 留空，前端显示 province · district
  }
  if (city) withCity++
  if (district) withDistrict++
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(`\n========== 补全完成 ==========`)
console.log(`坐标有市：${withCity}/${coordMap.size}`)
console.log(`坐标有区：${withDistrict}/${coordMap.size}`)
console.log(`Manifest -> ${MANIFEST_PATH}`)
