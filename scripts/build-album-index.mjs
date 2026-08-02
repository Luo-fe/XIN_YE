// build-album-index.mjs
// 读取 local-photos-manifest.json，按省/市(或直辖市按区)分组生成相册索引缓存。
// 输出 blog/src/data/photo-albums-index.json，供地图视图导航使用。
// 这是「地址和时间分析一次后缓存」的产物：省/子区域结构、照片数、时间跨度、代表坐标
// 均在构建期算好，前端直接 import，无需重复从全量照片遍历。
//
// 直辖市（北京/上海/天津/重庆）没有"市"一级，按 district（区）作为子区域；
// 普通省按 city（地级市）作为子区域。subRegionType 标明这一级是 city 还是 district。
//
// 用法： node scripts/build-album-index.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'blog/src/data/local-photos-manifest.json')
const INDEX_PATH = join(ROOT, 'blog/src/data/photo-albums-index.json')

const MUNICIPALITIES = new Set(['北京市', '上海市', '天津市', '重庆市'])

// 省会/直辖市坐标兜底（与 usePhotos.js PROVINCE_CENTERS 一致，WGS-84 [lng, lat]）
const PROVINCE_CENTERS = {
  北京市: [116.4074, 39.9042],
  上海市: [121.4737, 31.2304],
  天津市: [117.1901, 39.1252],
  重庆市: [106.5516, 29.563],
  山东省: [117.0009, 36.6758],
  山西省: [112.5489, 37.8706],
  河北省: [114.5149, 38.0428],
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  console.log(`读取 manifest：${manifest.length} 张照片`)

  // 省 → { photos, subRegions: Map<name, photos>, subRegionType }
  const provMap = new Map()
  for (const p of manifest) {
    const province = p.location?.province
    if (!province) continue
    if (!provMap.has(province)) {
      const type = MUNICIPALITIES.has(province) ? 'district' : 'city'
      provMap.set(province, { photos: [], subRegions: new Map(), subRegionType: type })
    }
    const prov = provMap.get(province)
    prov.photos.push(p)
    // 子区域：直辖市用 district，普通省用 city
    const subName = prov.subRegionType === 'district'
      ? (p.location?.district || '未知区域')
      : (p.location?.city || '未知城市')
    if (!prov.subRegions.has(subName)) prov.subRegions.set(subName, [])
    prov.subRegions.get(subName).push(p)
  }

  const provinces = [...provMap.entries()]
    .map(([province, prov]) => {
      const dateRange = computeDateRange(prov.photos)
      const coord = pickCoord(prov.photos) || PROVINCE_CENTERS[province] || null

      const subRegions = [...prov.subRegions.entries()]
        .map(([name, photos]) => ({
          name,
          count: photos.length,
          dateRange: computeDateRange(photos),
          coord: pickCoord(photos) || coord,
          districts: uniqueDistricts(photos),
        }))
        .sort((a, b) => {
          const aUnk = a.name.startsWith('未知')
          const bUnk = b.name.startsWith('未知')
          if (aUnk !== bUnk) return aUnk ? 1 : -1
          return b.count - a.count
        })

      return {
        province,
        subRegionType: prov.subRegionType, // 'city' | 'district'
        count: prov.photos.length,
        dateRange,
        coord,
        subRegions,
      }
    })
    .sort((a, b) => b.count - a.count)

  const index = {
    generatedAt: new Date().toISOString(),
    totalPhotos: manifest.length,
    locatedPhotos: manifest.filter((p) => p.location?.province).length,
    provinceCount: provinces.length,
    provinces,
  }

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf-8')

  console.log('\n========== 相册索引生成完成 ==========')
  console.log(`总照片: ${index.totalPhotos}（有定位: ${index.locatedPhotos}）`)
  console.log(`省份数: ${provinces.length}`)
  for (const prov of provinces) {
    console.log(
      `  ${prov.province}: ${prov.count} 张 · ${prov.subRegions.length} 个${prov.subRegionType === 'district' ? '区' : '市'} · ${prov.dateRange.join(' ~ ')}`,
    )
  }
  console.log(`\n索引 -> ${INDEX_PATH}`)
}

function computeDateRange(photos) {
  let min = Infinity
  let max = -Infinity
  let minDt = ''
  let maxDt = ''
  for (const p of photos) {
    const ts = p.timestamp || 0
    const dt = p.dateTime || ''
    if (ts && ts < min) { min = ts; minDt = dt }
    if (ts && ts > max) { max = ts; maxDt = dt }
  }
  if (!minDt) return ['', '']
  return [minDt, maxDt]
}

function pickCoord(photos) {
  for (const p of photos) {
    if (Array.isArray(p.gps) && p.gps.length === 2 && p.gps[0] && p.gps[1]) {
      return [p.gps[1], p.gps[0]]
    }
  }
  return null
}

function uniqueDistricts(photos) {
  const set = new Set()
  for (const p of photos) {
    const d = p.location?.district
    if (d) set.add(d)
  }
  return [...set].sort()
}

main()
