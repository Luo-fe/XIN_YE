import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { assetUrl } from '../utils/assetUrl'
import {
  Sparkles,
  BookOpen,
  MessageCircle,
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  Shield,
} from 'lucide-react'
import { GlassCard, Skeleton } from '../components/ui'
import PhotoFlow from '../components/layout/PhotoFlow'
import { useDiaries } from '../hooks/useDiaries'
import moodsData from '../data/moods.json'
import momentsData from '../data/moments.json'
import timelineData from '../data/timeline.json'
import anniversariesData from '../data/anniversaries.json'
import { coupleHero, siteConfig } from '../config/site'
import { computeCoverStyle } from '../hooks/useDiaryCovers'
import { daysSince, stripMarkdown, stripHtml } from '../utils/content'

// 从数组中随机抽取 n 个不重复元素
function pickRandom(arr, n) {
  if (!arr || arr.length === 0) return []
  const pool = [...arr]
  const result = []
  const count = Math.min(n, pool.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool.splice(idx, 1)[0])
  }
  return result
}

// 心情类型 → 中文映射（纯文字，不用 emoji）
const moodLabel = {
  happy: '开心',
  calm: '平静',
  excited: '兴奋',
  tired: '疲惫',
  sad: '难过',
  angry: '生气',
}

// 动态计算在一起的天数（从纪念日「在一起的日子」起算到今天）
// 起始日期从 anniversaries.json 中读取，避免硬编码
function getTogetherDays() {
  const rel = anniversariesData.find(
    (a) => a.id === 'primary_relationship' || a.title === '在一起的日子'
  )
  return daysSince(rel?.date || '2023-11-07')
}

// 从日记正文提取开头一两句作为摘要（去除 Markdown 标记与富文本 HTML 标签）
function getDiaryExcerpt(body, maxSentences = 2) {
  if (!body) return ''
  const text = stripHtml(stripMarkdown(body)).replace(/\s+/g, ' ')
  const sentences = text
    .split(/(?<=[。！？!?])/)
    .map((s) => s.trim())
    .filter(Boolean)
  return sentences.slice(0, maxSentences).join('')
}

