/**
 * EXIF 信息提取（Task 14.1）
 *
 * 使用 exifr 库提取照片的拍摄时间、GPS、相机信息；
 * 尺寸通过 createImageBitmap / Image() 异步加载获取。
 * 缺失字段统一返回 null，不抛错。
 */

import exifr from 'exifr'

/**
 * 加载图片获取宽高尺寸
 * 优先使用 createImageBitmap（性能更好），降级到 Image()
 * @param {File|Blob} file
 * @returns {Promise<{width:number, height:number}>}
 */
async function getImageDimensions(file) {
  // 优先 createImageBitmap
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const { width, height } = bitmap
      // 释放 bitmap 资源（部分浏览器支持 close）
      if (typeof bitmap.close === 'function') bitmap.close()
      return { width, height }
    } catch {
      /* 降级到 Image() */
    }
  }
  // 降级方案：通过 URL.createObjectURL + Image
  return await new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = img
        URL.revokeObjectURL(url)
        resolve({ width, height })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ width: null, height: null })
      }
      img.src = url
    } catch {
      resolve({ width: null, height: null })
    }
  })
}

/**
 * 从照片文件中提取 EXIF 信息
 * @param {File} file
 * @returns {Promise<{dateTime:string|null, gps:{lat:number,lon:number}|null, camera:{make:string,model:string}|null, dimensions:{width:number,height:number}}>}
 */
export async function extractExif(file) {
  const result = {
    dateTime: null,
    gps: null,
    camera: null,
    dimensions: { width: null, height: null },
  }

  // 1. 主 EXIF 解析（DateTimeOriginal / CreateDate / Make / Model）
  try {
    const parsed = await exifr.parse(file, { tiff: true, ifd0: true, exif: true })
    if (parsed) {
      // 拍摄时间：优先 DateTimeOriginal，其次 CreateDate
      const dt = parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.DateTime
      if (dt) {
        // exifr 通常返回 Date 对象
        if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
          result.dateTime = dt.toISOString()
        } else if (typeof dt === 'string') {
          // 字符串格式 "2024:01:02 03:04:05" → 标准化
          const normalized = String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
          const d = new Date(normalized)
          if (!Number.isNaN(d.getTime())) result.dateTime = d.toISOString()
          else result.dateTime = normalized
        }
      }
      // 相机信息
      const make = parsed.Make ?? parsed.CameraMake
      const model = parsed.Model ?? parsed.CameraModel
      if (make || model) {
        result.camera = {
          make: make ? String(make).trim() : null,
          model: model ? String(model).trim() : null,
        }
      }
    }
  } catch {
    /* EXIF 解析失败，忽略 */
  }

  // 2. GPS 单独解析（exifr.gps 返回 {latitude, longitude}）
  try {
    const gps = await exifr.gps(file)
    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      result.gps = { lat: gps.latitude, lon: gps.longitude }
    }
  } catch {
    /* GPS 解析失败，忽略 */
  }

  // 3. 图片尺寸
  try {
    const dims = await getImageDimensions(file)
    result.dimensions = dims
  } catch {
    /* 尺寸获取失败，保留 null */
  }

  return result
}

export default { extractExif }
