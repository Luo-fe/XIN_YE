import { useCallback, useMemo, useRef, useState } from 'react'

// 行内间距（与渲染层默认 flex gap 保持一致；行末剩余空间会动态分配到各空隙中）
export const NATURAL_GAP = 12
// 动态间隙范围：图片保持自然尺寸，剩余宽度均匀加到空隙上（左右两端对齐）；
// 超出 [MIN_GAP, MAX_GAP] 时退回「整行均匀缩放」方案（空隙过低会显得拥挤）
export const MIN_GAP = 8
export const MAX_GAP = 36
// 窄屏断点：小于该宽度时单列全宽显示（大图更大，不强行双列缩小）
export const SINGLE_COL_BREAKPOINT = 640
// 行高有机变化范围：每行高度在 160-250px 之间随行号确定性变化，观感自然不呆板
export const MIN_ROW_HEIGHT = 160
export const MAX_ROW_HEIGHT = 250
// 均匀缩放上限（图片自然尺寸放大的最大倍数）
export const MAX_ROW_SCALE = 1.5
// 打包规则：行至少装到容器宽度的 85%（不足则强制装入下一张，由缩放吸收），
// 且允许轻微溢出到 115%（整行缩小吸收）—— 保证每行都基本铺满、左右两端对齐
export const MIN_ROW_FILL = 0.85
export const MAX_ROW_OVERFLOW = 1.15
// 独占一行的超宽/超高照片最大高度（避免单张竖图被放大到全屏高度）
export const MAX_SINGLE_HEIGHT = 520

/** 照片宽高比：优先用 manifest 中的原始尺寸；无尺寸信息（如网盘照片）默认 3:2 */
function aspectOf(photo) {
  const w = photo?.dimensions?.width
  const h = photo?.dimensions?.height
  if (w && h && w > 0 && h > 0) return w / h
  return 1.5
}

/**
 * 行优先对齐行布局（justified rows）：
 * 照片严格按顺序从左到右、从上到下排列；每行取一个有机变化的行高，
 * 行内每张照片按「行高 × 原生宽高比」精确铺排 —— 不裁剪、不拉伸、全貌可见，
 * 大图自然占更大宽度。
 *
 * 行宽处理（保证左右两端对齐、无缝隙）：
 * - 行不足 85% 宽 → 继续装入下一张（即使溢出，整行缩小吸收）
 * - 剩余空间小 → 动态分配到行内空隙（空隙可调），图片尺寸不变
 * - 剩余空间大 → 整行均匀放大（上限 1.5 倍）
 * - 溢出 → 整行均匀缩小
 * - 最后一行 → 自然空隙、左对齐（不拉伸）
 *
 * 全部尺寸由 manifest 的原始宽高比 + 容器宽度预先算好，与图片是否加载完成无关，
 * 因此图片加载后布局不会重排；窗口缩放时按新宽度重新计算。
 *
 * 超宽图（单张超过容器宽度）独占一行，按容器宽度等比显示，不会被强行缩小。
 *
 * @param {Array} photos 按展示顺序排列的照片（含 dimensions）
 * @param {number} containerWidth 容器像素宽度
 * @returns {Array<{ items: Array<{photo: object, width: number}>, height: number, gap: number }>}
 */
export function computeJustifiedLayout(photos, containerWidth) {
  const rows = []
  if (!Array.isArray(photos) || photos.length === 0 || !(containerWidth > 0)) return rows

  // 窄屏：单列全宽、原生比例（大图更大，滚动浏览）
  if (containerWidth < SINGLE_COL_BREAKPOINT) {
    for (const photo of photos) {
      const h = containerWidth / aspectOf(photo)
      rows.push({
        items: [{ photo, width: containerWidth }],
        height: Math.round(h),
        gap: NATURAL_GAP,
      })
    }
    return rows
  }

  let i = 0
  let rowIdx = 0
  while (i < photos.length) {
    // 行高确定性伪随机：随行号变化，刷新/翻页时稳定不抖动
    const rowH =
      MIN_ROW_HEIGHT +
      (((rowIdx * 2654435761) >>> 8) % (MAX_ROW_HEIGHT - MIN_ROW_HEIGHT + 1))

    // 打包行内照片：按 rowH × 宽高比定宽。
    // 规则：行不足 85% 宽时强制装入下一张（即使溢出，由整行缩放吸收）；
    // 允许轻微溢出到 115%；再放不下才收行 —— 保证每行基本铺满、左右两端对齐。
    const items = []
    let sumW = 0
    while (i < photos.length) {
      const w = rowH * aspectOf(photos[i])
      // 单张就超宽 → 独占一行
      if (items.length === 0 && w > containerWidth) break
      if (
        items.length > 0 &&
        sumW + w + NATURAL_GAP > containerWidth * MAX_ROW_OVERFLOW &&
        sumW >= containerWidth * MIN_ROW_FILL
      ) {
        break
      }
      items.push({ photo: photos[i], width: w })
      sumW += w + (items.length > 1 ? NATURAL_GAP : 0)
      i++
    }

    // 独占一行（超宽图）：按容器宽度等比显示，高度不超过 MAX_SINGLE_HEIGHT
    if (items.length === 0) {
      const photo = photos[i]
      const h = Math.min(containerWidth / aspectOf(photo), MAX_SINGLE_HEIGHT)
      rows.push({ items: [{ photo, width: h * aspectOf(photo) }], height: h, gap: NATURAL_GAP })
      i++
      rowIdx++
      continue
    }

    const naturalSum = sumW - (items.length - 1) * NATURAL_GAP
    const leftover = containerWidth - naturalSum
    const isLastRow = i >= photos.length

    let gap = NATURAL_GAP
    let height = rowH
    let scaled = items

    if (leftover > 0 && !isLastRow) {
      // 剩余宽度优先平均分到各空隙（图片尺寸不变，左右两端对齐）；
      // 空隙超出 [MIN_GAP, MAX_GAP] 范围则退回整行均匀缩放
      const dynamicGap = leftover / (items.length - 1 || 1)
      if (dynamicGap >= MIN_GAP && dynamicGap <= MAX_GAP) {
        gap = dynamicGap
      } else {
        const scale = Math.min(
          MAX_ROW_SCALE,
          (containerWidth - (items.length - 1) * NATURAL_GAP) / naturalSum,
        )
        height = rowH * scale
        scaled = items.map((it) => ({ photo: it.photo, width: it.width * scale }))
      }
    } else if (leftover <= 0) {
      // 溢出：整行均匀缩小铺满
      const scale = Math.max(
        0.6,
        (containerWidth - (items.length - 1) * NATURAL_GAP) / naturalSum,
      )
      height = rowH * scale
      scaled = items.map((it) => ({ photo: it.photo, width: it.width * scale }))
    }
    // 最后一行：保持自然尺寸与自然空隙，左对齐（不拉伸）

    rows.push({ items: scaled, height, gap })
    rowIdx++
  }
  return rows
}

