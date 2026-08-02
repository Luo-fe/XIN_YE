import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  Calendar,
  TrendingUp,
  Crown,
  Heart,
  ChevronDown,
  Inbox,
  Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import clsx from 'clsx'
import { GlassCard, Skeleton, AnimatedNumber, CommentSection } from '../components/ui'
import { useChatSummaries } from '../hooks/useChatSummaries'

// 微信聊天分析页：统计概览 + 年度分组 + 月度卡片可展开详情
export default function ChatAnalysis() {
  const { summaries, loading, stats } = useChatSummaries()
  const [expandedSlug, setExpandedSlug] = useState('')
  const [activeYear, setActiveYear] = useState('')

  // 按年份分组（倒序）
  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of summaries) {
      const y = s.year || '未知'
      if (!map.has(y)) map.set(y, [])
      map.get(y).push(s)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [summaries])

  // 默认展开最新一年的第一个月
  const defaultYear = grouped[0]?.[0] || ''
  const currentYear = activeYear || defaultYear

  // 当前年份的月份列表
  const yearList = grouped.find(([y]) => y === currentYear)?.[1] || []

  // 当前年份的最大消息数，用于柱状图缩放（按年独立缩放，避免跨年对比失真）
  const yearMax = useMemo(
    () => Math.max(1, ...yearList.map((s) => s.messages || 0)),
    [yearList],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* 头部 */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">
              微信聊天
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              每月的聊天总结与情感轨迹 · {stats.total} 个月
            </p>
          </div>
        </div>
      </header>

      {/* 统计卡片 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="p-5">
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={32} className="mt-2" />
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={MessageCircle}
            label="总消息数"
            value={stats.totalMessages}
            gradient="from-violet-500 to-purple-500"
          />
          <StatCard
            icon={TrendingUp}
            label="月均消息"
            value={stats.avgMessages}
            gradient="from-sky-500 to-blue-500"
          />
          <StatCard
            icon={Crown}
            label="最活跃月份"
            value={stats.peakMessages}
            subValue={stats.peakMonth}
            gradient="from-amber-500 to-orange-500"
          />
          <StatCard
            icon={Heart}
            label="我 / 她"
            value={stats.totalMy}
            subValue={`她 ${stats.totalHer.toLocaleString()}`}
            gradient="from-pink-500 to-rose-500"
          />
        </div>
      )}

      {/* 年度切换 + 月度柱状图 */}
      {!loading && grouped.length > 0 && (
        <GlassCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" /> 年度
            </span>
            {grouped.map(([year, list]) => {
              const yearTotal = list.reduce((s, x) => s + (x.messages || 0), 0)
              const active = year === currentYear
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setActiveYear(year)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium transition-all',
                    active
                      ? 'bg-primary text-white shadow-glow'
                      : 'bg-white/50 text-slate-600 hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:text-slate-300 dark:hover:text-primary-lighter',
                  )}
                >
                  {year} · {yearTotal.toLocaleString()} 条
                </button>
              )
            })}
          </div>

          {/* 当前年份每月柱状图 */}
          <div className="flex h-40 items-stretch gap-1.5 overflow-x-auto pb-2">
            {yearList.map((s) => {
              const heightPct = Math.max(
                4,
                Math.round(((s.messages || 0) / yearMax) * 100),
              )
              const isPeak = s.monthKey === stats.peakMonth
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setExpandedSlug((cur) => (cur === s.slug ? '' : s.slug))}
                  title={`${s.monthKey} · ${s.messages.toLocaleString()} 条`}
                  className="group flex min-w-[28px] flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-[10px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                    {s.messages > 0 ? formatShort(s.messages) : ''}
                  </span>
                  <div
                    className={clsx(
                      'w-full rounded-t-md transition-all duration-300',
                      isPeak
                        ? 'bg-gradient-to-t from-amber-500 to-orange-400'
                        : expandedSlug === s.slug
                          ? 'bg-gradient-to-t from-primary to-aurora-pink'
                          : 'bg-gradient-to-t from-primary/60 to-primary/40 group-hover:from-primary/80 group-hover:to-primary/60',
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-slate-400">{s.month}</span>
                </button>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* 月度总结列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="p-5">
              <Skeleton width="40%" height={20} />
              <Skeleton width="80%" height={14} className="mt-2" />
            </GlassCard>
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Inbox className="h-10 w-10 text-primary/60" />
          <p className="text-slate-600 dark:text-slate-300">暂无聊天总结</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {yearList.map((s, i) => (
            <MonthlyCard
              key={s.slug}
              summary={s}
              expanded={expandedSlug === s.slug}
              onToggle={() =>
                setExpandedSlug((cur) => (cur === s.slug ? '' : s.slug))
              }
              isPeak={s.monthKey === stats.peakMonth}
              index={i}
              maxMessages={yearMax}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 统计卡片 */
function StatCard({ icon: Icon, label, value, subValue, gradient }) {
  return (
    <GlassCard className="p-5">
      <div
        className={clsx(
          'mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr text-white shadow-md',
          gradient,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          <AnimatedNumber value={value} />
        </span>
        {subValue && (
          <span className="text-xs text-slate-400">{subValue}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </GlassCard>
  )
}

/** 月度总结卡片，可展开查看完整内容 */
function MonthlyCard({ summary, expanded, onToggle, isPeak, index, maxMessages }) {
  const s = summary
  const heightPct = Math.max(
    4,
    Math.round(((s.messages || 0) / maxMessages) * 100),
  )
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
    >
      <GlassCard className="overflow-hidden p-0">
        {/* 卡片头部：点击展开/收起 */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-white/30 dark:hover:bg-white/5"
        >
          {/* 左侧月份标识 */}
          <div className="flex w-14 shrink-0 flex-col items-center">
            <span className="text-2xl font-black text-primary dark:text-primary-lighter">
              {s.month}
            </span>
            <span className="text-[10px] text-slate-400">{s.year}</span>
          </div>

          {/* 中间内容 */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {s.monthKey}
              </h3>
              {isPeak && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                  <Crown className="h-3 w-3" /> 峰值
                </span>
              )}
              {s.periodStart && (
                <span className="text-[11px] text-slate-400">
                  {s.periodStart} ~ {s.periodEnd}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-slate-600 dark:text-slate-300">
              {s.summary || '查看本月总结'}
            </p>
          </div>

          {/* 右侧消息数 + 迷你柱 */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-bold text-primary dark:text-primary-lighter">
                {s.messages.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">条消息</span>
            </div>
            <div className="flex h-10 w-2 items-end">
              <div
                className="w-full rounded-t bg-gradient-to-t from-primary/60 to-primary/40"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </motion.div>
          </div>
        </button>

        {/* 展开内容 */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/30 px-5 py-4 dark:border-white/5">
                {/* 消息数细分 */}
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 font-medium text-violet-600 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    共 {s.messages.toLocaleString()} 条
                  </span>
                  {s.myMessages > 0 && (
                    <span className="rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-600 dark:text-sky-300">
                      我 {s.myMessages.toLocaleString()}
                    </span>
                  )}
                  {s.herMessages > 0 && (
                    <span className="rounded-full bg-pink-500/10 px-3 py-1 font-medium text-pink-600 dark:text-pink-300">
                      她 {s.herMessages.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Markdown 渲染 */}
                <div className="diary-prose max-w-none text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h2: ({ children, ...props }) => (
                        <h3
                          className="mt-5 mb-2 text-sm font-bold text-primary dark:text-primary-lighter"
                          {...props}
                        >
                          {children}
                        </h3>
                      ),
                      h1: () => null, // 隐藏 H1（已在头部展示）
                      ul: ({ children }) => (
                        <ul className="ml-4 list-disc space-y-1">{children}</ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm leading-relaxed">{children}</li>
                      ),
                      p: ({ children }) => (
                        <p className="my-2 text-sm leading-relaxed">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-800 dark:text-slate-100">
                          {children}
                        </strong>
                      ),
                    }}
                  >
                    {s.body || ''}
                  </ReactMarkdown>
                </div>

                {/* 评论区 */}
                <div className="mt-4 border-t border-white/30 pt-4 dark:border-white/5">
                  <CommentSection targetType="chat" targetId={s.slug} title="月度评论" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  )
}

/** 缩写数字：12034 → 1.2w */
function formatShort(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