export default function Home() {
  const { diaries, loading } = useDiaries()
  // 主页主题卡片展示区域（后台固定取景框框选）：无区域时 cover/center
  const heroStyle = computeCoverStyle(siteConfig.heroArea)

  // 随机一条碎碎念（页面挂载时确定）
  const randomWhisper = useMemo(() => {
    const pool = momentsData.filter((m) => m.text)
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
  }, [])

  // 随机一条时光轴 + 一条纪念日
  const randomTimeline = useMemo(() => {
    const pool = timelineData.filter((t) => t.title)
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
  }, [])

  const randomAnniversary = useMemo(() => {
    const pool = anniversariesData.filter((a) => a.title)
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
  }, [])

  // 最近 3 篇日记
  const recentDiaries = diaries.slice(0, 3)

  // 随机抽取 3 条碎碎念 / 3 条心情
  const randomMoments = useMemo(() => pickRandom(momentsData, 3), [])
  const randomMoods = useMemo(() => pickRandom(moodsData, 3), [])

  // 碎碎念作者映射
  const whisperAuthor = (m) => {
    const a = m.author || ''
    if (/小叶|叶叶|小熊|男生|我（男|boy/i.test(a)) return 'by 小叶叶'
    if (/小昕|昕昕|公主|女生|girl/i.test(a)) return 'by 小昕昕'
    return a ? `by ${a}` : ''
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero 区：合照背景 + 毛玻璃徽章 + 大字标题 + 随机碎碎念
          容器固定 16:9（与后台取景框比例一致）：框选区域按原比例展示，不缩放不变形 */}
      <section className="relative mt-2 aspect-video w-full overflow-hidden rounded-3xl border border-white/40 shadow-glass dark:border-white/10 sm:mt-4">
        <div className="absolute inset-0">
          {/* 主题图：后台取景框框选的区域（无区域时整图 cover）
              注意用 siteConfig.coupleHero（对象属性）而非解构常量 ——
              admin 保存的配置在启动时覆盖 siteConfig 对象 */}
          <div
            className="h-full w-full bg-no-repeat"
            style={{
              backgroundImage: `url(${assetUrl(siteConfig.coupleHero)})`,
              backgroundSize: heroStyle.backgroundSize,
              backgroundPosition: heroStyle.backgroundPosition,
            }}
            role="img"
            aria-label="合照"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-transparent to-pink-500/20" />
        </div>

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-5 text-center sm:gap-4 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md">
            没有花的世界是多么单调啊 没有你那么我的世界是多么无聊啊
          </div>

          <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tighter text-white drop-shadow-lg sm:text-5xl md:text-6xl">
            <span className="inline-flex items-center gap-2">
              <Crown className="h-7 w-7 text-pink-300 sm:h-9 sm:w-9" />
              昕昕公主
            </span>
            <span className="mx-2 text-pink-200">和</span>
            <span className="inline-flex items-center gap-2">
              小熊骑士
              <Shield className="h-7 w-7 text-sky-300 sm:h-9 sm:w-9" />
            </span>
            <br />
            的小小王国
          </h1>

          <p className="mx-auto max-w-2xl text-sm text-white/90 drop-shadow md:text-base">
            在一起已经 {getTogetherDays()} 天
          </p>

          {/* 随机一句碎碎念（标注作者；小屏隐藏保证 16:9 内排版） */}
          {randomWhisper && (
            <div className="mt-2 hidden max-w-xl rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md sm:block">
              <p className="text-sm italic text-white/95 sm:text-base">
                "{randomWhisper.text}"
              </p>
              <span className="mt-1 flex items-center justify-center gap-2 text-[11px] text-white/70">
                <MessageCircle className="h-3 w-3" />
                {whisperAuthor(randomWhisper)}
                <span className="text-white/40">·</span>
                {randomWhisper.datetime
                  ? randomWhisper.datetime.slice(0, 10)
                  : '碎碎念'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 宝藏之地（全宽，含随机时光轴+纪念日） */}
      <section>
        <GlassCard className="flex min-h-[220px] flex-col justify-between p-5 sm:p-6 md:min-h-[240px] md:p-8">
          <div>
            {/* 随机一条时光轴 */}
            {randomTimeline && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 dark:bg-primary/10">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary dark:text-primary-lighter">
                  <Clock className="h-3 w-3" /> 时光轴 · 那一天
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {randomTimeline.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                  {randomTimeline.description}
                </p>
                <span className="mt-1 block font-mono text-[10px] text-slate-400">
                  {randomTimeline.date}
                </span>
              </div>
            )}

            {/* 随机一条纪念日 */}
            {randomAnniversary && (
              <div className="mt-3 rounded-xl border border-pink-300/30 bg-pink-50/50 px-4 py-3 dark:bg-pink-500/10">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-pink-500 dark:text-pink-300">
                  <Calendar className="h-3 w-3" /> 纪念日 · 那一天
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {randomAnniversary.title}
                </p>
                {randomAnniversary.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                    {randomAnniversary.description}
                  </p>
                )}
                <span className="mt-1 block font-mono text-[10px] text-slate-400">
                  {randomAnniversary.date}
                </span>
              </div>
            )}
          </div>
          <Link
            to="/about"
            className="mt-5 inline-flex items-center gap-1.5 self-end text-sm font-bold text-primary transition-all hover:gap-2.5 dark:text-primary-lighter"
          >
            关于我们 <ArrowRight className="h-4 w-4" />
          </Link>
        </GlassCard>
      </section>

      {/* 照片流动循环播放 */}
      <section>
        <PhotoFlow count={20} />
      </section>

      {/* 最近日记（3 条） */}
      <section>
        <GlassCard hover className="flex min-h-[300px] flex-col overflow-hidden p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-white/30 pb-3 dark:border-white/10">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <BookOpen className="h-5 w-5 text-primary dark:text-primary-lighter" /> 最近日记
            </h3>
          </div>
          <div className="flex flex-1 flex-col">
            {loading ? (
              <div className="space-y-2">
                <Skeleton width="80%" height={14} />
                <Skeleton width="60%" height={12} />
                <Skeleton height={48} rounded="rounded-lg" />
              </div>
            ) : recentDiaries.length === 0 ? (
              <p className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-400">
                暂无日记，等待第一篇到来
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {recentDiaries.map((d) => (
                  <li key={d.slug}>
                    <Link
                      to={`/diaries/${d.slug}`}
                      className="group flex flex-col gap-1"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold text-slate-800 transition-colors group-hover:text-primary dark:text-slate-100 dark:group-hover:text-primary-lighter">
                          {d.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="h-3 w-3" /> {d.date || '未署日期'}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {getDiaryExcerpt(d.body) || stripHtml(d.summary)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/diaries"
              className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-primary dark:text-primary-lighter"
            >
              前往日记 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </GlassCard>
      </section>

      {/* 第三行：随机碎碎念（8 列）+ 随机心情（4 列） */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 随机碎碎念（标注作者） */}
        <div className="lg:col-span-8">
          <GlassCard hover className="flex h-full min-h-[260px] flex-col overflow-hidden p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-white/30 pb-3 dark:border-white/10">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                <MessageCircle className="h-5 w-5 text-primary dark:text-primary-lighter" /> 碎碎念 · 随机拾贝
              </h3>
              <Link
                to="/moments"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary dark:text-primary-lighter"
              >
                查看全部 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {randomMoments.length === 0 ? (
              <p className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-400">
                还没有碎碎念，先说点什么吧
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {randomMoments.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1">
                    <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                      {m.text || '（无文字）'}
                    </p>
                    <span className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-primary dark:text-primary-lighter">
                        {whisperAuthor(m)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <Clock className="h-3 w-3" /> {m.datetime || ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* 随机心情（纯文字，无 emoji） */}
        <div className="lg:col-span-4">
          <GlassCard hover className="flex h-full min-h-[260px] flex-col overflow-hidden p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-white/30 pb-3 dark:border-white/10">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                <Sparkles className="h-5 w-5 text-pink-500" /> 心情 · 随机拾贝
              </h3>
              <Link
                to="/moods"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary dark:text-primary-lighter"
              >
                更多 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {randomMoods.length === 0 ? (
              <p className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-400">
                还没有记录过心情
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {randomMoods.map((m, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary dark:text-primary-lighter">
                      {moodLabel[m.mood] || m.mood || '心情'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-slate-700 dark:text-slate-200">
                        {m.text || '心情记录'}
                      </p>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" /> {m.date || ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </section>
    </div>
  )
}
