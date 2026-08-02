import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Smile, Sparkles, Calendar, MessageSquare } from 'lucide-react'
import { GlassCard, Modal, CommentSection, MarkdownText } from '../components/ui'
import ImageGallery from '../components/ImageGallery'
import MoodTrend from '../components/MoodTrend'
import moodsData from '../data/moods.json'

// 心情 → emoji 与文案映射
const MOOD_META = {
  happy: { emoji: '😊', label: '开心', color: 'from-amber-400 to-yellow-300' },
  calm: { emoji: '😌', label: '平静', color: 'from-sky-400 to-cyan-300' },
  sad: { emoji: '😢', label: '难过', color: 'from-indigo-400 to-blue-300' },
  excited: { emoji: '🤩', label: '兴奋', color: 'from-pink-400 to-rose-300' },
  angry: { emoji: '😠', label: '生气', color: 'from-red-400 to-orange-300' },
  tired: { emoji: '😴', label: '疲惫', color: 'from-violet-400 to-purple-300' },
}

// 心情页：瀑布流卡片 + emoji + 九宫格配图 + 时间
export default function Mood() {
  const [commentMood, setCommentMood] = useState(null)
  // 按日期倒序
  const sorted = useMemo(() => {
    return [...moodsData].sort((a, b) => {
      const ta = new Date(a.date).getTime()
      const tb = new Date(b.date).getTime()
      return tb - ta
    })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
          <Smile className="h-5 w-5" />
        </span>
        <div>
          <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">心情</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">收藏每天的喜怒哀乐</p>
        </div>
      </header>

      {/* 心情趋势图 */}
      <MoodTrend moods={sorted} />

      {sorted.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Sparkles className="h-10 w-10 text-primary/70" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            还没有心情记录
          </h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            把今天的感受留下来，未来的某一天回头看，会是很温柔的回忆。
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((m, i) => {
            const meta = MOOD_META[m.mood] || MOOD_META.calm
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <GlassCard hover className="flex h-full flex-col p-5">
                  {/* 顶部：emoji + 心情标签 + 日期 */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-tr ${meta.color} text-2xl shadow-sm`}
                      >
                        {meta.emoji}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {meta.label}
                      </span>
                    </div>
                    {m.date && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3 w-3" /> {m.date}
                      </span>
                    )}
                  </div>

                  {/* 文本（支持 admin 写入的 Markdown 语法） */}
                  {m.text && (
                    <MarkdownText className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {m.text}
                    </MarkdownText>
                  )}

                  {/* 九宫格配图 + 灯箱 */}
                  {m.images && m.images.length > 0 && <ImageGallery images={m.images} />}

                  {/* 评论按钮 */}
                  <button
                    onClick={() => setCommentMood(m)}
                    className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-all hover:bg-primary/15 dark:text-primary-lighter"
                  >
                    <MessageSquare className="h-3 w-3" /> 评论
                  </button>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* 评论弹窗 */}
      <Modal
        open={!!commentMood}
        onClose={() => setCommentMood(null)}
        className="max-w-lg"
      >
        {commentMood && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200/50 pb-3 dark:border-slate-700/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">心情评论</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {commentMood.text || (MOOD_META[commentMood.mood] || {}).label || ''}
              </p>
            </div>
            <CommentSection targetType="mood" targetId={commentMood.id} />
          </div>
        )}
      </Modal>
    </div>
  )
}