/**
 * 测量容器实际宽度，返回按当前宽度计算好的对齐行布局。
 * 容器宽度变化（窗口缩放/断点切换）时自动重算。
 *
 * 注意：容器只在 loading 结束后才挂载（AnimatePresence mode="wait"），
 * 因此必须用回调 ref 在元素真正挂载时创建 ResizeObserver ——
 * 普通 useEffect 在组件首帧执行时 ref 还是 null，观察器会永远丢失。
 *
 * @param {Array} photos
 * @returns {{ wallRef: import('react').RefCallback<HTMLElement>, rows: Array<{ items: Array<{photo: object, width: number}>, height: number, gap: number }> }}
 */
export function useJustifiedLayout(photos) {
  const { wallRef, width } = useContainerWidth()
  const rows = useMemo(() => computeJustifiedLayout(photos, width), [photos, width])
  return { wallRef, rows }
}

// ---- 瀑布流（masonry）----

// 列内/列间空隙（与渲染层 flex gap 保持一致）
export const MASONRY_GAP = 12
// 列数随容器宽度响应式：宁可少列大图（竖图在窄列中会显得小），不强行多列缩图
export function masonryColumnsOf(containerWidth) {
  if (containerWidth < 560) return 2
  if (containerWidth < 1000) return 3
  return 4
}

/**
 * 列平衡瀑布流（现代照片墙）：
 * - 每列等宽、左右两端对齐，列间空隙固定（列内照片自然错落）
 * - 每张照片宽度 = 列宽，高度 = 列宽 ÷ 原生宽高比 —— 全貌原样展示，
 *   不裁剪、不拉伸、不截取；竖图自然更高更大（不再被统一行高压扁）
 * - 照片逐张放入当前最矮的列（高度平衡），保持时间顺序的整体感
 * - 全部尺寸由 manifest 原生宽高比 + 容器宽度预先算好，图片加载后不重排
 *
 * @param {Array} photos 按展示顺序排列的照片（含 dimensions）
 * @param {number} containerWidth 容器像素宽度
 * @returns {{ cols: Array<{ items: Array<{photo: object, height: number, index: number}> }>, colWidth: number, gap: number }}
 */
export function computeMasonryLayout(photos, containerWidth) {
  if (!Array.isArray(photos) || photos.length === 0 || !(containerWidth > 0)) {
    return { cols: [], colWidth: 0, gap: MASONRY_GAP }
  }
  const cols = masonryColumnsOf(containerWidth)
  const gap = MASONRY_GAP
  const colWidth = (containerWidth - gap * (cols - 1)) / cols
  const buckets = Array.from({ length: cols }, () => [])
  const heights = new Array(cols).fill(0)
  photos.forEach((photo, index) => {
    // 当前最矮的列（并列时取最左，保持左→右的顺序感）
    let ci = 0
    for (let k = 1; k < cols; k++) {
      if (heights[k] < heights[ci]) ci = k
    }
    buckets[ci].push({ photo, height: colWidth / aspectOf(photo), index })
    heights[ci] += colWidth / aspectOf(photo) + gap
  })
  return { cols: buckets, colWidth, gap }
}

/**
 * 瀑布流布局 Hook：测量容器宽度（回调 ref + ResizeObserver，窗口缩放自动重算），
 * 返回按当前宽度算好的列布局。
 *
 * @param {Array} photos
 * @returns {{ wallRef: import('react').RefCallback<HTMLElement>, cols: Array<{ items: Array<{photo: object, height: number, index: number}> }>, colWidth: number, gap: number }}
 */
export function useMasonryLayout(photos) {
  const { wallRef, width } = useContainerWidth()
  const layout = useMemo(() => computeMasonryLayout(photos, width), [photos, width])
  return { wallRef, ...layout }
}

/**
 * 容器宽度测量（回调 ref + ResizeObserver）：
 * 容器在 loading 结束后才挂载（AnimatePresence mode="wait"），普通 useEffect 拿不到 ref，
 * 必须用回调 ref 在元素挂载时创建观察器。
 */
function useContainerWidth() {
  const [width, setWidth] = useState(0)
  const roRef = useRef(null)
  const wallRef = useCallback((el) => {
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (!el) return // 卸载
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    roRef.current = ro
  }, [])
  return { wallRef, width }
}
