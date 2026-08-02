import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../utils/assetUrl'

import { motion } from 'framer-motion'
import {
  Heart,
  Coffee,
  Sparkles,
  Code,
  Mail,
  Send,
  Trash2,
  Calendar,
  MapPin,
  Camera,
  Crown,
  Shield,
} from 'lucide-react'
import { GlassCard, GlassButton, toast } from '../components/ui'
import { useDiaries } from '../hooks/useDiaries'
import { siteConfig } from '../config/site'
import timelineData from '../data/timeline.json'
import anniversariesData from '../data/anniversaries.json'
import moodsData from '../data/moods.json'
import momentsData from '../data/moments.json'

// 展示全部时光轴（按时间正序排列；icon 字段来自数据，缺省用 sparkles）
const TIMELINE = timelineData
  .slice()
  .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  .map((t) => ({
    date: t.date,
    title: t.title,
    desc: t.description,
    icon: t.icon || 'sparkles',
  }))

// 统计数据：日记数在组件内动态读取（仓库里 100+ 篇，静态硬编码 0 与事实不符）
const BASE_STATS = [
  { label: '日记', value: 0, color: 'text-primary' },
  { label: '心情', value: moodsData.length, color: 'text-pink-500' },
  { label: '碎碎念', value: momentsData.length, color: 'text-sky-500' },
  { label: '时光轴', value: timelineData.length, color: 'text-emerald-500' },
  { label: '纪念日', value: anniversariesData.length, color: 'text-amber-500' },
]

const ICON_MAP = {
  heart: Heart,
  sparkles: Sparkles,
  camera: Camera,
  coffee: Coffee,
  code: Code,
}

// 留言板：localStorage 持久化
const GUESTBOOK_KEY = 'couple-guestbook'

