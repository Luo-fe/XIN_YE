import { useEffect, useState, useMemo, useCallback } from 'react'
import { fetchLocalPhotosManifest } from './usePhotos'
import { assetUrl } from '../utils/assetUrl'

/**
 * 把 manifest 项的 path 转成 dev 下可访问的原图 URL
 * manifest 项含 { path: "2024/05/20/xxx.jpg", thumbPath: "/photo-thumbs/xxx.jpg" }
 * dev 下原图由 vite 中间件 /local-photo/<path> 服务
 */
function toOriginalUrl(photo) {
  const p = photo?.path || ''
  if (!p) return assetUrl(photo?.url || '')
  // 已经是 URL 形式直接返回
  if (/^https?:\/\//.test(p)) return p
  return assetUrl(`/local-photo/${encodeURI(p.replace(/^[/\\]+/, ''))}`)
}

/**
 * 规范化封面 URL：确保以根路径开头。
 * admin 存储的上传封面是相对路径（"diary-covers/xxx.jpg"），
 * 若直接用作 CSS background url() 会被浏览器相对当前页面路径解析
 * （/diaries → /diaries/diary-covers/xxx.jpg），vite 回退 index.html 导致封面不显示。
 * 加前导 "/" 后指向博客静态资源根（blog/public/diary-covers/）。
 */
export function normalizeCoverUrl(url) {
  if (!url) return ''
  const rooted = url.startsWith('/') ? url : '/' + url.replace(/^[/\\]+/, '')
  return assetUrl(rooted)
}

/**
 * 把任意比例的取景区域（0-1）归一化为 16:9 等效区域（cover 语义）：
 * - 比 16:9 宽的区域：宽度不变，高度按 16:9 扩展（完整包含旧取景内容）
 * - 比 16:9 窄的区域：高度不变，宽度按 16:9 扩展；超界时回退为宽度铺满
 * - 中心对齐并 clamp 到原图范围内
 *
 * 旧版自由比例取景框保存的区域（如 2.21:1 超宽）在各自比例容器中
 * 显示为极端扁条/竖条，观感"比例不对、变形"。归一化后所有封面
 * 统一在 16:9 容器中展示，取景内容不裁剪、不拉伸。
 */
export function normalizeArea16x9(area) {
  if (!area || !area.width || !area.height) return null
  const { x, y, width, height } = area
  let nw = width
  let nh = height
  if (width / height > 16 / 9) {
    // 比 16:9 宽 → 宽固定，高按 16:9 扩展（含住旧区域）
    nh = (width * 9) / 16
  } else if (width / height < 16 / 9) {
    // 比 16:9 窄 → 高固定，宽按 16:9 扩展；超界则宽度铺满
    nw = (height * 16) / 9
    if (nw > 1) {
      nw = 1
      nh = 9 / 16
    }
  }
  // 中心对齐 + clamp
  const cx = x + width / 2
  const cy = y + height / 2
  const nx = Math.max(0, Math.min(1 - nw, cx - nw / 2))
  const ny = Math.max(0, Math.min(1 - nh, cy - nh / 2))
  return { x: nx, y: ny, width: nw, height: nh }
}

// 原图宽高比缓存（按 URL），避免重复 new Image() 加载
const _ratioCache = new Map()

/**
 * 加载一张图片的宽高比（naturalWidth / naturalHeight），模块级缓存。
 * @param {string} url
 * @returns {Promise<number|null>}
 */
export function getImageRatio(url) {
  if (!url) return Promise.resolve(null)
  if (_ratioCache.has(url)) return Promise.resolve(_ratioCache.get(url))
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null
      _ratioCache.set(url, r)
      resolve(r)
    }
    img.onerror = () => {
      _ratioCache.set(url, null)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * 根据取景框区域（0-1 比例，相对图片显示区）计算 background-size / background-position。
 *
 * 关键几何：area 是 0-1 相对坐标，area 比例 ≠ 像素比例（取决于原图比例）。
 * 若按旧公式 size = 100/width% × 100/height% 在「容器比例 == area 比例」的容器中渲染，
 * 背景图会被强制缩放到正方形 → 非 1:1 原图（如手机竖图 0.75:1）横向拉伸变形。
 *
 * 知道原图比例 imgRatio 时改用 cover 等比渲染：
 *   区域按原图比例放大到铺满容器（多余部分裁剪，即封面取景语义），不拉伸不变形。
 *   rw/rh = 渲染图宽高（容器倍数），约束：区域 (w,h) 铺满容器 + 渲染等比。
 * 原图比例未知（图片尚未加载）时回退旧 sprite 公式 —— 对真实取景框数据
 * （比例 = (容器比例)/imgRatio）旧公式恰好等比，如主页 Hero 图，因此兼容。
 *
 * @param {{x:number,y:number,width:number,height:number}} area
 * @param {number} [imgRatio] 原图宽高比（naturalWidth/naturalHeight）
 * @returns {{backgroundSize:string, backgroundPosition:string}}
 */
export function computeCoverStyle(area, imgRatio = null) {
  if (!area || !area.width || !area.height) {
    return { backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const { x, y, width, height } = area
  if (width >= 0.999 && height >= 0.999) {
    return { backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (imgRatio && imgRatio > 0) {
    // 容器固定 16:9（列表页/详情页/后台预览均为 aspect-video）
    const C = 16 / 9
    // cover：区域铺满容器 → 渲染宽 Rw = max(容器宽/区域宽, 容器高/区域高 × 原图比例)
    const rw = Math.max(1 / width, imgRatio / (C * height))
    const rh = (rw * C) / imgRatio
    // 位置：把区域 (x, y) 对齐到容器原点；某维渲染尺寸 == 容器尺寸时该维偏移无意义 → 0
    const px = rw > 1 + 1e-6 ? ((-x * rw) / (1 - rw)) * 100 : 0
    const py = rh > 1 + 1e-6 ? ((-y * rh) / (1 - rh)) * 100 : 0
    return {
      backgroundSize: `${(rw * 100).toFixed(4)}% ${(rh * 100).toFixed(4)}%`,
      backgroundPosition: `${px.toFixed(4)}% ${py.toFixed(4)}%`,
    }
  }
  // 原图比例未知（回退）：旧 sprite 公式
  // 某一维铺满（宽或高 ≈ 1）时该维位置无意义，必须用 0：
  // 否则 x/(1-width) 除零 → NaN% → 整个 background-position 声明无效 → 回退到 0% 0% 导致取景不生效
  const px = width >= 0.999 ? 0 : (x / (1 - width)) * 100
  const py = height >= 0.999 ? 0 : (y / (1 - height)) * 100
  return {
    backgroundSize: `${(100 / width).toFixed(4)}% ${(100 / height).toFixed(4)}%`,
    backgroundPosition: `${px.toFixed(4)}% ${py.toFixed(4)}%`,
  }
}

/**
 * 日记封面 Hook
 *
 * 优先级（高 → 低）：
 *   1. 用户上传的封面（存储在 admin 后端 diary-covers.json）
 *   2. 从照片墙当日图片中持久化抽取的封面（diary-photo-covers.json）
 *   3. frontmatter 中显式设置的 cover
 *   4. 按日期（YYYY-MM-DD）从照片墙严格匹配，用 seed 随机选一张
 *   5. 无匹配 → 不显示封面
 *
 * 封面展示区域（area）独立存储，作用于任意来源的封面
 *
 * @param {Array} diaries  日记数组，每项含 { slug, date, cover }
 * @returns {{
 *   coverMap: Object,         // { [slug]: coverUrl } 列表页用（缩略图优先）
 *   coverFullMap: Object,     // { [slug]: coverUrl } 详情页用（原图优先）
 *   uploadedMap: Object,      // 用户上传的封面映射
 *   pickedMap: Object,        // 持久化抽取的封面映射
 *   areaMap: Object,          // 封面展示区域映射 { [slug]: {x,y,width,height} }
 *   hasPhotoForDate: (slug) => boolean,
 *   getCoverStyle: (slug) => { backgroundSize, backgroundPosition },
 *   loading: boolean,
 *   uploadCover: (slug, file) => Promise<string>,
 *   removeCover: (slug) => Promise<boolean>,
 *   randomCover: (slug) => Promise<string>,
 *   resetPicked: (slug) => Promise<boolean>,
 *   setCoverArea: (slug, area) => Promise<boolean>,
 *   resetCoverArea: (slug) => Promise<boolean>,
 *   reload: () => Promise<void>,
 * }}
 */
export function useDiaryCovers(diaries) {
  const [photos, setPhotos] = useState([])
  const [uploadedMap, setUploadedMap] = useState({})
  const [pickedMap, setPickedMap] = useState({})
  const [areaMap, setAreaMap] = useState({})
  // 封面图宽高比（naturalWidth/naturalHeight），按 URL 存，供 cover 等比渲染
  const [ratios, setRatios] = useState({})
  const [loading, setLoading] = useState(true)

  // 加载本地照片 manifest（用于按日期匹配）。
  // 复用 usePhotos 的模块级缓存：照片墙批量删除后内存缓存已同步过滤，
  // 因此这里始终能拿到「未被删除」的最新照片列表；删除时派发的
  // photos-deleted 事件会触发这里重新读取，日记封面即时更新。
  const refreshPhotos = useCallback(async () => {
    const data = await fetchLocalPhotosManifest()
    setPhotos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchLocalPhotosManifest().then((data) => {
      if (!cancelled) {
        setPhotos(Array.isArray(data) ? data : [])
        setLoading(false)
      }
    })
    // 照片墙批量删除后即时刷新（同一会话内）
    const onDeleted = () => {
      if (!cancelled) refreshPhotos()
    }
    window.addEventListener('photos-deleted', onDeleted)
    return () => {
      cancelled = true
      window.removeEventListener('photos-deleted', onDeleted)
    }
  }, [refreshPhotos])

  // 加载用户上传的封面映射 + 抽取映射 + 区域映射
  const reload = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/diary-covers').then((r) => r.json()),
        fetch('/api/diary-photo-covers').then((r) => r.json()),
        fetch('/api/diary-cover-areas').then((r) => r.json()),
      ])
      const up = (r1 && r1.data && typeof r1.data === 'object') ? r1.data : {}
      const pk = (r2 && r2.data && typeof r2.data === 'object') ? r2.data : {}
      const ar = (r3 && r3.data && typeof r3.data === 'object') ? r3.data : {}
      setUploadedMap(up)
      setPickedMap(pk)
      setAreaMap(ar)
    } catch {
      setUploadedMap({})
      setPickedMap({})
      setAreaMap({})
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // 按日期分组照片：{ "2024-05-20": [photo, ...], ... }
  const photosByDate = useMemo(() => {
    const map = new Map()
    for (const p of photos) {
      const dt = p.dateTime || ''
      const date = dt.slice(0, 10) // YYYY-MM-DD
      if (date.length === 10) {
        if (!map.has(date)) map.set(date, [])
        map.get(date).push(p)
      }
    }
    return map
  }, [photos])

  // 已删除照片的 id 集合：持久化抽取的封面若指向已删照片则跳过，回退到默认随机
  const aliveIds = useMemo(() => new Set(photos.map((p) => p.id)), [photos])

  // 列表页用：缩略图优先
  const coverMap = useMemo(() => {
    const result = {}
    for (const d of diaries || []) {
      // 1. 用户上传（相对路径规范化为根路径，否则页面相对解析导致 404）
      if (uploadedMap[d.slug]) {
        result[d.slug] = normalizeCoverUrl(uploadedMap[d.slug])
        continue
      }
      // 2. 持久化抽取（照片已被删除时跳过，回退到默认随机）
      const picked = pickedMap[d.slug]
      if (picked && (!picked.photoId || aliveIds.has(picked.photoId))) {
        result[d.slug] = assetUrl(picked.thumbPath || picked.url)
        continue
      }
      // 3. frontmatter cover
      if (d.cover) {
        result[d.slug] = normalizeCoverUrl(d.cover)
        continue
      }
      // 4. 默认 seed 随机
      if (d.date && d.date.length === 10) {
        const matched = photosByDate.get(d.date)
        if (matched && matched.length > 0) {
          const seed = d.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
          const idx = seed % matched.length
          const photo = matched[idx]
          result[d.slug] = assetUrl(photo.thumbPath) || toOriginalUrl(photo)
        }
      }
    }
    return result
  }, [diaries, photosByDate, uploadedMap, pickedMap, aliveIds])

  // 详情页用：缩略图优先（/local-photo 原图仅 dev 可用，线上 404 会回退，直接避免）
  const coverFullMap = useMemo(() => {
    const result = {}
    for (const d of diaries || []) {
      // 1. 用户上传（相对路径规范化为根路径）
      if (uploadedMap[d.slug]) {
        result[d.slug] = normalizeCoverUrl(uploadedMap[d.slug])
        continue
      }
      // 2. 持久化抽取（照片已删除则跳过，回退到默认随机）
      const picked = pickedMap[d.slug]
      if (picked && (!picked.photoId || aliveIds.has(picked.photoId))) {
        result[d.slug] = assetUrl(picked.thumbPath || picked.url)
        continue
      }
      // 3. frontmatter cover
      if (d.cover) {
        result[d.slug] = normalizeCoverUrl(d.cover)
        continue
      }
      // 4. 默认 seed 随机（缩略图优先）
      if (d.date && d.date.length === 10) {
        const matched = photosByDate.get(d.date)
        if (matched && matched.length > 0) {
          const seed = d.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
          const idx = seed % matched.length
          const photo = matched[idx]
          result[d.slug] = assetUrl(photo.thumbPath) || toOriginalUrl(photo)
        }
      }
    }
    return result
  }, [diaries, photosByDate, uploadedMap, pickedMap, aliveIds])

  // 加载所有封面图（列表缩略图 + 详情原图）的宽高比，供 computeCoverStyle 等比渲染
  useEffect(() => {
    const urls = new Set()
    for (const d of diaries || []) {
      if (coverMap[d.slug]) urls.add(coverMap[d.slug])
      if (coverFullMap[d.slug]) urls.add(coverFullMap[d.slug])
    }
    if (urls.size === 0) return
    let cancelled = false
    Promise.all([...urls].map(async (u) => [u, await getImageRatio(u)])).then((entries) => {
      if (cancelled) return
      setRatios((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [u, r] of entries) {
          if (r && next[u] !== r) {
            next[u] = r
            changed = true
          }
        }
        return changed ? next : prev
      })
    })
    return () => {
      cancelled = true
    }
  }, [coverMap, coverFullMap, diaries])

  // 判断某日记当日是否有照片可抽取
  const hasPhotoForDate = useCallback(
    (slug) => {
      const d = (diaries || []).find((x) => x.slug === slug)
      if (!d || !d.date || d.date.length !== 10) return false
      const matched = photosByDate.get(d.date)
      return !!(matched && matched.length > 0)
    },
    [diaries, photosByDate],
  )

  // 上传封面
  const uploadCover = useCallback(
    async (slug, file) => {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/diary-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, dataUrl }),
      })
      const json = await resp.json()
      if (json.data && json.data.cover) {
        setUploadedMap((prev) => ({ ...prev, [slug]: json.data.cover }))
        return json.data.cover
      }
      throw new Error(json.error || '封面上传失败')
    },
    [],
  )

  // 移除上传的封面
  const removeCover = useCallback(
    async (slug) => {
      const resp = await fetch(`/api/diary-cover?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) {
        setUploadedMap((prev) => {
          const next = { ...prev }
          delete next[slug]
          return next
        })
        return true
      }
      throw new Error(json.error || '删除失败')
    },
    [],
  )

  // 从当日照片随机抽一张并持久化
  const randomCover = useCallback(
    async (slug) => {
      const d = (diaries || []).find((x) => x.slug === slug)
      if (!d || !d.date || d.date.length !== 10) {
        throw new Error('该日记无日期，无法匹配照片')
      }
      const matched = photosByDate.get(d.date)
      if (!matched || matched.length === 0) {
        throw new Error('当日没有可抽取的照片')
      }
      // 随机选一张（避免与当前抽取的相同，若只有一张则无可选）
      const current = pickedMap[slug]
      let idx = Math.floor(Math.random() * matched.length)
      if (matched.length > 1 && current?.photoId) {
        const startIdx = idx
        while (matched[idx].id === current.photoId) {
          idx = (idx + 1) % matched.length
          if (idx === startIdx) break
        }
      }
      const photo = matched[idx]
      const entry = {
        slug,
        photoId: photo.id || '',
        url: toOriginalUrl(photo),
        thumbPath: photo.thumbPath || '',
      }
      const resp = await fetch('/api/diary-photo-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      const json = await resp.json()
      if (json.data) {
        setPickedMap((prev) => ({ ...prev, [slug]: json.data }))
        return assetUrl(json.data.url || json.data.thumbPath)
      }
      throw new Error(json.error || '抽取失败')
    },
    [diaries, photosByDate, pickedMap],
  )

  // 清除抽取，回到默认 seed
  const resetPicked = useCallback(
    async (slug) => {
      const resp = await fetch(`/api/diary-photo-cover?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) {
        setPickedMap((prev) => {
          const next = { ...prev }
          delete next[slug]
          return next
        })
        return true
      }
      throw new Error(json.error || '重置失败')
    },
    [],
  )

  // 设置封面展示区域
  const setCoverArea = useCallback(
    async (slug, area) => {
      const resp = await fetch('/api/diary-cover-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, area }),
      })
      const json = await resp.json()
      if (json.data) {
        setAreaMap((prev) => ({ ...prev, [slug]: json.data }))
        return true
      }
      throw new Error(json.error || '保存区域失败')
    },
    [],
  )

  // 清除封面展示区域
  const resetCoverArea = useCallback(
    async (slug) => {
      const resp = await fetch(`/api/diary-cover-area?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) {
        setAreaMap((prev) => {
          const next = { ...prev }
          delete next[slug]
          return next
        })
        return true
      }
      throw new Error(json.error || '清除区域失败')
    },
    [],
  )

  // 获取某 slug 的封面展示样式（background sprite）
  const getCoverStyle = useCallback(
    (slug) => computeCoverStyle(areaMap[slug]),
    [areaMap],
  )

  return {
    coverMap,
    coverFullMap,
    uploadedMap,
    pickedMap,
    areaMap,
    ratios,
    hasPhotoForDate,
    getCoverStyle,
    loading,
    uploadCover,
    removeCover,
    randomCover,
    resetPicked,
    setCoverArea,
    resetCoverArea,
    reload,
  }
}
