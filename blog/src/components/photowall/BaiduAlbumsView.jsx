import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Cloud, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { GlassCard, Skeleton } from '../ui'
import { useBaiduAlbums, useBaiduAlbumPhotos } from '../../hooks/usePhotos'
import PhotoThumb from './PhotoThumb'

/**
 * 网盘照片视图：相册卡片列表（三张叠放风格）→ 点击进入相册瀑布流详情
 * 参考 XinghuisamaBlogs 相册卡片：三张照片倾斜叠放，悬浮放大+旋转加剧
 */
export default function BaiduAlbumsView({ onPhotoClick }) {
  const { albums, loading, error } = useBaiduAlbums()
  const [selectedAlbum, setSelectedAlbum] = useState(null)

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        onBack={() => setSelectedAlbum(null)}
        onPhotoClick={onPhotoClick}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton height={28} width={200} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={220} rounded="rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || albums.length === 0) {
    const isTimeout = /超时|aborted/i.test(error || '')
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-aurora-pink/30 text-primary">
          <Cloud className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          {error ? (isTimeout ? '网盘目录拉取超时' : '网盘连接失败') : '暂无网盘相册'}
        </h2>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          {error
            ? isTimeout
              ? `${error}。首次拉取需遍历所有相册目录（约 30-40s），admin 可能仍在后台处理，请稍等片刻刷新重试。`
              : `请确认 admin 本地服务已启动并已扫码授权百度网盘。(${error})`
            : '请在 admin 后台授权百度网盘后查看云端相册。'}
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <Cloud className="h-5 w-5 text-primary" />
        <span className="text-sm text-slate-600 dark:text-slate-300">
          共 {albums.length} 个相册 · {albums.reduce((s, a) => s + (a.count || 0), 0).toLocaleString()} 张照片
        </span>
      </div>

      {/* 相册卡片网格 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album, i) => (
          <AlbumCard key={album.path || i} album={album} index={i} onClick={() => setSelectedAlbum(album)} />
        ))}
      </div>
    </div>
  )
}

/**
 * 单个相册卡片：三张照片叠放（用封面图模拟），悬浮放大+旋转
 */
function AlbumCard({ album, index, onClick }) {
  const [coverError, setCoverError] = useState(false)
  const cover = album.coverUrl || ''

  // 三张叠放：中间为正封面，左右两张倾斜偏移
  const layers = [
    { rotate: -6, x: -22, y: 6, z: 10, opacity: 0.7 },
    { rotate: 0, x: 0, y: 0, z: 30, opacity: 1 },
    { rotate: 6, x: 22, y: 6, z: 20, opacity: 0.85 },
  ]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col items-center focus:outline-none"
    >
      {/* 叠放照片区 */}
      <div className="relative h-52 w-full">
        {coverError ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-aurora-pink/20 to-primary-light/25">
            <ImageIcon className="h-10 w-10 text-primary/50" />
          </div>
        ) : (
          layers.map((layer, li) => (
            <div
              key={li}
              className="absolute left-1/2 top-1/2 h-44 w-36 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/30 shadow-lg transition-all duration-500 group-hover:scale-105 dark:border-white/10"
              style={{
                transform: `translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px)) rotate(${layer.rotate}deg)`,
                zIndex: layer.z,
                opacity: layer.opacity,
              }}
            >
              <img
                src={cover}
                alt={album.name}
                loading="lazy"
                onError={() => li === 1 && setCoverError(true)}
                className="h-full w-full object-cover"
              />
            </div>
          ))
        )}
      </div>

      {/* 相册信息 */}
      <div className="mt-2 flex w-full flex-col items-center gap-1 rounded-2xl border border-white/40 bg-white/50 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-white/10">
        <h3 className="line-clamp-1 text-center text-base font-bold text-slate-800 dark:text-slate-100">
          {album.name}
        </h3>
        <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary-dark dark:text-primary-lighter">
          {album.count} 张
        </span>
      </div>
    </motion.button>
  )
}

/**
 * 相册详情：返回按钮 + 标题 + 瀑布流照片
 */
function AlbumDetail({ album, onBack, onPhotoClick }) {
  const { photos, loading } = useBaiduAlbumPhotos(album.path)

  const sortedPhotos = useMemo(() => {
    // 按 mtime 倒序（最新在前）
    return [...photos].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }, [photos])

  return (
    <div className="flex flex-col gap-5">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/40 bg-white/50 text-slate-600 backdrop-blur-md transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
          title="返回相册列表"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col gap-0.5">
          <h2 className="gradient-text text-2xl font-bold tracking-tight sm:text-3xl">
            {album.name}
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {album.count} 张照片
          </span>
        </div>
      </div>

      {loading ? (
        <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={160 + (i % 3) * 40} rounded="rounded-xl" />
          ))}
        </div>
      ) : sortedPhotos.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">该相册暂无可显示的照片</p>
        </GlassCard>
      ) : (
        <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
          {sortedPhotos.map((p, i) => (
            <PhotoThumb
              key={p.id || i}
              photo={p}
              onClick={() => onPhotoClick?.(sortedPhotos, i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
