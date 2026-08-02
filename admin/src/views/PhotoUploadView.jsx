import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Camera,
  Calendar,
  Trash2,
  Cloud,
  Server,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import {
  getAuthStatus,
  getValidAccessToken,
  uploadFile,
  createShare,
  hasBaiduCredentials,
  PHOTO_DIR,
} from '../api'
import { extractExif } from '../utils/exif'
import { reverseGeocode } from '../utils/geocode'
import { generateThumbnail } from '../utils/thumbnail'
import {
  buildPhotoEntry,
  generatePhotoId,
} from '../utils/photoManifest'
import {
  listPhotos,
  savePhotosManifest,
  uploadThumbnail,
} from '../api/contentApi'

/** 单张照片的处理状态 */
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
}

/** 通用按钮 */
function ActionButton({ icon: Icon, label, onClick, disabled, loading, variant = 'primary' }) {
  const variants = {
    primary: 'bg-gradient-to-r from-primary to-aurora-pink text-white shadow-glow hover:-translate-y-0.5',
    emerald: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300',
    rose: 'bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-300',
    sky: 'bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-300',
    amber: 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-300',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${variants[variant]}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  )
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (bytes == null) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

export default function PhotoUploadView() {
  const { showToast } = useToast()
  const credentialsReady = hasBaiduCredentials()

  const [authStatus, setAuthStatus] = useState({ authorized: false, loading: true })
  const [queue, setQueue] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  /** 刷新百度授权状态 */
  const refreshAuthStatus = useCallback(async () => {
    setAuthStatus({ authorized: false, loading: true })
    try {
      const status = await getAuthStatus()
      setAuthStatus({ ...status, loading: false })
    } catch {
      setAuthStatus({ authorized: false, loading: false })
    }
  }, [])

  useEffect(() => {
    refreshAuthStatus()
  }, [refreshAuthStatus])

  /** 文件选择 */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const items = files.map((file) => ({
      id: generatePhotoId(),
      file,
      preview: URL.createObjectURL(file),
      status: STATUS.PENDING,
      statusText: '待处理',
      exif: null,
      entry: null,
      error: null,
    }))
    setQueue((q) => [...q, ...items])
    showToast(`已添加 ${items.length} 张照片`, 'info')
  }

  /** 从队列移除 */
  const handleRemove = (id) => {
    setQueue((q) => {
      const item = q.find((i) => i.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return q.filter((i) => i.id !== id)
    })
  }

  /** 清空已完成 */
  const handleClearDone = () => {
    setQueue((q) => {
      q.forEach((i) => {
        if (i.preview && i.status === STATUS.DONE) URL.revokeObjectURL(i.preview)
      })
      return q.filter((i) => i.status !== STATUS.DONE)
    })
  }

  /** 更新单个队列项 */
  const updateItem = (id, patch) => {
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  /** 处理单张照片 */
  const processOne = async (item, token) => {
    const { id, file } = item
    try {
      // 1. 提取 EXIF
      updateItem(id, { status: STATUS.PROCESSING, statusText: '提取 EXIF…' })
      const exif = await extractExif(file)

      // 2. 逆地理编码
      let location = null
      if (exif.gps) {
        updateItem(id, { statusText: '逆地理编码…', exif })
        location = await reverseGeocode(exif.gps.lat, exif.gps.lon)
      }
      updateItem(id, { exif })

      // 3. 生成缩略图
      updateItem(id, { statusText: '生成缩略图…' })
      const thumb = await generateThumbnail(file)

      // 4. 写缩略图到博客仓库（通过 API）
      let thumbPath = ''
      updateItem(id, { statusText: '写入缩略图…' })
      try {
        const result = await uploadThumbnail(`${id}.webp`, thumb.dataUrl)
        thumbPath = result.path || `photos/${id}.webp`
      } catch (err) {
        console.warn('写入缩略图失败：', err)
      }

      // 5. 上传原图到百度网盘 + 生成分享
      let baiduPath = ''
      let shareLink = ''
      if (token) {
        updateItem(id, { statusText: '上传原图到百度网盘…' })
        const remotePath = `${PHOTO_DIR}/${id}_${file.name}`
        const uploadResult = await uploadFile(token, remotePath, file)
        baiduPath = uploadResult.path || remotePath
        if (uploadResult.fs_id) {
          updateItem(id, { statusText: '生成分享链接…' })
          try {
            const shareResp = await createShare(token, uploadResult.fs_id)
            shareLink = shareResp?.shorturl || shareResp?.links?.[0]?.shorturl || ''
          } catch (err) {
            console.warn('生成分享失败：', err)
          }
        }
      }

      // 6. 组装 manifest 项
      const timestamp = Date.now()
      const entry = buildPhotoEntry({
        id,
        thumbPath,
        baiduPath,
        shareLink,
        dateTime: exif.dateTime,
        timestamp,
        gps: exif.gps,
        location,
        camera: exif.camera,
        dimensions: exif.dimensions,
      })

      updateItem(id, {
        status: STATUS.DONE,
        statusText: token ? '上传完成' : '已保存缩略图',
        entry,
      })
      return entry
    } catch (err) {
      updateItem(id, {
        status: STATUS.FAILED,
        statusText: err?.message || '处理失败',
        error: err?.message || '处理失败',
      })
      throw err
    }
  }

  /** 开始上传全部待处理照片 */
  const handleStartUpload = async () => {
    const pending = queue.filter((i) => i.status === STATUS.PENDING)
    if (!pending.length) {
      showToast('没有待处理的照片', 'info')
      return
    }

    setUploading(true)
    let token = null
    if (credentialsReady) {
      try {
        token = await getValidAccessToken()
      } catch {
        token = null
      }
    }

    if (credentialsReady && !token) {
      showToast('未授权百度网盘，将仅保存缩略图到仓库', 'info')
    }

    // 通过 API 加载现有 manifest
    let manifestList = []
    try {
      manifestList = await listPhotos()
    } catch {
      manifestList = []
    }

    let successCount = 0
    let failCount = 0
    for (const item of pending) {
      try {
        const entry = await processOne(item, token)
        if (entry) {
          manifestList.push(entry)
          successCount++
        }
      } catch {
        failCount++
      }
    }

    // 通过 API 写回 manifest
    try {
      await savePhotosManifest(manifestList)
    } catch (err) {
      showToast(`保存 manifest 失败：${err.message}`, 'error')
    }

    setUploading(false)
    if (failCount === 0) {
      showToast(`全部完成，成功 ${successCount} 张`, 'success')
    } else {
      showToast(`成功 ${successCount} 张，失败 ${failCount} 张`, successCount > 0 ? 'info' : 'error')
    }
  }

  const authorized = !!authStatus.authorized
  const pendingCount = queue.filter((i) => i.status === STATUS.PENDING).length
  const doneCount = queue.filter((i) => i.status === STATUS.DONE).length
  const failedCount = queue.filter((i) => i.status === STATUS.FAILED).length

  return (
    <div className="space-y-6">
      {/* 顶部状态卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-md">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">照片上传</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              提取 EXIF、生成缩略图，原图上传至百度网盘并生成分享链接
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 百度授权状态 */}
          <div className="rounded-2xl border border-white/50 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">百度网盘</span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  authorized
                    ? 'bg-emerald-50/70 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-gray-100/70 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                }`}
              >
                {authStatus.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : authorized ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                <span>
                  {authStatus.loading ? '检查中…' : authorized ? '已授权' : '未授权'}
                </span>
              </div>
            </div>
            {!credentialsReady ? (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                未配置凭证，请前往「百度网盘」页配置
              </p>
            ) : !authorized ? (
              <p className="mt-2 text-xs text-gray-400">
                未授权将仅保存缩略图到仓库。请前往「百度网盘」页扫码授权
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-400">原图将上传至 {PHOTO_DIR}</p>
            )}
          </div>

          {/* 后端 API 状态 */}
          <div className="rounded-2xl border border-white/50 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">后端存储</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>已连接</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              缩略图写入 public/photos/，manifest 写入 src/data/
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <ActionButton
            icon={RefreshCw}
            label="刷新状态"
            onClick={refreshAuthStatus}
            variant="sky"
          />
        </div>
      </section>

      {/* 文件选择与上传 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">待上传列表</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                共 {queue.length} 张 · 待处理 {pendingCount} · 成功 {doneCount} · 失败 {failedCount}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              icon={ImageIcon}
              label="选择照片"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant="emerald"
            />
            <ActionButton
              icon={Upload}
              label={uploading ? '上传中…' : '开始上传'}
              onClick={handleStartUpload}
              loading={uploading}
              disabled={uploading || pendingCount === 0}
            />
            {doneCount + failedCount > 0 && (
              <ActionButton
                icon={Trash2}
                label="清空已完成/失败"
                onClick={handleClearDone}
                disabled={uploading}
                variant="rose"
              />
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* 队列列表 */}
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 p-10 text-center dark:border-white/10">
            <ImageIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-400">点击「选择照片」添加图片</p>
            <p className="mt-1 text-xs text-gray-400">支持多选，JPEG / PNG / WebP 等常见格式</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <PhotoQueueItem key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** 单张照片队列项 */
function PhotoQueueItem({ item, onRemove }) {
  const { id, file, preview, status, statusText, exif, error } = item

  const statusConfig = {
    [STATUS.PENDING]: {
      badge: 'bg-gray-100/70 text-gray-500 dark:bg-white/10 dark:text-gray-400',
      Icon: null,
    },
    [STATUS.PROCESSING]: {
      badge: 'bg-sky-50/70 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
      Icon: Loader2,
      spin: true,
    },
    [STATUS.DONE]: {
      badge: 'bg-emerald-50/70 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
      Icon: CheckCircle2,
    },
    [STATUS.FAILED]: {
      badge: 'bg-rose-50/70 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
      Icon: AlertCircle,
    },
  }
  const cfg = statusConfig[status] || statusConfig[STATUS.PENDING]
  const Icon = cfg.Icon

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/40 p-3 dark:border-white/10 dark:bg-white/5">
      {/* 缩略图预览 */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
        {preview ? (
          <img src={preview} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ImageIcon className="h-6 w-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
            {file.name}
          </p>
          <button
            onClick={() => onRemove(id)}
            disabled={status === STATUS.PROCESSING}
            className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="移除"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>{formatSize(file.size)}</span>
          {exif?.dateTime && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(exif.dateTime).toLocaleString('zh-CN')}
            </span>
          )}
          {exif?.camera?.make && (
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {[exif.camera.make, exif.camera.model].filter(Boolean).join(' ') || '-'}
            </span>
          )}
          {exif?.gps && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {exif.gps.lat.toFixed(3)}, {exif.gps.lon.toFixed(3)}
            </span>
          )}
          {exif?.dimensions?.width && (
            <span>
              {exif.dimensions.width}×{exif.dimensions.height}
            </span>
          )}
        </div>
        {/* 状态徽章 */}
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
            {Icon && <Icon className={`h-3 w-3 ${cfg.spin ? 'animate-spin' : ''}`} />}
            {statusText}
          </span>
        </div>
      </div>
    </div>
  )
}
