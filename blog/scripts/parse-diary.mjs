import fs from 'fs'
import path from 'path'

const TXT_PATH = 'f:/图片/Dream N_Abou的日记.txt'
const OUT_DIR = 'f:/图片/couple-blog/blog/src/data/diaries'
const SUMMARY_PATH = 'f:/图片/couple-blog/blog/scripts/diary-summary.json'

fs.mkdirSync(OUT_DIR, { recursive: true })

const raw = fs.readFileSync(TXT_PATH, 'utf-8').replace(/^\uFEFF/, '')
const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

// Locate every date-only line: YYYY-MM-DD or YYYY/MM/DD (with optional trailing spaces)
const dateRe = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ \t]*$/gm
const hits = []
let m
while ((m = dateRe.exec(text)) !== null) {
  hits.push({ y: m[1], mo: m[2], d: m[3], index: m.index })
}
console.log('Date line count:', hits.length)

// Slice chunks between consecutive date lines
const chunks = []
for (let i = 0; i < hits.length; i++) {
  const start = hits[i].index
  const end = i + 1 < hits.length ? hits[i + 1].index : text.length
  chunks.push({ ...hits[i], chunk: text.slice(start, end) })
}

function normDate(y, mo, d) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Separator line = a line consisting only of U+2014 em dashes (5+)
const SEP_RE = /^[ \t]*\u2014{5,}[ \t]*$/

const TAG_RULES = [
  ['游戏', ['我的世界', 'Minecraft', 'minecraft', '游戏', '联机', '生存', '模组', '原版生存', '网吧', '苦力怕', '僵尸', '末影']],
  ['演唱会', ['演唱会', '演出', 'livehouse', 'Livehouse', '乐团', '巡演']],
  ['拼豆', ['拼豆']],
  ['桌游', ['桌游', '王权', '卡牌', '提瓦特']],
  ['KTV', ['KTV', 'ktv', '唱歌']],
  ['火锅', ['火锅', '锅圈']],
  ['动物园', ['动物园']],
  ['旅行', ['旅行', '旅游', '古城', '景区', '门票', '平遥', '绵山', '山东', '正定', '王家大院', '双林寺', '出游', '民宿', '游记', '高铁', '火车', '飞机']],
  ['生日', ['生日', '生日快乐', '岁生日', '生日蛋糕', '蛋糕']],
  ['毕业', ['毕业', '毕业照', '学位', '答辩', '拍毕业照', '毕业典礼', '学士服']],
  ['家人', ['爸爸', '妈妈', '哥哥', '家人', '父亲', '母亲', '家里', '老家']],
  ['约会', ['约会', '表白', '在一起']],
  ['学校', ['学校', '上课', '考试', '老师', '同学', '导员', '论文', '保研', '研究生', '研一', '研二', '研三', '学院', '学期']],
  ['回忆', ['回忆', '曾经', '初识', '小时候', '往事', '过去', '那时候']],
  ['心情', ['难过', '伤心', '害怕', '犹豫', '自卑', '孤独', '孤单', '失落', '无力', '情绪', '心疼', '遗憾', '不甘']],
]

function inferTags(title, body) {
  const text = title + ' ' + body
  const tags = []
  for (const [tag, kws] of TAG_RULES) {
    if (kws.some((kw) => text.includes(kw))) {
      tags.push(tag)
      if (tags.length >= 3) break
    }
  }
  if (tags.length === 0) tags.push('日常')
  return tags.slice(0, 3)
}

function makeSummary(body) {
  const cleaned = body.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 120) return cleaned
  // Strong sentence boundary between 80-120
  let cut = -1
  for (let i = 120; i >= 80; i--) {
    if (/[。！？!?…]/.test(cleaned[i - 1])) { cut = i; break }
  }
  if (cut === -1) {
    // Weak boundary between 60-120
    for (let i = 120; i >= 60; i--) {
      if (/[，,；;、]/.test(cleaned[i - 1])) { cut = i; break }
    }
  }
  if (cut === -1) cut = 120
  return cleaned.slice(0, cut).trim()
}

const dateCount = {}
let written = 0
const skipped = []
const summaryList = []

for (const c of chunks) {
  const date = normDate(c.y, c.mo, c.d)
  const lines = c.chunk.split('\n')
  let title = (lines[1] || '').trim() || '无题'
  // 如果"标题"过长（>50字），说明没有独立标题行，
  // 正文第一段被误当作标题 → 把它放回 body，标题改用"无题"
  let bodyStartIdx = 2
  if (title.length > 50) {
    bodyStartIdx = 1
    title = '无题'
  }
  // Body = lines[bodyStartIdx..], drop separator lines, strip leading spaces
  // (leading 4+ spaces would be parsed as Markdown code blocks → <pre>)
  const rawLines = lines.slice(bodyStartIdx)
    .filter((ln) => !SEP_RE.test(ln))
    .map((ln) => ln.replace(/^[ \t]+/, ''))
  // 确保每个非空行之间有空行（Markdown 段落分隔）。
  // TXT 中每行是一个段落但行间可能无空行，Markdown 会合并为一段。
  const normalized = []
  for (const ln of rawLines) {
    if (ln.trim() === '') {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== '') {
        normalized.push('')
      }
    } else {
      normalized.push(ln)
      normalized.push('')
    }
  }
  let body = normalized.join('\n').replace(/^\n+/, '').replace(/\s+$/, '')
  // Body non-whitespace length
  const bodyLen = body.replace(/\s/g, '').length
  if (bodyLen < 20) {
    skipped.push({ date, title, len: bodyLen })
    summaryList.push({ date, title, len: bodyLen, preview: body.replace(/\s+/g, ' ').trim().slice(0, 60), tags: [] })
    continue
  }
  dateCount[date] = (dateCount[date] || 0) + 1
  const slug = dateCount[date] === 1 ? date : `${date}-${dateCount[date]}`
  const filename = `${slug}.md`
  const tags = inferTags(title, body)
  const summary = makeSummary(body)

  const content = [
    '---',
    `date: ${date}`,
    `title: "${title}"`,
    `summary: "${summary}"`,
    `tags: ${tags.join(',')}`,
    `cover: ''`,
    '---',
    '',
    body,
    '',
  ].join('\n')

  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf-8')
  written++
  summaryList.push({ date, title, len: bodyLen, preview: summary, tags, file: filename })
}

// Sort summary ascending by date for easy scanning
summaryList.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summaryList, null, 2), 'utf-8')

console.log(`\nWritten: ${written} .md files`)
console.log(`Skipped: ${skipped.length} short entries`)
for (const s of skipped) {
  console.log(`  [SKIPPED] ${s.date} | ${s.title} | len=${s.len}`)
}
console.log(`\nSummary written to ${SUMMARY_PATH}`)
