import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

/**
 * 固定宽高比取景框选择器（用于主页 Hero 图等）
 *
 * 背景完整显示原图（contain），取景框宽高比固定为 targetRatio（默认 16:9），
 * 可整体拖动、可滑动调整大小 —— 展示端容器按相同比例渲染，
 * 因此框选的内容即最终效果：原比例、不缩放、不变形。
 *
 * @param {object} props
 * @param {string} props.src - 图片 URL
 * @param {{x:number,y:number,width:number,height:number}} [props.initialArea] - 已保存区域（0-1）
 * @param {number} [props.targetRatio=16/9] - 取景框固定宽高比
 * @param {function} props.onSave - (area) => void
 * @param {function} [props.onReset] - 恢复默认区域（清除已保存区域）
 * @param {function} [props.onClose]
 */
export default function CoverAreaPicker({
  src,
  initialArea,
  targetRatio = 16 / 9,
  onSave,
  onReset,
  onClose,
}) {
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 })
  const [imgBox, setImgBox] = useState({ x: 0, y: 0, w: 0, h: 0 })
  // 取景框：位置（0-1 相对原图显示区）+ 大小（0.2-1.0）
  const [frameX, setFrameX] = useState(0.2)
  const [frameY, setFrameY] = useState(0.2)
  const [frameScale, setFrameScale] = useState(0.6)
  const [saving, setSaving] = useState(false)
  const stageRef = useRef(null)
  const dragRef = useRef(null)

  // 加载图片真实尺寸
  useEffect(() => {
    const img = new Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.src = src
  }, [src])

  // 初始 area → 取景框
  useEffect(() => {
    if (initialArea && initialArea.width > 0) {
      setFrameX(initialArea.x)
      setFrameY(initialArea.y)
      setFrameScale(Math.max(initialArea.width, initialArea.height))
    }
  }, [initialArea])

  // 测量 stage，计算原图 contain 显示区域
  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const sRect = stage.getBoundingClientRect()
    if (sRect.width === 0 || sRect.height === 0) return
    const imgRatio = imgNatural.w / imgNatural.h
    const boxRatio = sRect.width / sRect.height
    let dw, dh, dx, dy
    if (imgRatio > boxRatio) {
      dw = sRect.width
      dh = sRect.width / imgRatio
      dx = 0
      dy = (sRect.height - dh) / 2
    } else {
      dh = sRect.height
      dw = sRect.height * imgRatio
      dy = 0
      dx = (sRect.width - dw) / 2
    }
    setImgBox({ x: dx, y: dy, w: dw, h: dh })
  }, [imgNatural])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    const timer = setTimeout(measure, 350)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [measure])

  // 取景框像素尺寸（保持 targetRatio，限制在原图显示区内）
  const framePx = useMemo(() => {
    if (imgBox.w <= 0 || imgBox.h <= 0) return { w: 0, h: 0 }
    let fw, fh
    const maxW = imgBox.w
    const maxH = imgBox.h
    if (targetRatio >= maxW / maxH) {
      fw = maxW * frameScale
      fh = fw / targetRatio
      if (fh > maxH) {
        fh = maxH
        fw = fh * targetRatio
      }
    } else {
      fh = maxH * frameScale
      fw = fh * targetRatio
      if (fw > maxW) {
        fw = maxW
        fh = fw / targetRatio
      }
    }
    return { w: fw, h: fh }
  }, [imgBox, frameScale, targetRatio])

  // 取景框像素位置
  const framePosPx = useMemo(
    () => ({
      x: imgBox.x + frameX * imgBox.w,
      y: imgBox.y + frameY * imgBox.h,
    }),
    [imgBox, frameX, frameY],
  )

  const clampX = useCallback(
    (x) => {
      const frameWRatio = framePx.w / imgBox.w
      return Math.max(0, Math.min(1 - frameWRatio, x))
    },
    [framePx, imgBox],
  )
  const clampY = useCallback(
    (y) => {
      const frameHRatio = framePx.h / imgBox.h
      return Math.max(0, Math.min(1 - frameHRatio, y))
    },
    [framePx, imgBox],
  )

  // 拖动取景框
  const handlePointerDown = (e) => {
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFX: frameX,
      startFY: frameY,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e) => {
    if (!dragRef.current || imgBox.w <= 0) return
    const dx = (e.clientX - dragRef.current.startX) / imgBox.w
    const dy = (e.clientY - dragRef.current.startY) / imgBox.h
    setFrameX(clampX(dragRef.current.startFX + dx))
    setFrameY(clampY(dragRef.current.startFY + dy))
  }
  const handlePointerUp = (e) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  // 当前 area（0-1 相对原图）
  const currentArea = useMemo(() => {
    if (imgBox.w <= 0) return null
    return {
      x: frameX,
      y: frameY,
      width: framePx.w / imgBox.w,
      height: framePx.h / imgBox.h,
    }
  }, [frameX, frameY, framePx, imgBox])

  // 预览样式：与展示端完全一致 —— 传原图比例做 cover 等比渲染，
  // 取景框内容按原比例放大铺满目标比例容器，不拉伸变形（竖图不会横向拉宽）
  const imgRatio = imgNatural.w && imgNatural.h ? imgNatural.w / imgNatural.h : null
  const previewStyle = currentArea
    ? imgRatio
      ? (() => {
          const C = targetRatio
          const rw = Math.max(1 / currentArea.width, imgRatio / (C * currentArea.height))
          const rh = (rw * C) / imgRatio
          return {
            backgroundSize: `${(rw * 100).toFixed(4)}% ${(rh * 100).toFixed(4)}%`,
            backgroundPosition: `${(
              rw > 1 + 1e-6 ? ((-currentArea.x * rw) / (1 - rw)) * 100 : 0
            ).toFixed(4)}% ${(
              rh > 1 + 1e-6 ? ((-currentArea.y * rh) / (1 - rh)) * 100 : 0
            ).toFixed(4)}%`,
          }
        })()
      : {
          backgroundSize: `${(100 / currentArea.width).toFixed(4)}% ${(100 / currentArea.height).toFixed(4)}%`,
          backgroundPosition: `${(
            (currentArea.width >= 0.999 ? 0 : (currentArea.x / (1 - currentArea.width)) * 100)
          ).toFixed(4)}% ${(
            (currentArea.height >= 0.999 ? 0 : (currentArea.y / (1 - currentArea.height)) * 100)
          ).toFixed(4)}%`,
        }
    : null

  const handleSave = async () => {
    if (!currentArea) return
    setSaving(true)
    try {
      await onSave(currentArea)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!onReset) return
    setSaving(true)
    try {
      await onReset()
      setFrameX(0.2)
      setFrameY(0.2)
      setFrameScale(0.6)
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        拖动取景框移动位置，滑动下方滑块调整大小。取景框比例固定，展示端按相同比例渲染 —— 框选什么就显示什么，不缩放不变形。
      </p>

      {/* 舞台：完整显示原图 + 固定比例取景框 */}
      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900/95 dark:border-white/10"
        style={{ height: 'min(45vh, 360px)' }}
      >
        <img
          src={src}
          alt="选取区域"
          className="pointer-events-none absolute select-none"
          style={{ left: imgBox.x, top: imgBox.y, width: imgBox.w, height: imgBox.h }}
          draggable={false}
        />
        {framePx.w > 0 && (
          <div
            className="absolute cursor-grab border-2 border-indigo-400 bg-transparent active:cursor-grabbing"
            style={{
              left: framePosPx.x,
              top: framePosPx.y,
              width: framePx.w,
              height: framePx.h,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-indigo-400/50" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-indigo-400/50" />
            <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
              拖动调整
            </span>
          </div>
        )}
      </div>

      {/* 取景框大小滑块 */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">取景框大小</span>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          value={frameScale}
          onChange={(e) => {
            setFrameScale(+e.target.value)
            setFrameX((x) => clampX(x))
            setFrameY((y) => clampY(y))
          }}
          className="h-1.5 w-48 cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-500 dark:bg-white/10"
        />
        <span className="w-8 text-xs font-mono text-gray-400">{Math.round(frameScale * 100)}%</span>
      </div>

      {/* 预览：与展示端完全一致 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          预览（与主页卡片实际展示效果完全一致）：
        </span>
        <div
          className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          style={{ aspectRatio: targetRatio }}
        >
          {previewStyle ? (
            <div
              className="h-full w-full bg-no-repeat"
              style={{
                backgroundImage: `url(${src})`,
                backgroundSize: previewStyle.backgroundSize,
                backgroundPosition: previewStyle.backgroundPosition,
              }}
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-gray-400">加载中...</div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-lg border border-rose-300/50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              恢复默认
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !previewStyle}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          确定保存
        </button>
        </div>
      </div>
    </div>
  )
}
