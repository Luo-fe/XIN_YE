/**
 * 照片元数据本地缓存与编辑持久化
 *
 * 设计：
 * - manifest（构建期产物）作为底层数据源，不可变
 * - 用户在网页上对照片的编辑（日期/地点/GPS 等）以「增量补丁」形式存入 localStorage
 * - 下次打开网站时：先加载 manifest，再叠加 edits 补丁 → 即时呈现上次编辑结果
 * - 缓存 key 带版本号，便于未来清理
 *
 * edits 结构：{ [photoId]: { dateTime?, location?, gps?, camera?, dimensions? } }
 * 只存被编辑过的字段，未编辑的字段保持 manifest 原值
 */

const CACHE_KEY = 'yn_photo_edits_v1'
const DELETED_KEY = 'yn_photo_deleted_v1'

/** 读取本地编辑补丁 */
export function loadPhotoEdits() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

// ============ 已删除照片管理 ============

/** 读取已删除照片 ID 集合 */
export function loadDeletedIds() {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

/** 添加一批已删除照片 ID */
export function addDeletedIds(ids) {
  if (!ids || ids.length === 0) return loadDeletedIds()
  const set = loadDeletedIds()
  for (const id of ids) set.add(id)
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
  return set
}

/** 恢复指定照片（从已删除集合中移除） */
export function removeDeletedId(id) {
  if (!id) return loadDeletedIds()
  const set = loadDeletedIds()
  set.delete(id)
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
  return set
}

/** 清空已删除列表（恢复全部） */
export function clearAllDeleted() {
  try {
    localStorage.removeItem(DELETED_KEY)
  } catch {
    /* ignore */
  }
  return new Set()
}

/** 获取已删除照片数量 */
export function countDeleted() {
  return loadDeletedIds().size
}

/** 写入完整 edits 对象 */
function saveAllEdits(edits) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(edits))
    return true
  } catch {
    return false
  }
}

/**
 * 更新单张照片的编辑补丁（合并已有字段）
 * @param {string} id 照片 id
 * @param {object} patch { dateTime?, location?, gps?, camera?, dimensions? }
 * @returns {object} 更新后的完整 edits
 */
export function applyPhotoEdit(id, patch) {
  if (!id || !patch) return loadPhotoEdits()
  const edits = loadPhotoEdits()
  edits[id] = { ...(edits[id] || {}), ...patch }
  saveAllEdits(edits)
  return edits
}

/**
 * 删除某张照片的编辑补丁（恢复为 manifest 原值）
 * @param {string} id
 */
export function clearPhotoEdit(id) {
  if (!id) return loadPhotoEdits()
  const edits = loadPhotoEdits()
  delete edits[id]
  saveAllEdits(edits)
  return edits
}

/** 清空全部编辑 */
export function clearAllPhotoEdits() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
  return {}
}

/**
 * 把 manifest 项与编辑补丁合并为最终照片对象
 * @param {object} item manifest 原始项
 * @param {object} [edit] 编辑补丁（可选）
 * @returns {object} 合并后的照片对象（含 source/url 等运行时字段）
 */
export function mergePhotoWithEdit(item, edit) {
  const merged = edit ? { ...item, ...edit } : { ...item }
  // 合并 location 嵌套对象，避免补丁部分字段覆盖整个对象
  if (edit?.location) {
    merged.location = {
      ...(item.location || { province: '', city: '' }),
      ...edit.location,
    }
  }
  if (edit?.gps) {
    // 允许通过编辑清空 gps（传 null）
    merged.gps = edit.gps
  }
  if (edit?.camera) {
    merged.camera = { ...(item.camera || {}), ...edit.camera }
  }
  if (edit?.dimensions) {
    merged.dimensions = { ...(item.dimensions || {}), ...edit.dimensions }
  }
  // 编辑了 dateTime 时同步 timestamp
  if (edit?.dateTime && edit.dateTime !== item.dateTime) {
    const ts = parseDateTimeToTimestamp(edit.dateTime)
    if (ts) merged.timestamp = ts
  }
  return merged
}

/**
 * 把 'YYYY-MM-DD HH:mm:ss' 转成秒级时间戳
 * 失败返回 null
 */
function parseDateTimeToTimestamp(dt) {
  if (!dt || typeof dt !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(dt.trim())
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(date.getTime() / 1000)
}

/**
 * 统计编辑补丁数量（用于 UI 显示「已编辑 N 张」）
 */
export function countPhotoEdits() {
  return Object.keys(loadPhotoEdits()).length
}

export default {
  loadPhotoEdits,
  applyPhotoEdit,
  clearPhotoEdit,
  clearAllPhotoEdits,
  mergePhotoWithEdit,
  countPhotoEdits,
  loadDeletedIds,
  addDeletedIds,
  removeDeletedId,
  clearAllDeleted,
  countDeleted,
}
