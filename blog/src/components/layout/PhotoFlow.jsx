import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ArrowRight } from 'lucide-react'
import { useLocalPhotos } from '../../hooks/usePhotos'

/**
 * 照片流动循环播放：从照片墙随机抽取 20 张照片，水平无限滚动
 * 使用 CSS animation 实现平滑循环，鼠标悬浮暂停
 *
 * 性能优化：manifest（2.9MB）只在组件进入视口后才加载 ——
 * 首页首屏不再下载整份照片数据；从照片墙返回时直接命中共享缓存。
 *
 * @param {object} props
 * @param {number} [props.count=20] - 随机抽取的照片数量
 */
export default function PhotoFlow({ count = 20 }) {
  const [visible, setVisible] = useState(false)
  const wrapRef = useRef(null)

  // 进入视口（提前 300px 预判）后才真正加载照片数据
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      // 不预判：只有照片墙区域真正进入视口才下载 manifest，
      // 首屏在视口内时（桌面端）仍会正常加载
      { rootMargin: '0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapRef}>
      {visible ? (
        <PhotoFlowInner count={count} />
      ) : (
        // 占位：保持高度避免布局跳动，不触发 manifest 下载
        <div className="h-40 overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-primary/15 via-aurora-pink/10 to-primary-light/15 dark:border-white/10" />
      )}
    </div>
  )
}

/** 实际内容：只有进入视口后才会挂载（useLocalPhotos 此时才拉取 manifest） */
function PhotoFlowInner({ count }) {
  const { seasons, loading } = useLocalPhotos()
  const [seed, setSeed] = useState(0)

  // 页面挂载时随机抽取照片；只在 seasons 首次加载完成后抽取一次
  const photos = useMemo(() => {
    if (loading || seasons.length === 0) return []
    // 间隔抽样：从全量照片中等间距取 count 张，再打乱顺序
    const step = Math.max(1, Math.floor(seasons.length / count))
    const picked = []
    for (let i = 0; i < seasons.length && picked.length < count; i += step) {
      picked.push(seasons[i])
    }
    // Fisher-Yates 打乱
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[picked[i], picked[j]] = [picked[j], picked[i]]
    }
    return picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, seasons.length, seed])

  // 复制一份用于无缝循环
  const doubled = useMemo(() => [...photos, ...photos], [photos])

  // loading 完成后触发一次随机（通过 seed 切换）
  useEffect(() => {
    if (!loading && seasons.length > 0 && seed === 0) {
      setSeed(Date.now())
    }
  }, [loading, seasons.length, seed])

  if (loading) {
    return (
      <div className="relative h-40 overflow-hidden rounded-3xl border border-white/40 bg-white/30 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Camera className="h-4 w-4 animate-pulse" /> 正在挑选照片…
        </div>
      </div>
    )
  }

  if (photos.length === 0) {
    return null
  }

  return (
    <Link
      to="/photos"
      className="group relative block overflow-hidden rounded-3xl border border-white/40 shadow-glass backdrop-blur-md transition-all duration-500 hover:shadow-glow dark:border-white/10"
    >
      {/* 标题层 */}
      <div className="absolute left-5 top-5 z-20 flex items-center gap-2 text-white drop-shadow-lg sm:left-6 sm:top-6">
        <Camera className="h-5 w-5" />
        <span className="text-lg font-bold sm:text-xl">照片墙 · 流动时光</span>
      </div>
      <ArrowRight className="absolute right-5 top-5 z-20 h-5 w-5 text-white drop-shadow-lg transition-transform group-hover:translate-x-1 sm:right-6 sm:top-6" />

      {/* 流动照片轨道：两组照片首尾相接，CSS animation 无限滚动 */}
      <div className="photo-flow-track flex h-44 sm:h-52">
        {doubled.map((p, i) => (
          <div
            key={`${p.id || 'p'}-${i}`}
            className="relative h-full w-44 shrink-0 overflow-hidden sm:w-56"
          >
            <img
              src={p.thumbPath || p.url || ''}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* 渐变遮罩，让标题可读 */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/30" />
          </div>
        ))}
      </div>

      {/* 底部渐变 + 提示 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-3 right-5 z-20 text-xs text-white/80 drop-shadow sm:right-6">
        随机展示 {photos.length} 张 · 点击进入照片墙
      </div>

      <style>{`
        @keyframes photo-flow-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .photo-flow-track {
          animation: photo-flow-scroll 40s linear infinite;
          will-change: transform;
        }
        .group:hover .photo-flow-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .photo-flow-track {
            animation: none;
          }
        }
      `}</style>
    </Link>
  )
}
