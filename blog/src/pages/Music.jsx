import { useEffect, useRef, useState } from 'react'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import { Music as MusicIcon, Headphones, Loader2, ListMusic } from 'lucide-react'
import { GlassCard } from '../components/ui'
import { useNeteaseSongs } from '../hooks/useNeteaseSongs'
import { DEFAULT_COVER } from '../utils/content'

// 音乐页：APlayer 嵌入式播放器 + 歌单列表
// 数据源：admin server 端网易云代理 /api/netease/songs（已选歌单合并去重）
export default function Music() {
  const containerRef = useRef(null)
  const apRef = useRef(null)
  const { songs, loading, source } = useNeteaseSongs()
  const [activeIdx, setActiveIdx] = useState(-1)

  // 歌曲列表变化时重建 APlayer
  useEffect(() => {
    if (!containerRef.current || loading || songs.length === 0) return

    const ap = new APlayer({
      container: containerRef.current,
      mini: false,
      autoplay: false,
      theme: '#8B5CF6',
      loop: 'all',
      order: 'list',
      volume: 0.6,
      mutex: true,
      lrcType: 0,
      listFolded: false,
      audio: songs.map((s) => ({
        name: s.name,
        artist: s.artist,
        url: s.url,
        cover: s.coverUrl || DEFAULT_COVER,
      })),
    })
    apRef.current = ap
    ap.on('listswitch', (idx) => setActiveIdx(typeof idx === 'number' ? idx : -1))

    return () => {
      try {
        ap.destroy()
      } catch {
        /* noop */
      }
      apRef.current = null
    }
  }, [loading, songs])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
          <MusicIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">音乐</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">那些单曲循环过的旋律</p>
        </div>
      </header>

      {/* 主播放器卡片 */}
      <GlassCard className="overflow-hidden p-0">
        <div className="relative bg-gradient-to-tr from-primary/10 to-pink-500/10 p-6 md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">正在播放</h2>
            {source === 'netease' && songs.length > 0 && (
              <span className="ml-auto rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-300">
                {songs.length} 首
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载歌单中…
            </div>
          ) : songs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/40 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10">
              暂无可用歌曲
              <p className="mt-2 text-xs text-slate-400">
                请在 admin 控制台完成网易云扫码授权并勾选要展示的歌单
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/40 shadow-glass dark:border-white/10">
              <div ref={containerRef} />
            </div>
          )}
        </div>
      </GlassCard>

      {/* 歌单列表 */}
      {songs.length > 0 && (
        <GlassCard className="p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <ListMusic className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">歌单列表</h3>
          </div>
          <ul className="space-y-1">
            {songs.map((s, i) => (
              <li
                key={`${s.id}-${i}`}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  i === activeIdx
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'hover:bg-white/40 dark:hover:bg-white/5'
                }`}
                onClick={() => {
                  try {
                    apRef.current?.setMode('normal')
                    apRef.current?.play(i)
                  } catch {
                    /* noop */
                  }
                }}
              >
                <span className="w-6 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                {s.coverUrl ? (
                  <img
                    src={assetUrl(s.coverUrl)}
                    alt={s.name}
                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-tr from-slate-400 to-slate-500 text-white">
                    <MusicIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{s.name}</p>
                  <p className="truncate text-xs text-slate-400">{s.artist || '未知歌手'}</p>
                </div>
                {s.album && (
                  <span className="hidden shrink-0 truncate text-xs text-slate-400 sm:block sm:max-w-[8rem]">
                    {s.album}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  )
}
