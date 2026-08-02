/**
 * 缩略图生成（Task 14.3）
 *
 * 使用 Canvas 进行等比缩放压缩，输出 WebP blob + dataURL。
 * 原图小于 maxSize 时不放大。
 */

/**
 * 生成缩略图
 * @param {File|Blob} file 原始图片文件
 * @param {number} [maxSize=800] 最大边长（宽或高），等比缩放
 * @param {number} [quality=0.8] JPEG 质量 0~1
 * @returns {Promise<{blob:Blob, dataUrl:string, width:number, height:number}>}
 */
export async function generateThumbnail(file, maxSize = 800, quality = 0.8) {
  // 1. 通过 createImageBitmap 解码（降级到 Image）
  let bitmap = null
  let objectUrl = null
  let img = null
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file)
    } else {
      objectUrl = URL.createObjectURL(file)
      img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = (e) => reject(e)
        el.src = objectUrl
      })
    }
  } catch (e) {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    throw new Error('图片解码失败: ' + (e?.message || e))
  }

  const srcWidth = bitmap ? bitmap.width : img.naturalWidth
  const srcHeight = bitmap ? bitmap.height : img.naturalHeight

  // 2. 计算目标尺寸（原图小于 maxSize 时不放大）
  let targetWidth = srcWidth
  let targetHeight = srcHeight
  if (srcWidth > maxSize || srcHeight > maxSize) {
    if (srcWidth >= srcHeight) {
      targetWidth = maxSize
      targetHeight = Math.round((srcHeight * maxSize) / srcWidth)
    } else {
      targetHeight = maxSize
      targetWidth = Math.round((srcWidth * maxSize) / srcHeight)
    }
  }

  // 3. Canvas 绘制
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    throw new Error('无法获取 Canvas 2D 上下文')
  }
  // 白底（防止透明 PNG 转 JPEG 后变黑）
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  } else {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  }

  // 4. 输出 WebP blob + dataUrl（上传时使用 .webp 扩展名，输出格式必须一致，
  //    否则产生"webp 扩展名 + JPEG 字节"的文件，部分严格 CDN/缓存会拒收）
  const dataUrl = canvas.toDataURL('image/webp', quality)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('Canvas toBlob 失败'))
      },
      'image/webp',
      quality,
    )
  })

  // 释放资源
  if (bitmap && typeof bitmap.close === 'function') bitmap.close()
  if (objectUrl) URL.revokeObjectURL(objectUrl)

  return { blob, dataUrl, width: targetWidth, height: targetHeight }
}

export default { generateThumbnail }
