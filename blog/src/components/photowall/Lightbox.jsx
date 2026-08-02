import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { assetUrl } from '../../utils/assetUrl'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Camera,
  Maximize2,
  MapPin,
  Pencil,
  Check,
  RotateCcw,
  MessageSquare,
  Loader2,
  ImagePlus,
} from 'lucide-react'
import { CommentSection, toast } from '../ui'
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyLock'

/**
 * 照片灯箱：全屏遮罩 + 大图 + EXIF 信息 + 前后切换 / 键盘导航 + 元数据编辑
 * @param {object} props
 * @param {Array} props.photos - 当前灯箱照片列表
 * @param {number} props.index - 当前照片索引
 * @param {function} props.onClose
 * @param {function} props.onIndexChange - (newIndex) => void
 * @param {function} [props.onUpdatePhoto] - (id, patch) => void 保存编辑
 * @param {function} [props.onResetPhoto] - (id) => void 恢复原始值
 * @param {boolean} [props.editable] - 是否开启编辑能力（默认 true）
 */
export default function Lightbox({
  photos,
  index,
  onClose,
  onIndexChange,
  onUpdatePhoto,
  onResetPhoto,
  editable = true,
}) {
  const open = index >= 0 && photos && photos.length > 0
  const photo = open ? photos[index] : null
  const total = photos?.length || 0
  // 0=url（或 thumbPath），1=回退到 thumbPath，2=彻底失败隐藏
  const [fallback, setFallback] = useState(0)
  // 大图是否仍在加载（显示加载指示器）
  const [imgLoading, setImgLoading] = useState(false)
  // 编辑模式开关
  const [editing, setEditing] = useState(false)
  // 评论展开
  const [showComments, setShowComments] = useState(false)
  // 设为背景请求中
  const [backgroundSaving, setBackgroundSaving] = useState(false)

  // 一键设为网站背景（写入后台背景列表，每次打开网站随机抽取）
  const handleSetAsBackground = async () => {
    if (!photo?.url) return
    setBackgroundSaving(true)
    try {
      const resp = await fetch('/api/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: photo.id || '',
          url: photo.url,
          thumbPath: photo.thumbPath || '',
          name: photo.filename || photo.dateTime || '照片墙背景',
        }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      toast.success('已设为网站背景（每次打开随机抽取）')
    } catch (e) {
      toast.error(e.message || '设置背景失败，请确认 admin 服务已启动')
    } finally {
      setBackgroundSaving(false)
    }
  }

  // 切换照片时重置回退状态、加载指示与编辑模式
  useEffect(() => {
    setFallback(0)
    setImgLoading(true)
    setEditing(false)
    setShowComments(false)
  }, [photo?.id, index])

  // 大图优先级：本地原图（dev）→ 网盘原图（线上代理）→ 缩略图
  const primarySrc = assetUrl(photo?.url) || photo?.baiduUrl || assetUrl(photo?.thumbPath) || ''
  // fallback 1 取候选源里第一个与 primary 不同的（失败时逐级降级）
  const candidates = [assetUrl(photo?.url), photo?.baiduUrl, assetUrl(photo?.thumbPath)].filter(Boolean)
  const secondarySrc = candidates.find((c) => c !== primarySrc) || ''
  const imgSrc = fallback === 0 ? primarySrc : fallback === 1 ? secondarySrc : ''

  // 预加载下一张大图（当前张空闲后后台取一张），←/→ 翻页时几乎无等待
  useEffect(() => {
    if (!open || !photos || photos.length < 2) return
    const nextPhoto = photos[(index + 1) % photos.length]
    const src = assetUrl(nextPhoto?.url) || assetUrl(nextPhoto?.thumbPath) || ''
    if (!src) return
    const img = new Image()
    img.src = src
  }, [open, index, photos])

  const prev = useCallback(() => {
    if (!open) return
    onIndexChange?.((index - 1 + total) % total)
  }, [open, index, total, onIndexChange])

  const next = useCallback(() => {
    if (!open) return
    onIndexChange?.((index + 1) % total)
  }, [open, index, total, onIndexChange])

  const onCloseByKey = useCallback(() => onClose?.(), [onClose])

  // 键盘导航：← 上一张 / → 下一张 / ESC 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false)
        } else {
          onCloseByKey()
        }
      } else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    // 引用计数式滚动锁：与移动菜单/模态框同时打开时互不干扰
    lockBodyScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockBodyScroll()
    }
  }, [open, prev, next, onCloseByKey, editing])

  const handleSave = (patch) => {
    if (photo?.id && onUpdatePhoto) {
      onUpdatePhoto(photo.id, patch)
    }
    setEditing(false)
  }

  const handleReset = () => {
    if (photo?.id && onResetPhoto) {
      onResetPhoto(photo.id)
    }
    setEditing(false)
  }

  return (
    <AnimatePresence>
      {open && photo && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 上一张 */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="上一张"
              className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white sm:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* 下一张 */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="下一张"
              className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white sm:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* 内容区：大图 + EXIF */}
          <motion.div
            key={photo.id || index}
            className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 大图：加载中显示旋转指示，避免切换时看起来卡住 */}
            <div className="relative">
              {imgLoading && fallback < 2 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                </div>
              )}
              <img
                src={imgSrc}
                alt="照片大图"
                className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  setFallback((s) => s + 1)
                  setImgLoading(false)
                }}
                style={fallback >= 2 ? { display: 'none' } : undefined}
              />
            </div>

            {/* EXIF 信息条 + 编辑入口 */}
            <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/85 backdrop-blur-md sm:text-sm">
              {photo.dateTime && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary-lighter" />
                  {photo.dateTime}
                </span>
              )}
              {photo.camera?.make && (
                <span className="inline-flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-primary-lighter" />
                  {photo.camera.make}
                  {photo.camera.model ? ` · ${photo.camera.model}` : ''}
                </span>
              )}
              {photo.dimensions?.width && (
                <span className="inline-flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5 text-primary-lighter" />
                  {photo.dimensions.width}×{photo.dimensions.height}
                </span>
              )}
              {photo.location?.province && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary-lighter" />
                  {[photo.location.province, photo.location.city, photo.location.district]
                    .filter((p, i, arr) => p && p !== arr[i - 1])
                    .join(' · ')}
                </span>
              )}
              {photo.shareLink && (
                <a
                  href={photo.shareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/20 px-2.5 py-1 font-medium text-white transition-colors hover:bg-primary/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  查看原图
                </a>
              )}
              {editable && onUpdatePhoto && (
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                    editing
                      ? 'border-amber-400/50 bg-amber-500/30 text-amber-100'
                      : 'border-white/30 bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {editing ? '编辑中' : '编辑'}
                </button>
              )}
              {/* 一键设为网站背景（仅本地照片，可多张，每次打开随机抽取） */}
              {editable && photo.url && (
                <button
                  type="button"
                  onClick={handleSetAsBackground}
                  disabled={backgroundSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/25 px-2.5 py-1 font-medium text-white transition-colors hover:bg-emerald-500/40 disabled:opacity-60"
                >
                  {backgroundSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {backgroundSaving ? '设置中…' : '设为背景'}
                </button>
              )}
            </div>

            {/* 编辑表单 */}
            <AnimatePresence>
              {editing && editable && (
                <PhotoEditForm
                  key={`edit-${photo.id}`}
                  photo={photo}
                  onSave={handleSave}
                  onCancel={() => setEditing(false)}
                  onReset={onResetPhoto ? handleReset : undefined}
                />
              )}
            </AnimatePresence>

            {/* 评论按钮 */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                showComments
                  ? 'border-primary/50 bg-primary/30 text-primary-lighter'
                  : 'border-white/30 bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {showComments ? '收起评论' : '评论'}
            </button>

            {/* 评论区 */}
            <AnimatePresence>
              {showComments && photo?.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 max-h-60 overflow-y-auto rounded-xl bg-black/20 p-3">
                    <CommentSection targetType="photo" targetId={photo.id} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 计数 */}
            {total > 1 && (
              <div className="text-xs text-white/60">
                {index + 1} / {total}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 照片元数据编辑表单
 * - 拍摄时间（dateTime）
 * - 地点（省 / 市 / 区县）
 * - GPS（纬度 / 经度）
 * 保存时仅传变更字段，由上层合并到 localStorage
 */
function PhotoEditForm({ photo, onSave, onCancel, onReset }) {
  const loc = photo.location || {}
  const gps = photo.gps || {}
  const [dateTime, setDateTime] = useState(photo.dateTime || '')
  const [province, setProvince] = useState(loc.province || '')
  const [city, setCity] = useState(loc.city || '')
  const [district, setDistrict] = useState(loc.district || '')
  const [lat, setLat] = useState(gps.lat != null ? String(gps.lat) : '')
  const [lon, setLon] = useState(gps.lon != null ? String(gps.lon) : '')

  // 切换到不同照片时重置表单
  useEffect(() => {
    const l = photo.location || {}
    const g = photo.gps || {}
    setDateTime(photo.dateTime || '')
    setProvince(l.province || '')
    setCity(l.city || '')
    setDistrict(l.district || '')
    setLat(g.lat != null ? String(g.lat) : '')
    setLon(g.lon != null ? String(g.lon) : '')
  }, [photo.id, photo.dateTime, photo.location, photo.gps])

  const handleSubmit = (e) => {
    e.preventDefault()
    const patch = {}
    if (dateTime !== (photo.dateTime || '')) patch.dateTime = dateTime.trim()
    const newLoc = {
      ...(province !== (loc.province || '') ? { province: province.trim() } : {}),
      ...(city !== (loc.city || '') ? { city: city.trim() } : {}),
      ...(district !== (loc.district || '') ? { district: district.trim() } : {}),
    }
    if (Object.keys(newLoc).length > 0) patch.location = { ...loc, ...newLoc }
    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)
    const newGps = {}
    if (!Number.isNaN(latNum)) newGps.lat = latNum
    if (!Number.isNaN(lonNum)) newGps.lon = lonNum
    const oldLat = gps.lat
    const oldLon = gps.lon
    if (lat === '' && lon === '') {
      patch.gps = null
    } else if (
      (!Number.isNaN(latNum) && latNum !== oldLat) ||
      (!Number.isNaN(lonNum) && lonNum !== oldLon)
    ) {
      patch.gps = { lat: Number.isNaN(latNum) ? null : latNum, lon: Number.isNaN(lonNum) ? null : lonNum }
    }
    onSave(patch)
  }

  const inputCls =
    'w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-primary/60 focus:bg-white/15'
  const labelCls = 'flex flex-col gap-1 text-xs text-white/70'

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="w-full overflow-hidden rounded-2xl border border-amber-300/30 bg-black/40 px-4 py-4 backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* 拍摄时间 */}
        <label className={`${labelCls} sm:col-span-2 lg:col-span-1`}>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 拍摄时间
          </span>
          <input
            type="text"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            placeholder="YYYY-MM-DD HH:mm:ss"
            className={inputCls}
          />
        </label>

        {/* GPS 纬度 */}
        <label className={labelCls}>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> 纬度 (lat)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="如 30.2741"
            className={inputCls}
          />
        </label>

        {/* GPS 经度 */}
        <label className={labelCls}>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> 经度 (lon)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="如 120.1551"
            className={inputCls}
          />
        </label>

        {/* 省 */}
        <label className={labelCls}>
          <span>省 / 自治区</span>
          <input
            type="text"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="如 浙江省"
            className={inputCls}
          />
        </label>

        {/* 市 */}
        <label className={labelCls}>
          <span>市</span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="如 杭州市"
            className={inputCls}
          />
        </label>

        {/* 区县 */}
        <label className={labelCls}>
          <span>区 / 县</span>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="如 西湖区"
            className={inputCls}
          />
        </label>
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="清除该照片的本地编辑，恢复 manifest 原值"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            恢复原值
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          取消
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-aurora-pink px-4 py-1.5 text-xs font-bold text-white shadow-glow transition-transform hover:-translate-y-0.5"
        >
          <Check className="h-3.5 w-3.5" />
          保存
        </button>
      </div>
      <p className="mt-2 text-[10px] text-white/40">
        编辑结果保存在浏览器本地（localStorage），下次访问自动生效；不会修改服务器数据。
      </p>
    </motion.form>
  )
}
