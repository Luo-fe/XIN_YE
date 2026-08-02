import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen,
  Heart,
  CalendarHeart,
  MessageCircle,
  Image,
  Cloud,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import { useToast } from '../components/Toast'
import { listItems, listDiaries } from '../api/contentApi'

/**
 * 概览页：通过 API 读取真实数据统计
 */
export default function OverviewView() {
  const { showToast } = useToast()
  const [stats, setStats] = useState({
    diaries: 0,
    chatSummaries: 0,
    moods: 0,
    anniversaries: 0,
    timeline: 0,
    moments: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [diaries, moods, anniversaries, timeline, moments, chatSummaries] =
        await Promise.all([
          listDiaries().catch(() => []),
          listItems('moods').catch(() => []),
          listItems('anniversaries').catch(() => []),
          listItems('timeline').catch(() => []),
          listItems('moments').catch(() => []),
          fetch('/api/content/chat-summaries')
            .then((r) => r.json())
            .catch(() => ({ count: 0 })),
        ])
      setStats({
        diaries: diaries.length,
        chatSummaries: chatSummaries.count || 0,
        moods: moods.length,
        anniversaries: anniversaries.length,
        timeline: timeline.length,
        moments: moments.length,
      })
    } catch (e) {
      showToast(e.message || '加载统计失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const cards = [
    { label: '日记数', value: stats.diaries, unit: '篇', icon: BookOpen, gradient: 'from-violet-500 to-purple-500' },
    { label: '聊天总结', value: stats.chatSummaries, unit: '月', icon: MessageCircle, gradient: 'from-indigo-500 to-violet-500' },
    { label: '心情数', value: stats.moods, unit: '条', icon: Heart, gradient: 'from-pink-500 to-rose-500' },
    { label: '纪念日', value: stats.anniversaries, unit: '个', icon: CalendarHeart, gradient: 'from-fuchsia-500 to-pink-500' },
    { label: '时光轴', value: stats.timeline, unit: '条', icon: Image, gradient: 'from-sky-500 to-blue-500' },
    { label: '碎碎念', value: stats.moments, unit: '条', icon: Cloud, gradient: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div className="space-y-6">
      {/* 欢迎横幅 */}
      <div className="glass-card relative overflow-hidden rounded-3xl p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-primary/30 to-aurora-pink/30 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              欢迎使用情侣博客管理后台 👋
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              在这里管理你的日记、微信聊天总结、心情、纪念日与照片墙，所有操作直接读写博客数据文件，实时生效。
            </p>
          </div>
          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/50 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60 dark:bg-white/10 dark:text-primary-lighter"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            刷新
          </button>
        </div>
      </div>

      {/* 统计卡片网格 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="glass-card group rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-1"
            >
              <div
                className={clsx(
                  'mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr text-white shadow-md transition-transform group-hover:scale-110',
                  item.gradient,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex items-baseline gap-1">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                ) : (
                  <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    {item.value}
                  </span>
                )}
                <span className="text-xs text-gray-400">{item.unit}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {item.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* 快捷入口提示 */}
      <div className="glass-card rounded-3xl p-6">
        <h3 className="mb-4 text-base font-bold text-gray-800 dark:text-gray-100">
          快捷开始
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: '完善站点设置', desc: '配置昵称、头像与博客路径', tag: '设置' },
            { title: '授权百度网盘', desc: '用于照片上传与云端备份', tag: '百度网盘' },
            { title: '撰写第一篇日记', desc: '记录今天的美好瞬间', tag: '日记管理' },
          ].map((tip) => (
            <div
              key={tip.title}
              className="rounded-2xl border border-white/50 bg-white/40 p-4 transition-colors hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {tip.tag}
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {tip.title}
              </p>
              <p className="mt-1 text-xs text-gray-400">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
