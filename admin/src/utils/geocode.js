/**
 * 逆地理编码（Task 14.2）
 *
 * 使用 Nominatim（OpenStreetMap）公共服务将 GPS 坐标反解为省/市。
 * - 模块内 Map 缓存，避免重复请求相同坐标。
 * - 失败回退为 { province: '未知', city: '未知' }，不抛错。
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'

/** 坐标缓存：key 形如 "31.2304,121.4737"（保留 4 位小数） */
const cache = new Map()

const UNKNOWN = { province: '未知', city: '未知' }

/**
 * 将坐标取整作为缓存 key（约 11 米精度，足够区分同省市不同点）
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function coordKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
}

/**
 * 把省份短名归一化为完整行政区划名（匹配 ECharts 地图名 / PROVINCE_CENTERS 键）
 * 例如 "广东" → "广东省"、"北京" → "北京市"、"广西" → "广西壮族自治区"
 * 已是完整名时原样返回；无法匹配时也原样返回。
 */
const PROVINCE_NAME_MAP = {
  北京: '北京市',
  上海: '上海市',
  天津: '天津市',
  重庆: '重庆市',
  广东: '广东省',
  江苏: '江苏省',
  浙江: '浙江省',
  四川: '四川省',
  湖北: '湖北省',
  湖南: '湖南省',
  福建: '福建省',
  山东: '山东省',
  河南: '河南省',
  河北: '河北省',
  山西: '山西省',
  陕西: '陕西省',
  辽宁: '辽宁省',
  吉林: '吉林省',
  黑龙江: '黑龙江省',
  安徽: '安徽省',
  江西: '江西省',
  海南: '海南省',
  贵州: '贵州省',
  云南: '云南省',
  甘肃: '甘肃省',
  青海: '青海省',
  台湾: '台湾省',
  内蒙古: '内蒙古自治区',
  广西: '广西壮族自治区',
  西藏: '西藏自治区',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区',
}

function normalizeProvinceName(raw) {
  if (!raw) return '未知'
  const s = String(raw).trim()
  // 已是完整名（含后缀）直接返回
  if (/(省|市|自治区|特别行政区)$/.test(s)) return s
  // 尝试短名映射
  if (PROVINCE_NAME_MAP[s]) return PROVINCE_NAME_MAP[s]
  // 兜底：尝试去掉"壮族/回族/维吾尔"等中间修饰后映射（如"广西壮族"→"广西"）
  const stripped = s.replace(/(壮族|回族|维吾尔)$/, '')
  if (PROVINCE_NAME_MAP[stripped]) return PROVINCE_NAME_MAP[stripped]
  return s
}

/**
 * 解析 Nominatim address 字段，提取省/市
 * Nominatim 在中国返回的 address 通常含 province/state/city/city_district/county 等字段
 * 省份名归一化为完整行政区划名（"广东省"、"北京市"、"广西壮族自治区"），
 * 以匹配 ECharts 中国地图 GeoJSON 的 region name 和 PROVINCE_CENTERS 键。
 * @param {object} address
 * @returns {{province:string, city:string}}
 */
function parseAddress(address) {
  if (!address) return { ...UNKNOWN }
  const province =
    address.province ||
    address.state ||
    address.state_district ||
    address.region ||
    null
  const city =
    address.city ||
    address.city_district ||
    address.county ||
    address.town ||
    address.municipality ||
    address.village ||
    null
  return {
    province: province ? normalizeProvinceName(province) : '未知',
    city: city ? String(city).replace(/(市|区|县)$/, '') || city : '未知',
  }
}

/**
 * 逆地理编码：GPS → { province, city }
 * @param {number} lat 纬度
 * @param {number} lon 经度
 * @returns {Promise<{province:string, city:string}>}
 */
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return { ...UNKNOWN }
  }
  const key = coordKey(lat, lon)
  if (cache.has(key)) return cache.get(key)

  try {
    const url =
      `${NOMINATIM_ENDPOINT}?format=json` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
      `&zoom=10&accept-language=zh`
    // Nominatim 要求 User-Agent；浏览器 fetch 无法自定义 UA（被禁止），但仍可正常调用
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      const fallback = { ...UNKNOWN }
      cache.set(key, fallback)
      return fallback
    }
    const data = await resp.json()
    const parsed = parseAddress(data?.address)
    cache.set(key, parsed)
    return parsed
  } catch {
    const fallback = { ...UNKNOWN }
    cache.set(key, fallback)
    return fallback
  }
}

/** 清空缓存（仅用于测试或手动重置） */
export function clearGeocodeCache() {
  cache.clear()
}

export default { reverseGeocode, clearGeocodeCache }