function loadMessages() {
  try {
    const raw = localStorage.getItem(GUESTBOOK_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveMessages(list) {
  try {
    localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(list))
  } catch {
    // 忽略 quota 错误
  }
}

export default function About() {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [messages, setMessages] = useState([])

  // 日记统计：异步读取真实篇数（不再硬编码 0）
  const { diaries } = useDiaries()
  const STATS = useMemo(
    () => BASE_STATS.map((s) => (s.label === '日记' ? { ...s, value: diaries.length } : s)),
    [diaries],
  )

  useEffect(() => {
    setMessages(loadMessages())
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmedName = name.trim() || '匿名访客'
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      toast.warning('留言内容不能为空')
      return
    }
    if (trimmedContent.length > 280) {
      toast.warning('留言过长（最多 280 字）')
      return
    }
    const msg = {
      id: Date.now() + Math.random(),
      name: trimmedName.slice(0, 24),
      content: trimmedContent,
      time: new Date().toISOString(),
    }
    const next = [msg, ...messages].slice(0, 100)
    setMessages(next)
    saveMessages(next)
    setName('')
    setContent('')
    toast.success('留言成功，谢谢你～')
  }

  const handleDelete = (id) => {
    const next = messages.filter((m) => m.id !== id)
    setMessages(next)
    saveMessages(next)
    toast.info('已删除该留言')
  }

  const fmtTime = (iso) => {
    try {
      const d = new Date(iso)
      const y = d.getFullYear()
      const m = (d.getMonth() + 1).toString().padStart(2, '0')
      const day = d.getDate().toString().padStart(2, '0')
      const hh = d.getHours().toString().padStart(2, '0')
      const mm = d.getMinutes().toString().padStart(2, '0')
      return `${y}-${m}-${day} ${hh}:${mm}`
    } catch {
      return ''
    }
  }

  // 头像色环随机色
  const avatarColors = useMemo(
    () => [
      'from-violet-400 to-purple-400',
      'from-pink-400 to-rose-400',
      'from-sky-400 to-cyan-400',
      'from-amber-400 to-orange-400',
      'from-emerald-400 to-green-400',
    ],
    [],
  )
  const colorFor = (id) => avatarColors[Math.floor(Number(String(id).replace(/\D/g, '') || 0)) % avatarColors.length]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Hero：合照 + 标题 */}
      <header className="relative overflow-hidden rounded-3xl border border-white/40 shadow-glass dark:border-white/10">
        <div className="absolute inset-0">
          <img
            src={assetUrl(siteConfig.coupleHero)}
            alt="合照"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 px-5 py-16 text-center sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md">
            <Crown className="h-3.5 w-3.5 text-pink-300" />
            昕昕公主
            <span className="mx-1 text-white/60">·</span>
            <Shield className="h-3.5 w-3.5 text-sky-300" />
            小熊骑士
          </div>
          <h1 className="gradient-text text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl">
            关于我们
          </h1>
          <p className="max-w-2xl text-sm text-white/90 drop-shadow md:text-base">{siteConfig.bio}</p>
        </div>
      </header>

      {/* 统计概览 */}
      <GlassCard className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-5 md:p-6">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1 text-center">
            <span className={`text-2xl font-black ${s.color} sm:text-3xl`}>{s.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:text-xs">
              {s.label}
            </span>
          </div>
        ))}
      </GlassCard>

      {/* 个人简介卡片 */}
      <GlassCard className="flex flex-col items-center gap-6 p-8 text-center md:p-12">
        <div className="relative h-28 w-28">
          <div className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-tr from-primary via-pink-500 to-primary-light opacity-50 blur-md" />
          <div className="relative h-full w-full rounded-full bg-gradient-to-tr from-primary to-pink-500 p-1 shadow-glow">
            <img
              src={assetUrl(siteConfig.avatarUrl)}
              alt="头像"
              loading="lazy"
              className="h-full w-full rounded-full bg-white object-cover dark:bg-slate-700"
            />
          </div>
        </div>
        <div>
          <h2 className="gradient-text text-3xl font-bold">{siteConfig.author}</h2>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3 w-3" /> {siteConfig.locationTag}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {siteConfig.aboutParagraphs.map((p, i) => (
            <p key={i} className="max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-200 md:text-base">
              {p}
            </p>
          ))}
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {siteConfig.features.map((f) => {
            const Icon = ICON_MAP[f.icon] || Sparkles
            return <Feature key={f.title} icon={<Icon className="h-5 w-5" />} title={f.title} desc={f.desc} />
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer">
            <GlassButton size="sm" variant="ghost">
              <Code className="h-3.5 w-3.5" /> GitHub
            </GlassButton>
          </a>
          <a href={`mailto:${siteConfig.social.email}`}>
            <GlassButton size="sm" variant="ghost">
              <Mail className="h-3.5 w-3.5" /> 邮箱
            </GlassButton>
          </a>
        </div>
      </GlassCard>

      {/* 时间线 */}
      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Calendar className="h-4 w-4" />} title="我们的时间线" />
        <GlassCard className="p-6 md:p-8">
          <ol className="relative border-l border-primary/30 pl-6">
            {TIMELINE.map((t, i) => {
              const Icon = ICON_MAP[t.icon] || Sparkles
              return (
                <motion.li
                  key={t.date + t.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="mb-6 last:mb-0"
                >
                  <span className="absolute -left-[14px] grid h-7 w-7 place-items-center rounded-full border border-white/40 bg-primary text-white shadow-sm">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <time className="font-mono text-xs text-primary dark:text-primary-lighter">{t.date}</time>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{t.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t.desc}</p>
                </motion.li>
              )
            })}
          </ol>
        </GlassCard>
      </section>

      {/* 留言板 */}
      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Send className="h-4 w-4" />} title="留言板" />
        <GlassCard className="p-5 md:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="昵称（可选，默认匿名访客）"
              className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-2 text-sm text-slate-700 placeholder-slate-400 backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="留下你想对我们说的话…（最多 280 字，保存在你的浏览器本地）"
              className="w-full resize-none rounded-xl border border-white/40 bg-white/50 px-4 py-2 text-sm text-slate-700 placeholder-slate-400 backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{content.length}/280</span>
              <GlassButton type="submit" size="sm" variant="primary">
                <Send className="h-3.5 w-3.5" /> 发表留言
              </GlassButton>
            </div>
          </form>
        </GlassCard>

        {/* 留言列表 */}
        {messages.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Sparkles className="h-8 w-8 text-primary/60" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              还没有留言，做第一个留下足迹的人吧。
            </p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard className="p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-tr ${colorFor(m.id)} text-sm font-bold text-white shadow-sm`}
                    >
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.name}</span>
                        <time className="font-mono text-[11px] text-slate-400">{fmtTime(m.time)}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                        {m.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="删除"
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          留言保存在你浏览器的 localStorage 中，仅你本机可见。
        </p>
      </section>
    </div>
  )
}

function Feature({ icon, title, desc }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 p-4 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary dark:text-primary-lighter">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </GlassCard>
  )
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary dark:text-primary-lighter">
        {icon}
      </span>
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      <span className="ml-1 h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
    </div>
  )
}
