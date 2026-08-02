import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Footprints, Calendar, Search, Sparkles, ListTree, LayoutGrid, ArrowUp, MessageSquare } from 'lucide-react'
import { GlassCard, Modal, CommentSection } from '../components/ui'
import timelineData from '../data/timeline.json'

// 时光轴页：搜索 + 视图切换（时间线 / 矩阵网格）
export default function Timeline() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('timeline')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [commentItem, setCommentItem] = useState(null)

  const filtered = useMemo(() => {
    let result = [...timelineData]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q),
      )
    }
    return result.sort((a, b) => {
      const ta = new Date((a.date || '') + 'T00:00:00').getTime()
      const tb = new Date((b.date || '') + 'T00:00:00').getTime()
      if (!a.date) return 1
      if (!b.date) return -1
      return ta < tb ? 1 : -1
    })
  }, [searchQuery])

  const handleScroll = (e) => {
    setShowScrollTop(e.currentTarget.scrollTop > 200)
  }

  const scrollToTop = (e) => {
    const container = e.currentTarget.parentElement?.querySelector('.cyber-scrollbar')
    container?.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 标题区 */}
      <header className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-text mb-2 text-3xl font-black tracking-tighter sm:text-4xl md:text-5xl"
        >
          时光轴
        </motion.h1>
        <p className="flex items-center justify-center gap-1.5 text-xs italic text-slate-500 dark:text-slate-400 md:text-sm">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> 总计 {filtered.length} 个被收藏的瞬间
        </p>
      </header>

      {/* 搜索 + 视图切换 */}
      <div className="flex flex-col items-center gap-5">
        <div className="group relative w-full max-w-lg">
          <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="搜寻被封存的回忆..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-white/40 px-6 py-4 pl-14 text-sm font-medium text-slate-800 shadow-xl backdrop-blur-xl transition-all placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/5 dark:bg-slate-800/40 dark:text-white"
          />
        </div>
        <div className="flex w-full max-w-lg items-center justify-between gap-3 rounded-3xl border border-white/20 bg-white/30 p-2 backdrop-blur-md dark:border-white/5 dark:bg-slate-800/30">
          <div className="flex flex-wrap justify-start gap-2">
            <span className="rounded-xl bg-white/50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
              全部回忆
            </span>
          </div>
          <div className="flex shrink-0 rounded-2xl bg-white/50 p-1 shadow-inner dark:bg-slate-900/50">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:px-4 sm:text-sm ${
                viewMode === 'timeline'
                  ? 'bg-white text-primary shadow-sm dark:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ListTree className="h-4 w-4" />
              <span className="hidden sm:inline">时间线</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:px-4 sm:text-sm ${
                viewMode === 'card'
                  ? 'bg-white text-primary shadow-sm dark:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">网格</span>
            </button>
          </div>
        </div>
      </div>

      {/* 模式 1：矩阵网格 */}
      {viewMode === 'card' ? (
        <motion.div
          key="card-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <style>{`
            .cyber-scrollbar::-webkit-scrollbar { width: 8px; }
            .cyber-scrollbar::-webkit-scrollbar-track { background: rgba(139, 92, 246, 0.05); border-radius: 12px; }
            .cyber-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #a78bfa 0%, #c4b5fd 100%); border-radius: 12px; border: 2px solid transparent; background-clip: padding-box; }
          `}</style>
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              这个频段没有接收到任何信号
            </div>
          ) : (
          <div
            onScroll={handleScroll}
            className="cyber-scrollbar relative h-[75vh] overflow-y-auto pr-2 pb-10"
          >
            <div className="grid grid-cols-2 gap-3 pt-4 pb-10 md:grid-cols-3 md:gap-6">
              {filtered.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <GlassCard className="group relative flex h-full flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                    <div className="relative h-28 overflow-hidden sm:h-36 md:h-40">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-tr from-primary/30 to-pink-500/30" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {item.date && (
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/40 px-2 py-1 text-[9px] font-bold text-white/90 backdrop-blur-sm md:bottom-3 md:left-4 md:text-xs">
                          <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3" /> {item.date}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3 md:p-5">
                      <h3 className="mb-1 line-clamp-2 text-xs font-bold text-slate-800 transition-colors group-hover:text-primary dark:text-slate-100 md:mb-2 md:text-lg">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="line-clamp-2 flex-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400 md:text-sm">
                          {item.description}
                        </p>
                      )}
                      <button
                        onClick={() => setCommentItem(item)}
                        className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/10 dark:text-primary-lighter md:text-[11px]"
                      >
                        <MessageSquare className="h-3 w-3" /> 评论
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
          )}
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={scrollToTop}
              className="absolute -right-3 bottom-4 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-t from-purple-500 to-primary text-white shadow-lg shadow-purple-500/40 transition-all hover:-translate-y-1"
              title="回到顶部"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          )}
        </motion.div>
      ) : (
        /* 模式 2：时间线（左右交替） */
        <motion.div
          key="timeline-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden p-2 md:p-10"
        >
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              这个频段没有接收到任何信号
            </div>
          ) : (
            <>
              {/* 中央/左侧轴线 */}
              <div className="absolute left-4 top-2 h-full w-0.5 bg-gradient-to-b from-primary via-pink-400 to-primary-lighter md:left-1/2 md:-translate-x-1/2" />
              <div className="flex flex-col gap-8 md:gap-16">
                {filtered.map((item, i) => {
                  const isLeft = i % 2 === 0
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                      className={`relative flex items-start gap-6 pl-12 md:pl-0 ${
                        isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                      }`}
                    >
                      {/* 轴线节点 */}
                      <span className="absolute left-4 top-3 z-10 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-primary shadow-glow ring-4 ring-white/60 dark:ring-white/10 md:left-1/2">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      {/* 桌面端占位 */}
                      <div className="hidden md:block md:w-1/2" />
                      {/* 卡片 */}
                      <div className="min-w-0 flex-1 md:w-1/2">
                        <GlassCard hover className="overflow-hidden p-0">
                          {item.image && (
                            <div className="relative h-40 w-full overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            </div>
                          )}
                          <div className="p-5">
                            {item.date && (
                              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary dark:text-primary-lighter">
                                <Calendar className="h-3 w-3" /> {item.date}
                              </div>
                            )}
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                              {item.title}
                            </h3>
                            {item.description && (
                              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {item.description}
                              </p>
                            )}
                            <button
                              onClick={() => setCommentItem(item)}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-all hover:bg-primary/15 dark:text-primary-lighter"
                            >
                              <MessageSquare className="h-3 w-3" /> 评论
                            </button>
                          </div>
                        </GlassCard>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                <Footprints className="h-4 w-4" /> 故事还在继续…
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 评论弹窗 */}
      <Modal
        open={!!commentItem}
        onClose={() => setCommentItem(null)}
        className="max-w-lg"
      >
        {commentItem && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200/50 pb-3 dark:border-slate-700/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">时光轴评论</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {commentItem.title}
              </p>
            </div>
            <CommentSection targetType="timeline" targetId={commentItem.id} />
          </div>
        )}
      </Modal>
    </div>
  )
}
