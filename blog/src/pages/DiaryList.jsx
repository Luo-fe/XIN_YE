import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, ArrowRight, Inbox, Calendar, Search, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { GlassCard, Skeleton } from '../components/ui'
import { useDiaries } from '../hooks/useDiaries'
import { useDiaryCovers, computeCoverStyle, normalizeArea16x9 } from '../hooks/useDiaryCovers'
import { stripMarkdown, stripHtml } from '../utils/content'

// 日记列表页：毛玻璃卡片网格，封面 + 标题 + 日期 + 摘要 + 标签筛选
export default function DiaryList() {
  const { diaries, loading } = useDiaries()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const { coverMap, coverFullMap, areaMap, ratios } = useDiaryCovers(diaries)

  // 汇总所有标签（按出现频次倒序）
  const allTags = useMemo(() => {
    const counter = new Map()
    for (const d of diaries) {
      for (const t of d.tags || []) {
        counter.set(t, (counter.get(t) || 0) + 1)
      }
    }
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])
  }, [diaries])

  // 关键词 + 标签过滤
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return diaries.filter((d) => {
      const matchQuery =
        !q ||
        (d.title || '').toLowerCase().includes(q) ||
        (d.summary || '').toLowerCase().includes(q) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(q))
      const matchTag = !activeTag || (d.tags || []).includes(activeTag)
      return matchQuery && matchTag
    })
  }, [diaries, query, activeTag])

  // 计算每篇日记是否需要填充正文（同行内有封面卡片 + 本卡片无封面时才填充）
  const fillMap = useMemo(() => {
    const map = {}
    const COLS = 3
    for (let i = 0; i < filtered.length; i += COLS) {
      const row = filtered.slice(i, i + COLS)
      const rowHasCover = row.some((d) => !!(coverFullMap[d.slug] || coverMap[d.slug]))
      const rowAllNoCover = row.every((d) => !(coverFullMap[d.slug] || coverMap[d.slug]))
      // 同行有封面且本卡片无封面 → 需要填充
      for (const d of row) {
        map[d.slug] = rowHasCover && !rowAllNoCover && !(coverFullMap[d.slug] || coverMap[d.slug])
      }
    }
    return map
  }, [filtered, coverMap, coverFullMap])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">日记</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">记录我们一起走过的每一天</p>
          </div>
        </div>
        {/* 搜索框 */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题 / 摘要 / 标签…"
            className="w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
          />
        </div>
      </header>

      {/* 标签筛选条 */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Tag className="h-3.5 w-3.5" /> 标签
          </span>
          <button
            type="button"
            onClick={() => setActiveTag('')}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              activeTag === ''
                ? 'bg-primary text-white shadow-glow'
                : 'bg-white/50 text-slate-600 hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:text-slate-300 dark:hover:text-primary-lighter',
            )}
          >
            全部
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag((cur) => (cur === t ? '' : t))}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-all',
                activeTag === t
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-white/50 text-slate-600 hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:text-slate-300 dark:hover:text-primary-lighter',
              )}
            >
              # {t}
            </button>
          ))}
        </div>
      )}

      {/* 加载骨架 */}
      {loading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="overflow-hidden p-0">
              <Skeleton height={160} rounded="rounded-none" />
              <div className="space-y-2 p-5">
                <Skeleton width="70%" height={18} />
                <Skeleton width="40%" height={12} />
                <Skeleton width="100%" height={12} />
                <Skeleton width="85%" height={12} />
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && filtered.length === 0 && (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Inbox className="h-10 w-10 text-primary/60" />
          <p className="text-slate-600 dark:text-slate-300">
            {query || activeTag ? '没有找到匹配的日记' : '还没有日记，敬请期待'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-primary-lighter"
          >
            返回首页 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </GlassCard>
      )}

      {/* 日记卡片网格 */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d, i) => (
            <motion.div
              key={d.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <GlassCard hover className="group flex h-full flex-col overflow-hidden p-0">
                <Link to={`/diaries/${d.slug}`} className="flex h-full flex-col">
                  {/* 封面图：原图（清晰）+ 取景框区域；容器统一 16:9（旧自由比例区域
                      归一化为 16:9 cover 语义，不裁剪不拉伸），与详情页/取景框/预览同步 */}
                  {(() => {
                    const cover = coverFullMap[d.slug] || coverMap[d.slug] || ''
                    if (!cover) return null
                    // 旧版自由比例区域 → 归一化 16:9 等效区域（无区域时整图 cover/center）
                    const area = normalizeArea16x9(areaMap[d.slug])
                    // 传入原图比例做 cover 等比渲染：取景内容不拉伸变形（0.75 竖图不会横向拉宽）
                    const style = computeCoverStyle(area, ratios[cover])
                    return (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <div
                          className="h-full w-full bg-no-repeat transition-transform duration-700 group-hover:scale-105"
                          style={{
                            backgroundImage: `url(${cover})`,
                            backgroundSize: style.backgroundSize,
                            backgroundPosition: style.backgroundPosition,
                          }}
                          role="img"
                          aria-label={d.title}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {d.date && (
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                            <Calendar className="h-3 w-3" /> {d.date}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                  {/* 标题 + 摘要 + 标签（同行有封面且本卡片无封面时填充正文补齐高度） */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-lg font-bold text-slate-800 transition-colors group-hover:text-primary dark:text-slate-100 dark:group-hover:text-primary-lighter">
                      {d.title}
                    </h3>
                    {(() => {
                      const needFill = fillMap[d.slug]
                      // 需要填充时用正文纯文本，否则用摘要
                      const preview = needFill
                        ? (d.body ? stripHtml(stripMarkdown(d.body)).slice(0, 300) : stripHtml(d.summary))
                        : stripHtml(d.summary)
                      if (!preview) return null
                      return (
                        <p
                          className={`mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${
                            needFill ? 'line-clamp-6' : 'line-clamp-3'
                          }`}
                        >
                          {preview}
                        </p>
                      )
                    })()}
                    {d.tags && d.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {d.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary dark:text-primary-lighter"
                          >
                            # {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary dark:text-primary-lighter">
                      继续阅读 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
