/**
 * 照片 manifest 组装辅助
 *
 * manifest 读写和缩略图写入已通过 /api/content/* 服务端 API 完成。
 * 此文件仅保留数据结构组装工具函数。
 */

/**
 * 组装一条 manifest 项
 * @param {object} opts
 * @returns {object}
 */
export function buildPhotoEntry({
  id,
  thumbPath,
  baiduPath = '',
  shareLink = '',
  dateTime = null,
  timestamp,
  gps = null,
  location = null,
  camera = null,
  dimensions = { width: null, height: null },
}) {
  return {
    id,
    thumbPath,
    baiduPath,
    shareLink,
    dateTime,
    timestamp,
    gps: gps || { lat: null, lon: null },
    location: location || { province: '', city: '' },
    camera: camera || { make: null, model: null },
    dimensions: dimensions || { width: null, height: null },
  }
}

/**
 * 生成唯一照片 id（时间戳 + 随机串）
 * @returns {string}
 */
export function generatePhotoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default {
  buildPhotoEntry,
  generatePhotoId,
}
