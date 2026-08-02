import { useEffect, useState } from 'react'

// 通过 import.meta.glob 收集所有微信聊天月度总结 Markdown 文件
const summaryModules = import.meta.glob('../data/chat-summaries/*.md', {
  query: '?raw',
  import: 'default',
})

/**
 * 从文件路径提取月份标识
 * 形如 ../data/chat-summaries/2023-06.md → 2023-06
 */
function extractMonthFromPath(path) {
  const fileName = path.split('/').pop().replace(/\.md$/, '')
  return fileName // 形如 2023-06
}

/**
 * 从 Markdown 正文解析月度总结结构
 * 结构约定：
 *   # YYYY年M月 聊天总结
 *   ## 基本信息  → 消息总数 / 时间范围
 *   ## 重要事件
 *   ## 日常活动
 *   ## 心情与感情变化
 *   ## 关键对话/金句（可选）
 *   ## 本月小结
 */
function parseSummary(raw) {
  const text = (raw || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)

  // H1 标题：提取年月
  const titleLine = lines.find((l) => /^#\s+/.test(l)) || ''
  const title = titleLine.replace(/^#\s+/, '').trim()

  // 提取月份：从标题 "2023年6月 聊天总结" 或文件名
  const titleMonthMatch = title.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/)
  let year = ''
  let month = ''
  if (titleMonthMatch) {
    year = titleMonthMatch[1]
    month = titleMonthMatch[2].padStart(2, '0')
  }

  // 按 ## 二级标题分块
  const sections = {}
  let currentHeading = ''
  let currentLines = []
  for (const line of lines) {
    const hMatch = line.match(/^##\s+(.+?)\s*$/)
    if (hMatch) {
      if (currentHeading) {
        sections[currentHeading] = currentLines.join('\n').trim()
      }
      currentHeading = hMatch[1].trim()
      currentLines = []
    } else if (currentHeading) {
      currentLines.push(line)
    }
  }
  if (currentHeading) {
    sections[currentHeading] = currentLines.join('\n').trim()
  }

  // 从「基本信息」解析消息总数与时间范围
  const basicText = sections['基本信息'] || ''
  // 消息总数：兼容多种格式
  //   140 条（我 65 / 可爱の👑 75）
  //   9788 条 + 补充记录3953条（...）
  //   原记录235条 + 补充记录3953条（...）
  // 在「消息总数」所在行收集所有「数字条」并求和
  const msgLine =
    basicText.split(/\r?\n/).find((l) => l.includes('消息总数')) || ''
  const msgNums = [...msgLine.matchAll(/(\d+)\s*条/g)].map((m) =>
    parseInt(m[1], 10),
  )
  const messages = msgNums.reduce((s, n) => s + n, 0)
  // 我 / 她的消息数
  //   标准：我 65 / 可爱の👑 75
  //   无具体数字但标注「各约半数」：按 messages / 2 估算
  const partsMatch = msgLine.match(/我\s*(\d+)\s*\/\s*[^（]*?(\d+)/)
  let myMessages = partsMatch ? parseInt(partsMatch[1], 10) : 0
  let herMessages = partsMatch ? parseInt(partsMatch[2], 10) : 0
  if (!partsMatch && /各[约]?半/.test(msgLine) && messages > 0) {
    const half = Math.round(messages / 2)
    myMessages = half
    herMessages = half
  }
  // 时间范围
  const periodMatch = basicText.match(/时间范围[：:]\s*(\d{4}-\d{2}-\d{2})\s*[~～\-]\s*(\d{4}-\d{2}-\d{2})/)
  const periodStart = periodMatch ? periodMatch[1] : ''
  const periodEnd = periodMatch ? periodMatch[2] : ''

  // 摘要：取「本月小结」首段
  const summaryText = sections['本月小结'] || ''
  const summary = summaryText.split(/\n/).find((l) => l.trim()) || ''

  return {
    title,
    year,
    month,
    monthKey: year && month ? `${year}-${month}` : '',
    messages,
    myMessages,
    herMessages,
    periodStart,
    periodEnd,
    summary,
    sections,
    body: text,
  }
}

/**
 * 加载所有微信聊天月度总结
 * 按月份倒序返回（最新在前）
 * @returns {{ summaries: Array, loading: boolean, stats: object }}
 *   每条总结：{ slug, title, year, month, monthKey, messages, myMessages,
 *              herMessages, periodStart, periodEnd, summary, sections, body }
 *   stats: { total, totalMessages, avgMessages, peakMonth, peakMessages }
 */
export function useChatSummaries() {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = Object.entries(summaryModules)
      const list = await Promise.all(
        entries.map(async ([path, loader]) => {
          const raw = await loader()
          const parsed = parseSummary(raw)
          return {
            slug: extractMonthFromPath(path),
            ...parsed,
          }
        }),
      )
      // 按月份倒序
      list.sort((a, b) => {
        if (!a.monthKey) return 1
        if (!b.monthKey) return -1
        return a.monthKey < b.monthKey ? 1 : -1
      })
      if (!cancelled) {
        setSummaries(list)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 统计数据
  const stats = computeStats(summaries)

  return { summaries, loading, stats }
}

function computeStats(list) {
  const total = list.length
  const totalMessages = list.reduce((s, x) => s + (x.messages || 0), 0)
  const totalMy = list.reduce((s, x) => s + (x.myMessages || 0), 0)
  const totalHer = list.reduce((s, x) => s + (x.herMessages || 0), 0)
  const avgMessages = total ? Math.round(totalMessages / total) : 0
  let peakMonth = ''
  let peakMessages = 0
  for (const x of list) {
    if ((x.messages || 0) > peakMessages) {
      peakMessages = x.messages || 0
      peakMonth = x.monthKey
    }
  }
  // 按年份聚合
  const byYear = {}
  for (const x of list) {
    if (!x.year) continue
    if (!byYear[x.year]) {
      byYear[x.year] = { year: x.year, messages: 0, count: 0 }
    }
    byYear[x.year].messages += x.messages || 0
    byYear[x.year].count += 1
  }
  const yearlyStats = Object.values(byYear).sort((a, b) =>
    a.year < b.year ? 1 : -1,
  )
  return {
    total,
    totalMessages,
    totalMy,
    totalHer,
    avgMessages,
    peakMonth,
    peakMessages,
    yearlyStats,
  }
}

export default useChatSummaries
