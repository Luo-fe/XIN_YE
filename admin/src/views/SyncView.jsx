import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  Check,
  GitBranch,
  Copy,
  Server,
  HardDrive,
  FileText,
  Heart,
  CalendarHeart,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { listItems, listDiaries } from '../api/contentApi'

const GIT_GUIDE = `cd blog
git add .
git commit -m "chore: 同步后台内容"
git push`

export default function SyncView() {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    diaries: 0,
    moods: 0,
    anniversaries: 0,
    moments: 0,
    timeline: 0,
  })

  const loadCounts = useCallback(async () => {
    setLoading(true)
    try {
      const [diaries, moods, anniversaries, moments, timeline] = await Promise.all([
        listDiaries().catch(() => []),
        listItems('moods').catch(() => []),
        listItems('anniversaries').catch(() => []),
        listItems('moments').catch(() => []),
        listItems('timeline').catch(() => []),
      ])
      setCounts({
        diaries: diaries.length,
        moods: moods.length,
        anniversaries: anniversaries.length,
        moments: moments.length,
        timeline: timeline.length,
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  /** 复制 git 指引 */
  const handleCopyGit = async () => {
    try {
      await navigator.clipboard.writeText(GIT_GUIDE)
      setCopied(true)
      showToast('已复制 git 指引', 'success')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      showToast('复制失败，请手动选择文本复制', 'error')
    }
  }

  const stats = [
    { label: '日记', count: counts.diaries, icon: FileText, color: 'from-violet-500 to-purple-500' },
    { label: '心情', count: counts.moods, icon: Heart, color: 'from-pink-500 to-rose-500' },
    { label: '纪念日', count: counts.anniversaries, icon: CalendarHeart, color: 'from-fuchsia-500 to-pink-500' },
    { label: '碎碎念', count: counts.moments, icon: MessageCircle, color: 'from-indigo-500 to-violet-500' },
    { label: '时光轴', count: counts.timeline, icon: HardDrive, color: 'from-sky-500 to-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* API 状态卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md">
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
              后端 API 连接状态
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              所有内容管理操作通过本地服务端 API 直接读写博客数据文件
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Check className="h-4 w-4" />
            <span>已连接</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
          <Server className="h-4 w-4 shrink-0" />
          <p>
            日记、心情、碎碎念、纪念日、时光轴等内容通过 <code className="font-mono">/api/content/*</code> 接口直接读写
            <code className="font-mono"> blog/src/data/</code> 目录，无需浏览器目录授权。
          </p>
        </div>
      </section>

      {/* 数据统计 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white shadow-md">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                博客数据概览
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                当前博客数据文件中的内容统计
              </p>
            </div>
          </div>
          <button
            onClick={loadCounts}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-500/25 disabled:opacity-60 dark:text-sky-300"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-2xl bg-white/40 p-4 text-center dark:bg-white/5">
                <div className={`mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr ${s.color} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                {loading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
                ) : (
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.count}</p>
                )}
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Git 指引 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-violet-500 to-purple-500 text-white shadow-md">
            <GitBranch className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Git 发布指引</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              内容已直接写入博客数据目录，在博客工程目录执行以下命令推送到远程仓库
            </p>
          </div>
          <button
            onClick={handleCopyGit}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-2xl bg-gray-900/90 px-4 py-3 text-xs leading-relaxed text-emerald-300">
{GIT_GUIDE}
        </pre>
        <p className="mt-3 text-[11px] text-gray-400">
          提示：博客前端通常使用 Vercel/Netlify/GitHub Pages 自动部署，push 后将自动触发构建。
        </p>
      </section>
    </div>
  )
}
