import { useParams, Link } from 'react-router-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import {
  ArrowLeft,
  Calendar,
  FileQuestion,
  List,
  Tag,
  ImagePlus,
  Trash2,
  Loader2,
  Pencil,
  Shuffle,
  Crop,
  Check,
} from 'lucide-react'
import 'highlight.js/styles/github-dark.css'
import { GlassCard, Skeleton, Modal, CommentSection, toast } from '../components/ui'
import { useDiaries } from '../hooks/useDiaries'
import { useDiaryCovers, computeCoverStyle, normalizeArea16x9 } from '../hooks/useDiaryCovers'

// 日记详情页：Markdown 渲染 + 右侧 TOC + 图片懒加载 + 封面上传/替换/随机抽取/区域选择
export default function DiaryDetail() {
  const { slug } = useParams()
  const { diaries, loading } = useDiaries()
  const {
    coverFullMap,
    uploadedMap,
    pickedMap,
    areaMap,
    ratios,
    hasPhotoForDate,
    uploadCover,
    removeCover,
    randomCover,
    resetPicked,
    setCoverArea,
    resetCoverArea,
  } = useDiaryCovers(diaries)
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)
  const fileInputRef = useRef(null)

  const diary = useMemo(
    () => diaries.find((d) => d.slug === slug),
    [diaries, slug],
  )

  // 详情页用原图（coverFullMap），避免模糊
  const currentCover = slug ? coverFullMap[slug] || '' : ''
  const isUploaded = !!(slug && uploadedMap[slug])
  const isPicked = !!(slug && pickedMap[slug])
  // 展示区域统一归一化为 16:9（旧自由比例区域 → 16:9 cover 语义，不裁剪不拉伸）；
  // 取景框打开时显示同一归一化区域，与封面实际展示一致（所见即所得）
  const currentArea = slug ? normalizeArea16x9(areaMap[slug]) : null
  // 传原图比例做 cover 等比渲染：0.75 竖图取景内容不拉伸变形
  const coverStyle = computeCoverStyle(currentArea, ratios[currentCover])
  // 封面容器统一 16:9（取景框固定 16:9，归一化后任意比例区域都在 16:9 容器中展示）
  const coverRatio = 16 / 9
  // 仅当未上传自定义封面、且当日有照片时可「换一张」
  const canShuffle = !!slug && !isUploaded && hasPhotoForDate(slug)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file || !slug) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('图片不能超过 8MB')
      return
    }
    setUploading(true)
    try {
      await uploadCover(slug, file)
      toast.success('封面已更新')
    } catch (err) {
      toast.error(err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!slug) return
    setUploading(true)
    try {
      await removeCover(slug)
      toast.success('已移除自定义封面')
    } catch (err) {
      toast.error(err.message || '移除失败')
    } finally {
      setUploading(false)
    }
  }

  const handleShuffle = async () => {
    if (!slug) return
    setPicking(true)
    try {
      await randomCover(slug)
      toast.success('已换一张')
    } catch (err) {
      toast.error(err.message || '抽取失败')
    } finally {
      setPicking(false)
    }
  }

  const handleResetPicked = async () => {
    if (!slug) return
    setPicking(true)
    try {
      await resetPicked(slug)
      toast.success('已恢复默认封面')
    } catch (err) {
      toast.error(err.message || '重置失败')
    } finally {
      setPicking(false)
    }
  }

  const handleSaveArea = async (transform) => {
    if (!slug) return
    try {
      await setCoverArea(slug, transform)
      toast.success('展示区域已保存')
      setAreaOpen(false)
    } catch (err) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleResetArea = async () => {
    if (!slug) return
    try {
      await resetCoverArea(slug)
      toast.success('已恢复默认展示')
    } catch (err) {
      toast.error(err.message || '清除失败')
    }
  }

  // 从正文提取 ## 二级标题作为 TOC
  const toc = useMemo(() => {
    if (!diary?.body) return []
    const lines = diary.body.split(/\r?\n/)
    const result = []
    for (const line of lines) {
      const m = line.match(/^##\s+(.+?)\s*$/)
      if (m) {
        const text = m[1].trim()
        const id = slugifyHeading(text)
        result.push({ text, id })
      }
    }
    return result
  }, [diary])

  // 加载中
  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link
          to="/diaries"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:gap-2.5 dark:text-primary-lighter"
        >
          <ArrowLeft className="h-4 w-4" /> 返回日记列表
        </Link>
        <GlassCard className="p-6 md:p-10">
          <div className="space-y-3">
            <Skeleton width="60%" height={28} />
            <Skeleton width="30%" height={14} />
            <Skeleton height={220} rounded="rounded-xl" className="mt-4" />
            <Skeleton width="95%" height={14} />
            <Skeleton width="80%" height={14} />
          </div>
        </GlassCard>
      </div>
    )
  }

  // 未找到日记
  if (!diary) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link
          to="/diaries"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:gap-2.5 dark:text-primary-lighter"
        >
          <ArrowLeft className="h-4 w-4" /> 返回日记列表
        </Link>
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <FileQuestion className="h-10 w-10 text-primary/60" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            没有找到这篇日记
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            它可能已被移除，或链接有误。
          </p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
      {/* 主体内容 */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="min-w-0 flex-1"
      >
        <Link
          to="/diaries"
          className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:gap-2.5 dark:text-primary-lighter"
        >
          <ArrowLeft className="h-4 w-4" /> 返回日记列表
        </Link>

        <GlassCard className="overflow-hidden p-0">
          {/* 封面：有则显示图片并可替换；无则显示上传占位区 */}
          {currentCover ? (
            <div
              className="group relative w-full overflow-hidden"
              style={{ aspectRatio: coverRatio }}
            >
              {/* 用 background 展示，支持取景框区域选取 */}
              <div
                className="h-full w-full bg-no-repeat"
                style={{
                  backgroundImage: `url(${currentCover})`,
                  backgroundSize: coverStyle.backgroundSize,
                  backgroundPosition: coverStyle.backgroundPosition,
                }}
                role="img"
                aria-label={diary.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* 操作按钮组：上传/替换 + 换一张 + 选取区域 + 移除/重置 */}
              <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || picking}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/70 disabled:opacity-50"
                  title={isUploaded ? '替换封面' : '上传自定义封面'}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                  {isUploaded ? '替换' : '上传'}
                </button>

                {/* 换一张：从当日照片墙随机抽取并持久化 */}
                {canShuffle && (
                  <button
                    type="button"
                    onClick={handleShuffle}
                    disabled={uploading || picking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/40 bg-sky-500/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-sky-500/60 disabled:opacity-50"
                    title="从当日照片中随机换一张"
                  >
                    {picking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Shuffle className="h-3.5 w-3.5" />
                    )}
                    换一张
                  </button>
                )}

                {/* 调整展示区域 */}
                <button
                  type="button"
                  onClick={() => setAreaOpen(true)}
                  disabled={uploading || picking}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors disabled:opacity-50 ${
                    currentArea
                      ? 'border-emerald-300/50 bg-emerald-500/40 hover:bg-emerald-500/60'
                      : 'border-violet-300/40 bg-violet-500/40 hover:bg-violet-500/60'
                  }`}
                  title="调整封面展示区域"
                >
                  <Crop className="h-3.5 w-3.5" />
                  调整区域
                </button>

                {/* 已上传 → 移除自定义；已抽取 → 恢复默认 seed */}
                {isUploaded && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={uploading || picking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/40 bg-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-rose-500/60 disabled:opacity-50"
                    title="移除自定义封面"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {!isUploaded && isPicked && (
                  <button
                    type="button"
                    onClick={handleResetPicked}
                    disabled={uploading || picking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/40 bg-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-rose-500/60 disabled:opacity-50"
                    title="恢复默认封面"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 区域提示标记 */}
              {currentArea && (currentArea.width < 0.999 || currentArea.height < 0.999) && (
                <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-md bg-emerald-500/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                  <Crop className="h-3 w-3" /> 已选区域
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 border-b border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition-colors hover:bg-slate-100/60 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
              <span className="text-sm font-medium">
                {uploading ? '上传中...' : '上传日记封面'}
              </span>
              <span className="text-[11px] text-slate-400">
                没有匹配到当日照片，可手动上传一张
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />

          {/* 标题与日期 */}
          <div className="p-6 md:p-10">
            <h1 className="gradient-text text-3xl font-bold leading-tight sm:text-4xl">
              {diary.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {diary.date && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> {diary.date}
                </span>
              )}
              {diary.tags && diary.tags.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {diary.tags.map((t) => (
                    <Link
                      key={t}
                      to="/diaries"
                      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 dark:text-primary-lighter"
                    >
                      # {t}
                    </Link>
                  ))}
                </span>
              )}
            </div>

            {/* Markdown 正文（题记已并入正文，不再单独显示） */}
            <div className="diary-prose mt-8">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                  // 图片懒加载 + 圆角阴影
                  img: (props) => (
                    <img
                      {...props}
                      loading="lazy"
                      className="my-4 rounded-xl border border-white/30 shadow-glass dark:border-white/10"
                    />
                  ),
                  // 为标题生成 id 便于 TOC 跳转
                  h2: ({ children, ...props }) => {
                    const text = String(children)
                    return (
                      <h2 id={slugifyHeading(text)} className="scroll-mt-24" {...props}>
                        {children}
                      </h2>
                    )
                  },
                  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {diary.body || ''}
              </ReactMarkdown>
            </div>
          </div>
        </GlassCard>

        {/* 评论区 */}
        <GlassCard className="mt-6 p-5 md:p-8">
          <CommentSection targetType="diary" targetId={slug} title="日记评论" />
        </GlassCard>
      </motion.article>

      {/* 封面展示区域选择器 */}
      <Modal
        open={areaOpen}
        onClose={() => setAreaOpen(false)}
        title="调整封面展示区域"
        className="max-w-3xl"
      >
        {currentCover && (
          <CoverAreaPicker
            src={currentCover}
            initialArea={currentArea}
            onSave={handleSaveArea}
            onReset={currentArea ? handleResetArea : undefined}
            onClose={() => setAreaOpen(false)}
          />
        )}
      </Modal>

      {/* 右侧 TOC（仅桌面端显示） */}
      {toc.length > 0 && (
        <aside className="hidden w-60 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <GlassCard className="p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <List className="h-4 w-4 text-primary" /> 目录
              </div>
              <nav className="flex flex-col gap-2">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block truncate rounded-md px-2 py-1 text-sm text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary dark:text-slate-300 dark:hover:text-primary-lighter"
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </GlassCard>
          </div>
        </aside>
      )}
    </div>
  )
}

/**
 * 把标题文本转成可用的锚点 id（保留中文，替换空格与特殊字符）
 */
function slugifyHeading(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '')
}

/**
 * 封面展示区域选择器（固定宽高比取景框模式）
 * 背景完整显示原图（contain），取景框宽高比固定 16:9：可整体拖动、可滑动调整大小。
 * 保存 area: { x, y, width, height }（0-1 比例，相对于原图）
 *
 * 列表页 / 详情页封面容器会按 area 的宽高比自适应（aspect-ratio），
 * 因此取景框内看到的内容即封面最终效果 —— 四个视图（取景框、下方预览、
 * 列表页封面、详情页封面）完全同步，原比例显示、不缩放不变形。
 */
function CoverAreaPicker({ src, initialArea, onSave, onReset, onClose }) {
  const TARGET_RATIO = 16 / 9
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

  // 初始 area → 取景框（打开时显示已保存的区域）
  useEffect(() => {
    if (initialArea && initialArea.width > 0) {
      setFrameX(initialArea.x)
      setFrameY(initialArea.y)
      setFrameScale(Math.max(initialArea.width, initialArea.height))
    }
  }, [initialArea])

  // 测量 stage 尺寸，计算原图 contain 显示区域
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

  // 取景框像素尺寸（保持 16:9，限制在原图显示区内）
  const framePx = useMemo(() => {
    if (imgBox.w <= 0 || imgBox.h <= 0) return { w: 0, h: 0 }
    let fw, fh
    const maxW = imgBox.w
    const maxH = imgBox.h
    if (TARGET_RATIO >= maxW / maxH) {
      fw = maxW * frameScale
      fh = fw / TARGET_RATIO
      if (fh > maxH) {
        fh = maxH
        fw = fh * TARGET_RATIO
      }
    } else {
      fh = maxH * frameScale
      fw = fh * TARGET_RATIO
      if (fw > maxW) {
        fw = maxW
        fh = fw / TARGET_RATIO
      }
    }
    return { w: fw, h: fh }
  }, [imgBox, frameScale])

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

  // 预览样式：与封面展示完全一致 —— 传入原图比例做 cover 等比渲染，
  // 取景框内容按原比例放大铺满 16:9 预览容器，不拉伸变形
  const imgRatio = imgNatural.w && imgNatural.h ? imgNatural.w / imgNatural.h : null
  const previewStyle = currentArea
    ? imgRatio
      ? (() => {
          const C = TARGET_RATIO
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
    if (!currentArea) {
      toast.info('请先选取区域')
      return
    }
    setSaving(true)
    try {
      await onSave(currentArea)
    } catch (err) {
      toast.error(err.message || '保存失败')
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
      <p className="text-xs text-slate-500 dark:text-slate-400">
        拖动取景框移动位置，滑动下方滑块调整大小。取景框比例固定 16:9，预览与封面实际效果完全一致 —— 不缩放不变形。
      </p>

      {/* 舞台：完整显示原图 + 固定比例取景框 */}
      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900/95 dark:border-white/10"
        style={{ height: 'min(50vh, 400px)' }}
      >
        <img
          src={src}
          alt="选取区域"
          className="pointer-events-none absolute select-none"
          style={{
            left: imgBox.x,
            top: imgBox.y,
            width: imgBox.w,
            height: imgBox.h,
          }}
          draggable={false}
        />

        {framePx.w > 0 && (
          <div
            className="absolute cursor-grab border-2 border-primary bg-transparent active:cursor-grabbing"
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
            {/* 中心辅助线 */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/50" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-primary/50" />
            <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
              拖动移动 · 滑块缩放
            </span>
          </div>
        )}
      </div>

      {/* 取景框大小滑块 */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">取景框大小</span>
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
          className="h-1.5 w-48 cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary dark:bg-white/10"
        />
        <span className="w-8 text-xs font-mono text-slate-400">{Math.round(frameScale * 100)}%</span>
      </div>

      {/* 预览：宽高比与取景框完全一致，即封面最终效果 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          预览（与封面实际展示效果完全一致）：
        </span>
        <div
          className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          style={{ aspectRatio: TARGET_RATIO }}
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
            <div className="grid h-full place-items-center text-xs text-slate-400">加载中...</div>
          )}
        </div>
      </div>

      {/* 操作按钮 - 粘在底部 */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-200/50 bg-white/80 pt-3 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/80">
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !previewStyle}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-tr from-primary to-primary-lighter px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            确定保存
          </button>
        </div>
      </div>
    </div>
  )
}
