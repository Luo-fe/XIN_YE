/**
 * 从 chat_with_Yuyu 月度总结提取心情/纪念日/碎碎念数据
 * 用法: node extract-chat.js
 * 输出到 blog/src/data/ 下的 JSON 文件（追加模式，不覆盖已有数据）
 */

const fs = require('fs')
const path = require('path')

const SUMMARY_DIR = path.resolve(__dirname, '..', 'chat_with_Yuyu', '月度总结')
const DATA_DIR = path.resolve(__dirname, 'blog', 'src', 'data')

// 读取已有数据，用于去重
function readExisting(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
  } catch {
    return []
  }
}

// 生成唯一 ID 前缀
function nextId(prefix, existing) {
  const nums = existing
    .map((x) => x.id)
    .filter((id) => id && id.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))
  return prefix + (Math.max(0, ...nums) + 1)
}

// 解析月度总结 Markdown
function parseSummary(raw) {
  const lines = raw.split(/\r?\n/)
  const title = (lines.find((l) => /^#\s+/.test(l)) || '').replace(/^#\s+/, '').trim()
  const titleMatch = title.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/)
  const year = titleMatch ? titleMatch[1] : ''
  const month = titleMatch ? titleMatch[2].padStart(2, '0') : ''

  // 按 ## 分块
  const sections = {}
  let currentHeading = ''
  let currentLines = []
  for (const line of lines) {
    const hMatch = line.match(/^##\s+(.+?)\s*$/)
    if (hMatch) {
      if (currentHeading) sections[currentHeading] = currentLines.join('\n').trim()
      currentHeading = hMatch[1].trim()
      currentLines = []
    } else if (currentHeading) {
      currentLines.push(line)
    }
  }
  if (currentHeading) sections[currentHeading] = currentLines.join('\n').trim()

  return { year, month, title, sections }
}

// 从「重要事件」提取纪念日/时间轴条目
function extractEvents(sections, year, month) {
  const events = []
  const eventText = sections['重要事件'] || ''
  if (!eventText) return events

  // 匹配 **日期 标题** 格式的事件
  const eventBlocks = eventText.split(/\n(?=-\s+\*\*)/)
  for (const block of eventBlocks) {
    // 提取日期和标题
    const headerMatch = block.match(/^\s*-\s+\*\*(.+?)\*\*/)
    if (!headerMatch) continue
    const header = headerMatch[1].trim()

    // 提取日期
    const dateMatch = header.match(/(\d{1,2})[\.月](\d{1,2})/)
    let dateStr = ''
    if (dateMatch) {
      const m = dateMatch[1].padStart(2, '0')
      const d = dateMatch[2].padStart(2, '0')
      dateStr = `${year}-${m}-${d}`
    } else {
      // 尝试匹配 "X月X日" 格式
      const altMatch = header.match(/(\d{1,2})月(\d{1,2})/)
      if (altMatch) {
        dateStr = `${year}-${altMatch[1].padStart(2, '0')}-${altMatch[2].padStart(2, '0')}`
      }
    }

    // 提取描述（取事件块的第一段非标题内容）
    const descLines = block.split('\n').slice(1).filter((l) => l.trim() && !l.trim().startsWith('**'))
    const desc = descLines.join(' ').trim().slice(0, 120)

    // 判断事件类型
    let type = 'event'
    const lower = header.toLowerCase()
    if (/生日|birthday/.test(lower)) type = 'birthday'
    else if (/纪念|周年|确立|在一起|牵手|初吻|恋爱/.test(lower)) type = 'anniversary'
    else if (/旅行|旅游|出游|之旅|去了|逛|演唱会/.test(lower)) type = 'travel'
    else if (/毕业|答辩|录取|上岸/.test(lower)) type = 'graduation'

    if (header && dateStr) {
      events.push({
        header: header.replace(/^[：:]/, '').trim(),
        date: dateStr,
        type,
        description: desc || header,
        year,
        month,
      })
    }
  }

  return events
}

// 从「心情与感情变化」提取心情条目
function extractMoods(sections, year, month) {
  const moods = []
  const moodText = sections['心情与感情变化'] || ''
  if (!moodText) return moods

  // 按段落提取心情趋势
  const paragraphs = moodText.split(/\n\n+/).filter((p) => p.trim())
  for (const para of paragraphs) {
    // 提取心情关键词
    const moodMap = {
      happy: /甜蜜|开心|快乐|幸福|欢笑|浪漫|温馨|宠溺|珍惜|感动|暖|喜悦|满足|依赖/,
      excited: /激动|兴奋|高光|巅峰|里程碑|质变|突破|🌟|⭐|✨|💫|🎉|🎊|震撼|爆表|沸腾|热情|疯狂|热烈|炽热/,
      calm: /平静|稳定|日常|习惯|舒适|踏实|安心|陪伴|默契|自然|平淡|宁静|温馨/,
      sad: /争吵|冷战|矛盾|冲突|难过|焦虑|不安|无助|自卑|痛苦|悲伤|崩溃|迷茫|失望|委屈|泪|哭/,
      tired: /压力|疲惫|累|耗尽|无力|忙碌|负担|沉重|消沉/,
    }

    let moodType = 'calm'
    for (const [type, pattern] of Object.entries(moodMap)) {
      if (pattern.test(para)) {
        moodType = type
        break
      }
    }

    // 截取前 80 个字符
    const text = para.replace(/\*\*/g, '').replace(/^- /, '').trim().slice(0, 80)

    // 使用月份中间日期
    const dateStr = `${year}-${month}-15`

    if (text) {
      moods.push({
        date: dateStr,
        mood: moodType,
        text,
        year,
        month,
      })
    }
  }

  return moods
}

// 从「关键对话/金句」和「本月小结」提取碎碎念
function extractMoments(sections, year, month) {
  const moments = []
  const quotesText = sections['关键对话/金句'] || ''
  const summaryText = sections['本月小结'] || ''

  // 提取金句（每行一条）
  if (quotesText) {
    const lines = quotesText.split(/\n/).filter((l) => l.trim() && !l.startsWith('#'))
    for (const line of lines) {
      const clean = line.replace(/^\s*-\s+/, '').replace(/["""]/g, '"').replace(/[""]/g, '"').trim()
      // 提取引用内容（在引号或冒号后）
      const quoteMatch = clean.match(/[""「『](.+?)[""」』]/)
      if (quoteMatch && quoteMatch[1].length > 4) {
        const dateStr = `${year}-${month}-15T12:00:00`
        moments.push({
          datetime: dateStr,
          text: quoteMatch[1].trim().slice(0, 100),
          year,
          month,
        })
      } else if (clean.length > 8 && clean.length < 100 && !clean.startsWith('**')) {
        const dateStr = `${year}-${month}-15T12:00:00`
        moments.push({
          datetime: dateStr,
          text: clean.replace(/^[「『""]/, '').replace(/[」『""]$/, '').trim().slice(0, 100),
          year,
          month,
        })
      }
    }
  }

  return moments
}

// =============== 主流程 ===============
function main() {
  const files = fs.readdirSync(SUMMARY_DIR).filter((f) => f.endsWith('.md'))
  console.log(`找到 ${files.length} 个月度总结`)

  const allEvents = []
  const allMoods = []
  const allMoments = []

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SUMMARY_DIR, file), 'utf-8')
    const { year, month, sections } = parseSummary(raw)

    if (!year) continue

    const events = extractEvents(sections, year, month)
    const moods = extractMoods(sections, year, month)
    const moments = extractMoments(sections, year, month)

    allEvents.push(...events)
    allMoods.push(...moods)
    allMoments.push(...moments)
  }

  console.log(`提取到 ${allEvents.length} 个事件`)
  console.log(`提取到 ${allMoods.length} 条心情`)
  console.log(`提取到 ${allMoments.length} 条碎碎念`)

  // 读取已有数据
  const existingAnniversaries = readExisting('anniversaries.json')
  const existingTimeline = readExisting('timeline.json')
  const existingMoods = readExisting('moods.json')
  const existingMoments = readExisting('moments.json')

  // 去重：按日期+标题/文本
  const existingDates = new Set(existingAnniversaries.map((x) => x.date + '|' + x.title))
  const existingTimelineDates = new Set(existingTimeline.map((x) => x.date + '|' + x.title))
  const existingMoodDates = new Set(existingMoods.map((x) => x.date + '|' + x.text?.slice(0, 20)))
  const existingMomentDates = new Set(existingMoments.map((x) => x.datetime + '|' + x.text?.slice(0, 20)))

  // 生成新条目
  let aId = parseInt(nextId('a', existingAnniversaries).replace('a', ''), 10)
  const newAnniversaries = []
  for (const evt of allEvents) {
    const key = evt.date + '|' + evt.header
    if (existingDates.has(key)) continue
    existingDates.add(key)
    newAnniversaries.push({
      id: 'a' + aId++,
      title: evt.header,
      date: evt.date,
      type: evt.type,
      description: evt.description,
    })
    // 只取重要事件（前 20 个）
    if (newAnniversaries.length >= 20) break
  }

  let tId = parseInt(nextId('t', existingTimeline).replace('t', ''), 10)
  const newTimeline = []
  for (const evt of allEvents) {
    const key = evt.date + '|' + evt.header
    if (existingTimelineDates.has(key)) continue
    existingTimelineDates.add(key)
    newTimeline.push({
      id: 't' + tId++,
      date: evt.date,
      title: evt.header,
      description: evt.description,
      type: evt.type,
    })
    if (newTimeline.length >= 30) break
  }

  let mId = parseInt(nextId('m', existingMoods).replace('m', ''), 10)
  const newMoods = []
  for (const mood of allMoods) {
    const key = mood.date + '|' + mood.text.slice(0, 20)
    if (existingMoodDates.has(key)) continue
    existingMoodDates.add(key)
    newMoods.push({
      id: 'm' + mId++,
      date: mood.date,
      mood: mood.mood,
      text: mood.text,
      images: [],
    })
    if (newMoods.length >= 15) break
  }

  let moId = parseInt(nextId('mo', existingMoments).replace('mo', ''), 10)
  const newMoments = []
  for (const moment of allMoments) {
    const key = moment.datetime + '|' + moment.text.slice(0, 20)
    if (existingMomentDates.has(key)) continue
    existingMomentDates.add(key)
    newMoments.push({
      id: 'mo' + moId++,
      datetime: moment.datetime,
      text: moment.text,
      images: [],
    })
    if (newMoments.length >= 20) break
  }

  // 合并并写入
  const results = {
    anniversaries: [...existingAnniversaries, ...newAnniversaries],
    timeline: [...existingTimeline, ...newTimeline],
    moods: [...existingMoods, ...newMoods],
    moments: [...existingMoments, ...newMoments],
  }

  for (const [key, data] of Object.entries(results)) {
    const fileName = key + '.json'
    const filePath = path.join(DATA_DIR, fileName)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    console.log(`已写入 ${fileName}: ${data.length} 条（新增 ${data.length - (readExisting(fileName).length)} 条）`)
  }

  console.log('\n✅ 提取完成！请手动重启 blog dev server 查看效果')
}

main()