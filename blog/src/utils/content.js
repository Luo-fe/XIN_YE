/**
 * 内容展示共享工具：去重各处重复的作者样式 / 相对时间 / Markdown 清理 / 天数计算。
 */

/** 统一封面占位（避免逐首请求网易云封面 API 的 CORS 问题） */
export const DEFAULT_COVER =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vinyl%20record%20purple%20gradient%20music%20album%20cover%20minimal&image_size=square_hd'

/** 两位作者的固定配色（碎碎念 / 评论区共用） */
export const AUTHOR_STYLES = {
  小叶叶: {
    gradient: 'from-sky-400 to-blue-500',
    text: 'text-sky-600 dark:text-sky-300',
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  },
  小昕昕: {
    gradient: 'from-pink-400 to-rose-500',
    text: 'text-pink-600 dark:text-pink-300',
    chip: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  },
}

export function getAuthorStyle(author) {
  return AUTHOR_STYLES[author] || AUTHOR_STYLES['小叶叶']
}

/** 相对时间：刚刚 / x 分钟前 / x 小时前 / x 天前 / 具体日期 */
export function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

/**
 * 从某个日期（YYYY-MM-DD）到今天已过去的天数（按本地时区当天 0 点计算）
 */
export function daysSince(dateStr) {
  if (!dateStr) return 0
  const start = new Date(`${dateStr}T00:00:00`)
  if (isNaN(start.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
}

/**
 * 去掉 Markdown 标记取纯文本（用于摘要/预览）
 */
export function stripMarkdown(md = '') {
  return md
    .replace(/^#{1,6}\s+/gm, '') // 标题
    .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
    .replace(/\*(.+?)\*/g, '$1') // 斜体
    .replace(/`(.+?)`/g, '$1') // 行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
    .replace(/\[(.+?)\]\(.*?\)/g, '$1') // 链接
    .replace(/^>\s+/gm, '') // 引用
    .replace(/^[-*+]\s+/gm, '') // 列表
    .replace(/\n{2,}/g, '\n') // 压缩空行
    .trim()
}
