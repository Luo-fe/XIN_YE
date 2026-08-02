import { useEffect, useRef, useState } from 'react'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import { X } from 'lucide-react'
import { useNeteaseSongs } from '../hooks/useNeteaseSongs'

/**
 * 悬浮音乐播放器（APlayer fixed 模式）
 * - 音频源：admin server 端网易云代理 /api/netease/song-mp3/:id（流式透传 audio/mpeg）
 *   · 通过 blog vite 代理转发到 admin:5174，避免浏览器 ORB/CORS
 *   · 未授权或 admin 未启动时返回空列表，播放器不渲染
 * - sessionStorage 记忆「关闭」状态（本次会话不再出现）
 * - APlayer 内置 onerror 自动跳下一首，处理版权受限歌曲
 */

// 统一封面占位（避免逐首请求网易云封面 API 的 CORS 问题）
import { DEFAULT_COVER } from '../utils/content'

export default function FloatingPlayer() {
  const containerRef = useRef(null)
  const apRef = useRef(null)
  const { songs, loading } = useNeteaseSongs()
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem('floating-player-closed') !== '1',
  )

  useEffect(() => {
    if (!visible || !containerRef.current || loading || songs.length === 0) return

    const ap = new APlayer({
      container: containerRef.current,
      fixed: true,
      autoplay: false,
      theme: '#8B5CF6',
      loop: 'all',
      order: 'list',
      volume: 0.6,
      lrcType: 0,
      mutex: true,
      audio: songs.map((s) => ({
        name: s.name,
        artist: s.artist,
        url: s.url,
        cover: s.coverUrl || DEFAULT_COVER,
      })),
    })
    apRef.current = ap

    return () => {
      try {
        ap.destroy()
      } catch {
        /* noop */
      }
      apRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loading, songs])

  if (!visible || loading || songs.length === 0) return null

  const handleClose = () => {
    try {
      apRef.current?.pause()
    } catch {
      /* noop */
    }
    setVisible(false)
    sessionStorage.setItem('floating-player-closed', '1')
  }

  return (
    <>
      {/* APlayer fixed 底栏会挂载到这个容器 */}
      <div ref={containerRef} />

      {/* 关闭按钮：置于 APlayer 底栏右上角上方 */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="关闭播放器"
        title="本次会话关闭播放器"
        className="fixed bottom-[76px] right-2 z-[9998] grid h-7 w-7 place-items-center rounded-full border border-white/40 bg-white/70 text-slate-500 shadow-lg backdrop-blur-md transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </>
  )
}
