import { useEffect, useState, useCallback } from 'react'
import {
  loadPhotoEdits,
  applyPhotoEdit,
  clearPhotoEdit,
  mergePhotoWithEdit,
  loadDeletedIds,
  addDeletedIds,
  removeDeletedId,
  clearAllDeleted,
} from '../utils/photoCache'

// admin API 基址：本地 dev 走 Vite proxy（相对路径，同源避免 ORB）；
// 部署时若配置了 VITE_ADMIN_URL 则用远程 admin（跨域），未配置则回退本地 manifest
const ADMIN_PROXY_URL = import.meta.env.VITE_ADMIN_URL || ''

// 百度网盘原图代理 Worker（方案 B 5.2/B2）：静态站上大图经 Worker 拉网盘原图。
// 由构建时注入（GitHub secret VITE_BAIDU_PROXY），未配置则大图回退缩略图
const BAIDU_PROXY = import.meta.env.VITE_BAIDU_PROXY || ''

// 运行时加载 local-photos-manifest.json（6MB+，放 public/ 避免打包进 JS）
// 使用内存缓存，同一会话内只 fetch 一次
let _localManifestCache = null
let _localManifestPromise = null

async function fetchLocalPhotosManifest() {
  if (_localManifestCache) return _localManifestCache
  if (_localManifestPromise) return _localManifestPromise
  _localManifestPromise = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/'
      const url = `${base}local-photos-manifest.json`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      _localManifestCache = Array.isArray(data) ? data : []
    } catch {
      _localManifestCache = []
    }
    return _localManifestCache
  })()
  return _localManifestPromise
}

/** 同步获取已缓存的 manifest（可能为 null，如未加载完成） */
export function getLocalManifest() {
  return _localManifestCache || []
}

// 供其他模块（如 useDiaryCovers）复用同一份 manifest 缓存，避免重复下载 6MB
export { fetchLocalPhotosManifest }

/**
 * 把网盘 mtime（秒）转成 'YYYY-MM-DD HH:mm:ss' 字符串
 */
