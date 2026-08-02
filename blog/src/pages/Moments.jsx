import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, MessageSquare, Sticker, Clock, Search, ArrowDownAZ, ArrowUpZA, Ghost, MapPin } from 'lucide-react'
import { GlassCard, Modal, CommentSection, MarkdownText } from '../components/ui'
import ImageGallery from '../components/ImageGallery'
import { getAuthorStyle, timeAgo } from '../utils/content'
import momentsData from '../data/moments.json'

// 碎碎念页：搜索栏 + 排序 + 信息流卡片（双列瀑布流）
export default function Moments() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [commentMoment, setCommentMoment] = useState(null)

  const processed = useMemo(() => {
    let result = [...momentsData]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (m) =>
          (m.text || '').toLowerCase().includes(q) ||
          (m.location || '').toLowerCase().includes(q),
      )
    }
    result.sort((a, b) => {
      const ta = new Date(a.datetime).getTime()
      const tb = new Date(b.datetime).getTime()
      return sortOrder === 'desc' ? tb - ta : ta - tb
    })
    return result
  }, [searchQuery, sortOrder])

  return (
    <div className="flex flex-col gap-6">
      {/* 标题区 */}
      <header className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-text mb-2 text-3xl font-black tracking-tighter sm:text-4xl md:text-5xl"
        >
          碎碎念
        </motion.h1>
        <p className="flex items-center justify-center gap-1.5 text-xs italic text-slate-500 dark:text-slate-400 md:text-sm">
          <Sticker className="h-3.5 w-3.5 text-primary" /> 「 在代码之外捕捉瞬间的温度 」
        </p>
      </header>

      {/* 搜索 + 排序 */}
      <div className="flex flex-col items-center gap-5">
        <div className="group relative w-full max-w-lg">
          <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="搜寻被遗忘的记忆..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-white/40 px-6 py-4 pl-14 text-sm font-medium text-slate-800 shadow-xl backdrop-blur-xl transition-all placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/5 dark:bg-slate-800/40 dark:text-white"
          />
        </div>
        <div className="flex rounded-2xl border border-white/50 bg-white/50 p-1.5 shadow-sm dark:border-white/10 dark:bg-slate-800/50">
          <button
            onClick={() => setSortOrder('desc')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-all duration-300 ${
              sortOrder === 'desc'
                ? 'scale-105 bg-primary text-white shadow-md'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            <ArrowDownAZ className="h-3.5 w-3.5" /> 最新
          </button>
          <button
            onClick={() => setSortOrder('asc')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-all duration-300 ${
              sortOrder === 'asc'
                ? 'scale-105 bg-primary text-white shadow-md'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            <ArrowUpZA className="h-3.5 w-3.5" /> 最早
          </button>
        </div>
      </div>

      {/* 卡片列表 */}
      {processed.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />
            <Ghost className="relative h-10 w-10 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">
            {searchQuery ? '没找到相关记忆' : '朋友圈空空如也'}
          </h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            {searchQuery ? '尝试精简你的搜索词，或者换个心情再次出发。' : '像便利贴一样，把一闪而过的小心思贴满整面墙吧。'}
          </p>
        </GlassCard>
      ) : (
        <div key={sortOrder} className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {processed.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: Math.min(i * 0.04, 0.4) }}
            >
              <GlassCard hover className="flex h-full flex-col p-5 md:rounded-[32px] md:p-8">
                {/* 顶部：头像 + 时间 */}
                <div className="mb-4 flex items-center gap-3 border-b border-slate-200/50 pb-4 dark:border-slate-700/50 md:mb-6 md:gap-4 md:pb-6">
                  <div className={`grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-white bg-gradient-to-tr ${getAuthorStyle(m.author).gradient} text-white shadow-sm md:h-14 md:w-14 md:rounded-2xl`}>
                    <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-black tracking-wide md:text-base ${getAuthorStyle(m.author).text}`}>
                      {m.author || '小叶叶'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-400 md:text-[11px]">
                      <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" /> {timeAgo(m.datetime)}
                    </span>
                  </div>
                </div>

                {/* 文本（支持 admin 写入的 Markdown 语法） */}
                {m.text && (
                  <MarkdownText className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200 md:text-base">
                    {m.text}
                  </MarkdownText>
                )}

                {/* 九宫格配图 + 灯箱 */}
                {m.images && m.images.length > 0 && <ImageGallery images={m.images} />}

                {/* 底部：位置 */}
                {m.location && (
                  <div className="mt-5 flex items-center md:mt-8">
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-primary/10 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary dark:text-primary-lighter">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{m.location}</span>
                    </span>
                  </div>
                )}

                {/* 评论按钮 */}
                <button
                  onClick={() => setCommentMoment(m)}
                  className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-all hover:bg-primary/15 dark:text-primary-lighter"
                >
                  <MessageSquare className="h-3 w-3" /> 评论
                </button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* 评论弹窗 */}
      <Modal
        open={!!commentMoment}
        onClose={() => setCommentMoment(null)}
        className="max-w-lg"
      >
        {commentMoment && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200/50 pb-3 dark:border-slate-700/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">碎碎念评论</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {commentMoment.text}
              </p>
            </div>
            <CommentSection targetType="moment" targetId={commentMoment.id} />
          </div>
        )}
      </Modal>
    </div>
  )
}
