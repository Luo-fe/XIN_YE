import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarHeart,
  Heart,
  Calendar,
  Clock,
  Cake,
  Sparkles,
  ChevronRight,
  MessageCircle,
  GraduationCap,
  Plane,
  Bell,
  X,
} from 'lucide-react'
import { GlassCard, Modal, CommentSection } from '../components/ui'
import { daysSince } from '../utils/content'
import anniversariesData from '../data/anniversaries.json'

// 类型 → 图标 + 渐变色 + 标签
const CATEGORY_META = {
  anniversary: {
    label: '纪念',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-500',
    chip: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  },
  birthday: {
    label: '生日',
    icon: Cake,
    gradient: 'from-amber-500 to-orange-500',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  travel: {
    label: '旅行',
    icon: Plane,
    gradient: 'from-sky-500 to-cyan-500',
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  },
  graduation: {
    label: '学业',
    icon: GraduationCap,
    gradient: 'from-violet-500 to-purple-500',
    chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  },
  event: {
    label: '事件',
    icon: Bell,
    gradient: 'from-emerald-500 to-teal-500',
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
}

/**
 * 计算循环纪念日的下一次发生日期与倒计时天数
 */
function calcNextCyclic(dateStr) {
  if (!dateStr) return { daysToNext: 0, nextDate: null, isToday: false }
  const base = new Date(dateStr + 'T00:00:00')
  if (isNaN(base.getTime())) return { daysToNext: 0, nextDate: null, isToday: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let next = new Date(today.getFullYear(), base.getMonth(), base.getDate())
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
  }
  const diff = Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  return { daysToNext: diff, nextDate: next, isToday: diff === 0 }
}

/**
 * 计算两个日期之间已经过去多少天（用于"已经一起多少天"）
 */
function calcDaysTogether(dateStr) {
  return daysSince(dateStr)
}

/**
 * 计算已过天数（非循环纪念日）
 */
function calcDaysPassed(dateStr) {
  if (!dateStr) return { days: 0, isFuture: false, isToday: false }
  const target = new Date(dateStr + 'T00:00:00')
  if (isNaN(target.getTime())) return { days: 0, isFuture: false, isToday: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  return {
    days: Math.abs(diff),
    isFuture: diff > 0,
    isToday: diff === 0,
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ===== 历年记录弹窗 =====
function YearsModal({ anniversary, open, onClose }) {
  const meta = CATEGORY_META[anniversary?.category] || CATEGORY_META.anniversary
  const Icon = meta.icon
  const years = anniversary?.years || []
  const cyclicInfo = useMemo(
    () => (anniversary?.isCyclic ? calcNextCyclic(anniversary.date) : null),
    [anniversary],
  )
  const daysTogether = useMemo(() => {
    if (anniversary?.id === 'primary_relationship') {
      return calcDaysTogether(anniversary.date)
    }
    return 0
  }, [anniversary])

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      {anniversary && (
        <div className="flex flex-col gap-5">
          {/* 弹窗头部 */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/50 pb-4 dark:border-slate-700/50">
            <div className="flex items-start gap-3">
              <span
                className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-lg`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                  {anniversary.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(anniversary.date)}
                  </span>
                  {anniversary.isCyclic && cyclicInfo && (
                    <span className="flex items-center gap-1 font-bold text-primary dark:text-primary-lighter">
                      <Clock className="h-3 w-3" />
                      {cyclicInfo.isToday
                        ? '就是今天'
                        : `下一次还有 ${cyclicInfo.daysToNext} 天`}
                    </span>
                  )}
                  {daysTogether > 0 && (
                    <span className="flex items-center gap-1 font-bold text-pink-600 dark:text-pink-300">
                      <Heart className="h-3 w-3 fill-pink-500/70" />
                      已经在一起 {daysTogether} 天
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/10"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 描述 */}
          {anniversary.description && (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {anniversary.description}
            </p>
          )}

          {/* 历年记录列表 */}
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {[...years].reverse().map((y, i) => (
              <motion.div
                key={y.year}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="rounded-2xl border border-white/40 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5"
              >
                {/* 年份头部 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black text-primary dark:text-primary-lighter">
                    {y.year}年
                  </span>
                  {y.actualDate && (
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formatDate(y.actualDate)}
                    </span>
                  )}
                  {y.source && (
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {y.source === 'chat' ? '聊天记录' : y.source === 'diary' ? '日记' : y.source}
                    </span>
                  )}
                </div>

                {/* 当年描述 */}
                {y.description && (
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {y.description}
                  </p>
                )}

                {/* 原文金句 */}
                {y.quotes && y.quotes.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {y.quotes.map((q, qi) => (
                      <li
                        key={qi}
                        className="border-l-2 border-primary/50 pl-3 text-sm italic text-slate-700 dark:text-slate-200"
                      >
                        {q}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>

          {years.length === 0 && (
            <div className="rounded-2xl bg-white/40 p-6 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
              暂无历年记录
            </div>
          )}

          {/* 评论区 */}
          <div className="border-t border-slate-200/50 pt-4 dark:border-slate-700/50">
            <CommentSection
              targetType="anniversary"
              targetId={anniversary.id}
              title="留下祝福"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

// ===== 主纪念日大卡片 =====
function PrimaryAnniversaryCard({ anniversary, index, onOpenModal }) {
  const meta = CATEGORY_META[anniversary.category] || CATEGORY_META.anniversary
  const Icon = meta.icon
  const { daysToNext, isToday } = useMemo(
    () => calcNextCyclic(anniversary.date),
    [anniversary.date],
  )
  const daysTogether = useMemo(() => {
    if (anniversary.id === 'primary_relationship') {
      return calcDaysTogether(anniversary.date)
    }
    return 0
  }, [anniversary.id, anniversary.date])
  const years = anniversary.years || []
  const hasYears = years.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
      className="h-full"
    >
      <GlassCard
        onClick={hasYears ? () => onOpenModal(anniversary) : undefined}
        className="relative flex h-full cursor-pointer flex-col overflow-hidden p-6 transition-all hover:shadow-glass-lg md:p-8"
      >
        {/* 顶部渐变光晕 */}
        <div
          className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${meta.gradient} opacity-20 blur-3xl`}
        />
        <Icon
          className={`pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full bg-gradient-to-br ${meta.gradient} opacity-[0.07]`}
          fill="currentColor"
        />

        {/* 头部：图标 + 类型标签 */}
        <div className="relative flex items-center justify-between">
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-lg md:h-14 md:w-14`}
          >
            <Icon className="h-6 w-6 md:h-7 md:w-7" />
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${meta.chip}`}
          >
            <Sparkles className="h-3 w-3" /> {meta.label}
          </span>
        </div>

        {/* 标题 */}
        <h3 className="relative mt-4 text-2xl font-black tracking-tight text-slate-800 dark:text-white md:text-3xl">
          {anniversary.title}
        </h3>

        {/* 日期 + 倒计时 */}
        <div className="relative mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(anniversary.date)}
          </div>
          {isToday ? (
            <span className="gradient-text text-lg font-black">就是今天</span>
          ) : (
            <span className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-primary dark:text-primary-lighter md:text-3xl">
                {daysToNext}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                天后下一次
              </span>
            </span>
          )}
        </div>

        {/* 额外展示：已经在一起多少天（仅恋爱纪念日） */}
        {daysTogether > 0 && (
          <div className="relative mt-4 rounded-2xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-pink-600 dark:text-pink-300">
                已经在一起
              </span>
              <span className="text-3xl font-black text-pink-600 dark:text-pink-300">
                {daysTogether.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-pink-600 dark:text-pink-300">天</span>
            </div>
          </div>
        )}

        {/* 描述 */}
        {anniversary.description && (
          <p className="relative mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {anniversary.description}
          </p>
        )}

        {/* 点击查看历年记录提示 */}
        {hasYears && (
          <div className="relative mt-auto flex items-center gap-1.5 pt-5 text-xs font-bold text-primary dark:text-primary-lighter">
            <MessageCircle className="h-3.5 w-3.5" />
            点击查看 {years.length} 年记录
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

// ===== 普通纪念日卡片 =====
function NormalAnniversaryCard({ anniversary, index, onOpenModal }) {
  const meta = CATEGORY_META[anniversary.category] || CATEGORY_META.event
  const Icon = meta.icon
  const years = anniversary.years || []
  const hasYears = years.length > 0

  const cyclicInfo = useMemo(
    () => (anniversary.isCyclic ? calcNextCyclic(anniversary.date) : null),
    [anniversary.isCyclic, anniversary.date],
  )
  const passedInfo = useMemo(
    () => (!anniversary.isCyclic ? calcDaysPassed(anniversary.date) : null),
    [anniversary.isCyclic, anniversary.date],
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      className="h-full"
    >
      <GlassCard
        onClick={hasYears ? () => onOpenModal(anniversary) : undefined}
        hover={!hasYears}
        className="relative flex h-full flex-col overflow-hidden p-5 md:p-6"
      >
        <Icon
          className={`pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${meta.gradient} opacity-[0.08]`}
          fill="currentColor"
        />

        {/* 头部 */}
        <div className="relative flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.chip}`}
          >
            <Icon className="h-3 w-3" /> {meta.label}
          </span>
          {anniversary.isCyclic && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary dark:text-primary-lighter">
              循环
            </span>
          )}
        </div>

        {/* 标题 */}
        <h3 className="relative mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">
          {anniversary.title}
        </h3>

        {/* 日期 */}
        {anniversary.date && (
          <div className="relative mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5" /> {formatDate(anniversary.date)}
          </div>
        )}

        {/* 倒计时 / 已过天数 */}
        <div className="relative mt-3 flex items-baseline gap-1.5">
          {anniversary.isCyclic && cyclicInfo ? (
            cyclicInfo.isToday ? (
              <span className="gradient-text text-xl font-black">就是今天</span>
            ) : (
              <>
                <span className="text-2xl font-black text-primary dark:text-primary-lighter">
                  {cyclicInfo.daysToNext}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  天后下一次
                </span>
              </>
            )
          ) : (
            passedInfo &&
            (passedInfo.isToday ? (
              <span className="gradient-text text-xl font-black">就是今天</span>
            ) : (
              <>
                <span className="text-2xl font-black text-primary dark:text-primary-lighter">
                  {passedInfo.days}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {passedInfo.isFuture ? '天后' : '天前'}
                </span>
              </>
            ))
          )}
        </div>

        {/* 描述 */}
        {anniversary.description && (
          <p className="relative mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {anniversary.description}
          </p>
        )}

        {/* 点击查看历年记录提示 */}
        {hasYears ? (
          <div className="relative mt-auto flex items-center gap-1.5 pt-4 text-[11px] font-bold text-primary dark:text-primary-lighter">
            <MessageCircle className="h-3 w-3" />
            点击查看 {years.length} 年记录
            <ChevronRight className="h-3 w-3" />
          </div>
        ) : (
          <div className="relative mt-auto flex items-center gap-1.5 pt-4 text-[10px] text-slate-400">
            <Clock className="h-3 w-3" />
            {anniversary.isCyclic
              ? cyclicInfo?.isToday
                ? '今天就是特别的日子'
                : '即将到来'
              : passedInfo?.isToday
                ? '今天就是特别的日子'
                : passedInfo?.isFuture
                  ? '即将到来'
                  : '美好回忆'}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

// 纪念日页：三大主纪念日大卡片 + 其他按重要性排序的卡片网格
export default function Anniversary() {
  const [modalAnniversary, setModalAnniversary] = useState(null)

  const { primaryAnniversaries, sortedOthers } = useMemo(() => {
    const primary = anniversariesData.filter((a) => a.type === 'primary')
    const others = anniversariesData
      .filter((a) => a.type !== 'primary')
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    return { primaryAnniversaries: primary, sortedOthers: others }
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
          <CalendarHeart className="h-5 w-5" />
        </span>
        <div>
          <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">纪念日</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">那些值得被永远记住的日子</p>
        </div>
      </header>

      {/* 三大主纪念日 */}
      {primaryAnniversaries.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4 fill-pink-500/70 text-pink-500/70" />
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">最重要的日子</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {primaryAnniversaries.map((a, i) => (
              <PrimaryAnniversaryCard
                key={a.id}
                anniversary={a}
                index={i}
                onOpenModal={setModalAnniversary}
              />
            ))}
          </div>
        </section>
      )}

      {/* 其他纪念日 */}
      {sortedOthers.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">其他纪念</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">（按重要性排序）</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedOthers.map((a, i) => (
              <NormalAnniversaryCard
                key={a.id}
                anniversary={a}
                index={i}
                onOpenModal={setModalAnniversary}
              />
            ))}
          </div>
        </section>
      )}

      {primaryAnniversaries.length === 0 && sortedOthers.length === 0 && (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Heart className="h-10 w-10 fill-pink-500/70 text-pink-500/70" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">还没有纪念日</h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            恋爱纪念日、生日、第一次旅行……都会在这里慢慢补全。
          </p>
        </GlassCard>
      )}

      {/* 历年记录弹窗 */}
      <YearsModal
        anniversary={modalAnniversary}
        open={!!modalAnniversary}
        onClose={() => setModalAnniversary(null)}
      />
    </div>
  )
}