function mtimeToDateTime(mtime) {
  if (!mtime || !Number.isFinite(mtime)) return ''
  const d = new Date(mtime * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 按省/市分组
 * @returns {Array<{province:string, photos:Array, cities:Array<{city:string, photos:Array}>}>}
 */
export function groupByLocation(photos) {
  const provinces = new Map()
  for (const p of photos) {
    const province = p.location?.province || '未知地区'
    const city = p.location?.city || '未知城市'
    if (!provinces.has(province)) {
      provinces.set(province, { province, cities: new Map(), photos: [] })
    }
    const prov = provinces.get(province)
    prov.photos.push(p)
    if (!prov.cities.has(city)) {
      prov.cities.set(city, { city, photos: [] })
    }
    prov.cities.get(city).photos.push(p)
  }
  return [...provinces.values()]
    .map((prov) => ({
      province: prov.province,
      photos: prov.photos,
      cities: [...prov.cities.values()].sort((a, b) => {
        // 未知城市一律排到末尾
        const aUnknown = a.city === '未知城市'
        const bUnknown = b.city === '未知城市'
        if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
        return b.photos.length - a.photos.length
      }),
    }))
    .sort((a, b) => {
      // 未知地区/未知城市一律排到末尾
      const aUnknown = a.province === '未知地区'
      const bUnknown = b.province === '未知地区'
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
      // 已知地区按照片数降序
      return b.photos.length - a.photos.length
    })
}

// ============ 流年四季 / 往昔回忆（本地照片）============
// local-photos-manifest.json 由 scripts/analyze-photos.mjs 生成
// 字段：{ id, path, thumbPath, filename, dateTime, timestamp, gps:[lat,lng], location:{province,city}, camera, dimensions, hasCaptureTime, mtime }

/**
 * 把本地 manifest 项统一成前端可用的照片对象
 * url 指向 /local-photo/<path>（dev 下由 vite 中间件服务原图）；生产无此服务时回退 thumbPath
 * 若传入 edit 补丁，则合并补丁字段（编辑优先于 manifest 原值）
 */
function toLocalSeasonPhoto(item, edit) {
  const merged = mergePhotoWithEdit(item, edit)
  return {
    id: merged.id,
    url: merged.path ? `/local-photo/${encodeURI(merged.path)}` : '',
    thumbPath: merged.thumbPath || '',
    // 网盘原图（经 Cloudflare Worker 代理）；线上 dev 无 /local-photo 时用此查看大图
    baiduUrl: BAIDU_PROXY && merged.baiduPath ? `${BAIDU_PROXY}/img?path=${encodeURIComponent(merged.baiduPath)}` : '',
    filename: merged.filename || '',
    dateTime: merged.dateTime || '',
    timestamp: merged.timestamp || 0,
    gps: merged.gps || null,
    location: merged.location || { province: '', city: '' },
    camera: merged.camera || {},
    dimensions: merged.dimensions || {},
    shareLink: '',
    baiduPath: '',
    source: 'local',
    hasCaptureTime: merged.hasCaptureTime !== false,
  }
}

/**
 * 本地照片 hook：返回流年四季（有拍摄时间）+ 往昔回忆（仅有修改时间）
 * manifest 在运行时从 public/local-photos-manifest.json 异步 fetch（6MB+，避免打包进 JS）
 *
 * 能力：
 * - 编辑：updatePhoto(id, patch) / resetPhoto(id)，持久化到 localStorage
 * - 删除：deletePhotos(ids) / restorePhoto(id) / restoreAllDeleted()，持久化到 localStorage
 * - 已删除照片从所有视图中过滤（时间/地点/地图/往昔回忆）
 * - 再次打开网站时，编辑与删除状态自动恢复
 *
 * @returns {{
 *   seasons: Array,
 *   memories: Array,
 *   loading: boolean,
 *   updatePhoto: (id: string, patch: object) => void,
 *   resetPhoto: (id: string) => void,
 *   deletePhotos: (ids: string[]) => void,
 *   restorePhoto: (id: string) => void,
 *   restoreAllDeleted: () => void,
 *   editedCount: number,
 *   deletedCount: number,
 * }}
 */
export function useLocalPhotos() {
  const [data, setData] = useState({
    seasons: [],
    memories: [],
    loading: true,
    updatePhoto: () => {},
    resetPhoto: () => {},
    deletePhotos: () => {},
    restorePhoto: () => {},
    restoreAllDeleted: () => {},
    editedCount: 0,
    deletedCount: 0,
  })

  // 从 manifest + edits + deleted 构建 seasons/memories
  const buildPhotos = useCallback((manifest) => {
    const source = Array.isArray(manifest) ? manifest : []
    const edits = loadPhotoEdits()
    const deleted = loadDeletedIds()
    const seasons = []
    const memories = []
    for (const item of source) {
      if (deleted.has(item.id)) continue // 过滤已删除
      const edit = edits[item.id]
      const photo = toLocalSeasonPhoto(item, edit)
      if (item.hasCaptureTime !== false) seasons.push(photo)
      else memories.push(photo)
    }
    // seasons 降序：最新照片在前
    seasons.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return {
      seasons,
      memories,
      editedCount: Object.keys(edits).length,
      deletedCount: deleted.size,
    }
  }, [])

  // 更新单张照片：写入 localStorage 补丁 + 刷新 state
  const updatePhoto = useCallback((id, patch) => {
    if (!id || !patch) return
    applyPhotoEdit(id, patch)
    setData((prev) => {
      const manifest = _localManifestCache || []
      const edits = loadPhotoEdits()
      const deleted = loadDeletedIds()
      const next = { seasons: [], memories: [] }
      for (const key of ['seasons', 'memories']) {
        next[key] = prev[key].map((p) => {
          if (p.id !== id) return p
          const original = manifest.find((m) => m.id === id) || p
          return toLocalSeasonPhoto(original, edits[id])
        })
      }
      next.seasons.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      return {
        ...prev,
        seasons: next.seasons,
        memories: next.memories,
        editedCount: Object.keys(edits).length,
        deletedCount: deleted.size,
      }
    })
  }, [])

  // 重置单张照片为 manifest 原值
  const resetPhoto = useCallback((id) => {
    if (!id) return
    clearPhotoEdit(id)
    setData((prev) => {
      const manifest = _localManifestCache || []
      const original = manifest.find((m) => m.id === id)
      if (!original) return prev
      const restored = toLocalSeasonPhoto(original)
      const next = {
        seasons: prev.seasons.map((p) => (p.id === id ? restored : p)),
        memories: prev.memories.map((p) => (p.id === id ? restored : p)),
      }
      next.seasons.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      return {
        ...prev,
        seasons: next.seasons,
        memories: next.memories,
        editedCount: Object.keys(loadPhotoEdits()).length,
      }
    })
  }, [])

  // 批量物理删除照片（调用服务端 API 删除缩略图文件 + manifest 记录）
  // 成功 → 本地 deleted 集合兜底（admin 未运行时刷新也不复活）；
  // 失败 → 回滚乐观更新，让照片回到视图并提示
  const deletePhotos = useCallback(
    async (ids) => {
      if (!ids || ids.length === 0) return false
      // 乐观更新：先从视图中移除
      const idSet = new Set(ids)
      setData((prev) => ({
        ...prev,
        seasons: prev.seasons.filter((p) => !idSet.has(p.id)),
        memories: prev.memories.filter((p) => !idSet.has(p.id)),
      }))
      // 调用服务端 API 物理删除
      let ok = false
      try {
        const resp = await fetch(`${ADMIN_PROXY_URL}/api/content/photos/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (resp.ok) {
          ok = true
          // 本地兜底：删除状态持久化到 localStorage（刷新/离线不复活），
          // 与"已删除照片从所有视图过滤"的既有逻辑保持一致
          addDeletedIds(ids)
          // 同步更新内存缓存
          if (_localManifestCache) {
            _localManifestCache = _localManifestCache.filter((m) => !idSet.has(m.id))
          }
        } else {
          const err = await resp.json().catch(() => ({}))
          console.error('物理删除失败:', err.error || resp.status)
        }
      } catch (err) {
        console.error('物理删除请求失败:', err)
      }
      if (!ok) {
        // 回滚：从缓存重建视图，让照片恢复显示
        const manifest = _localManifestCache || []
        const built = buildPhotos(manifest)
        setData((prev) => ({ ...prev, ...built }))
      }
      // 通知依赖照片数据的其他模块（日记封面、月份计数等）同步刷新
      window.dispatchEvent(new CustomEvent('photos-deleted', { detail: ids }))
      return ok
    },
    [buildPhotos],
  )

  // 恢复单张已删除照片
  const restorePhoto = useCallback((id) => {
    if (!id) return
    removeDeletedId(id)
    setData((prev) => {
      const manifest = _localManifestCache || []
      const original = manifest.find((m) => m.id === id)
      if (!original) return { ...prev, deletedCount: loadDeletedIds().size }
      const restored = toLocalSeasonPhoto(original, loadPhotoEdits()[id])
      const next = {
        seasons: original.hasCaptureTime !== false ? [...prev.seasons, restored] : prev.seasons,
        memories: original.hasCaptureTime === false ? [...prev.memories, restored] : prev.memories,
      }
      next.seasons.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      return {
        ...prev,
        seasons: next.seasons,
        memories: next.memories,
        deletedCount: loadDeletedIds().size,
      }
    })
  }, [])

  // 恢复全部已删除照片
  const restoreAllDeleted = useCallback(() => {
    clearAllDeleted()
    const manifest = _localManifestCache || []
    const built = buildPhotos(manifest)
    setData((prev) => ({
      ...prev,
      ...built,
      loading: false,
    }))
  }, [buildPhotos])

  // 异步加载 manifest
  useEffect(() => {
    let cancelled = false
    fetchLocalPhotosManifest().then((manifest) => {
      if (cancelled) return
      setData({
        ...buildPhotos(manifest),
        loading: false,
        updatePhoto,
        resetPhoto,
        deletePhotos,
        restorePhoto,
        restoreAllDeleted,
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return data
}

// ============ 网盘相册（百度网盘子文件夹）============

/**
 * 拉取网盘相册列表（子文件夹 + 封面 + 照片数）
 * 失败/admin 未运行时返回空数组
 * @returns {{albums: Array, loading: boolean, error: string}}
 */
export function useBaiduAlbums() {
  const [data, setData] = useState({ albums: [], loading: true, error: '' })
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ADMIN_PROXY_URL) {
        // 部署无 admin：尝试直接相对路径（vite proxy 同源）
      }
      try {
        // admin 首次拉取会递归遍历整个网盘目录树（51个相册逐个列目录），实测 36s+
        // 因此超时设为 90s 给首次调用留足时间；后续走缓存会很快
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 90000)
        const resp = await fetch(`${ADMIN_PROXY_URL}/api/baidu/albums`, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!resp.ok) {
          if (!cancelled) setData({ albums: [], loading: false, error: `HTTP ${resp.status}` })
          return
        }
        const data = await resp.json().catch(() => null)
        if (cancelled) return
        const albums = (data && Array.isArray(data.albums) ? data.albums : []).map((a) => ({
          ...a,
          coverUrl: a.coverUrl ? `${ADMIN_PROXY_URL}${a.coverUrl}` : '',
        }))
        setData({ albums, loading: false, error: '' })
      } catch (e) {
        if (cancelled) return
        const isAbort = e.name === 'AbortError' || /aborted/i.test(e.message || '')
        setData({
          albums: [],
          loading: false,
          error: isAbort
            ? '请求超时（>90s），admin 仍在拉取网盘目录，请稍后重试或检查网络'
            : String(e.message || e),
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])
  return data
}

/**
 * 拉取某个网盘相册内的照片列表
 * @param {string} albumPath - 网盘目录路径，空字符串时不请求
 * @returns {{photos: Array, loading: boolean}}
 */
export function useBaiduAlbumPhotos(albumPath) {
  const [data, setData] = useState({ photos: [], loading: false })
  useEffect(() => {
    if (!albumPath) {
      setData({ photos: [], loading: false })
      return
    }
    let cancelled = false
    setData({ photos: [], loading: true })
    async function load() {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 60000)
        const resp = await fetch(
          `${ADMIN_PROXY_URL}/api/baidu/album-photos?path=${encodeURIComponent(albumPath)}`,
          { signal: ctrl.signal },
        )
        clearTimeout(timer)
        if (!resp.ok) {
          if (!cancelled) setData({ photos: [], loading: false })
          return
        }
        const data = await resp.json().catch(() => null)
        if (cancelled) return
        const photos = (data && Array.isArray(data.photos) ? data.photos : []).map((p) => ({
          id: `bd-${p.fs_id}`,
          url: `${ADMIN_PROXY_URL}${p.url}`,
          thumbPath: '',
          filename: p.filename || '',
          dateTime: mtimeToDateTime(p.mtime),
          timestamp: p.mtime || 0,
          gps: null,
          location: { province: '', city: '' },
          camera: {},
          dimensions: {},
          shareLink: '',
          baiduPath: p.path || '',
          source: 'baidu',
        }))
        setData({ photos, loading: false })
      } catch {
        if (!cancelled) setData({ photos: [], loading: false })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [albumPath])
  return data
}

