import { useEffect, useState } from 'react'
import { parseFrontmatter } from '../utils/markdown'

// 通过 import.meta.glob 收集所有日记 Markdown 文件（懒加载，返回路径 → 异步加载函数）
const diaryModules = import.meta.glob('../data/diaries/*.md', {
  query: '?raw',
  import: 'default',
})

// 模块级缓存：100+ 篇日记的解析结果全站只做一次。
// 工具箱（GlobalToolbox）挂在每个页面，没有缓存时每次路由切换都会全量重新解析。
let _diariesCache = null
let _diariesPromise = null

async function loadAllDiaries() {
  if (_diariesCache) return _diariesCache
  if (_diariesPromise) return _diariesPromise
  _diariesPromise = (async () => {
    const entries = Object.entries(diaryModules)
    const list = await Promise.all(
      entries.map(async ([path, loader]) => {
        const raw = await loader()
        const { data, body } = parseFrontmatter(raw)
        const slug = extractSlugFromPath(path)
        // 解析 tags：frontmatter 中以逗号分隔的字符串
        const tagsRaw = data.tags || ''
        const tags = tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        return {
          slug,
          date: data.date || '',
          title: data.title || slug,
          cover: data.cover || '',
          summary: data.summary || '',
          tags,
          body,
        }
      }),
    )
    // 按日期倒序（无日期的排到最后）
    list.sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date < b.date ? 1 : -1
    })
    _diariesCache = list
    return _diariesCache
  })()
  return _diariesPromise
}

/**
 * 从文件路径提取 slug
 * 形如 ../data/diaries/2024-05-20-our-beginning.md → 2024-05-20-our-beginning
 * 直接用去扩展名的完整文件名作为 slug，保证与路由 /diaries/:slug 一致、唯一且确定性
 */
function extractSlugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '')
}

/**
 * 加载所有日记（模块级缓存：同一会话只解析一次，多页面共享）
 * 用 import.meta.glob 懒加载 .md 原文，解析 frontmatter，按日期倒序返回
 * @returns {{ diaries: Array, loading: boolean }}
 *   每条日记：{ slug, date, title, cover, summary, body, tags }
 */
export function useDiaries() {
  const [diaries, setDiaries] = useState(() => _diariesCache || [])
  const [loading, setLoading] = useState(() => !_diariesCache)

  useEffect(() => {
    let cancelled = false
    loadAllDiaries().then((list) => {
      if (!cancelled) {
        setDiaries(list)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { diaries, loading }
}

export default useDiaries
