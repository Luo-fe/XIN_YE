/**
 * Markdown 工具：frontmatter 解析与生成、slug 生成
 * 与博客前端数据格式保持一致
 */

const FRONTMATTER_DELIMITER = '---'

/**
 * 解析带 frontmatter 的 Markdown 文本
 * @param {string} raw 原始 Markdown 文本
 * @returns {{ data: Record<string, string>, body: string }}
 *   data: frontmatter 字段（值为字符串）；body: 正文（不含 frontmatter）
 */
export function parseFrontmatter(raw) {
  if (!raw || typeof raw !== 'string') return { data: {}, body: '' }

  const trimmed = raw.replace(/^\uFEFF/, '').trimStart()
  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return { data: {}, body: raw }
  }

  // 跳过首行 ---，寻找下一个独占一行的 --- 作为 frontmatter 结束
  const afterFirst = trimmed.slice(FRONTMATTER_DELIMITER.length)
  const endMatch = afterFirst.match(/\n---\s*(?:\r?\n|$)/)
  if (!endMatch) {
    return { data: {}, body: raw }
  }

  const frontmatterText = afterFirst.slice(0, endMatch.index)
  const body = afterFirst.slice(endMatch.index + endMatch[0].length)

  const data = parseYamlLite(frontmatterText)
  // 只清理首部 ASCII 空白（换行/空格/制表符），保留全角空格（U+3000）——
  // 全角空格是日记的首行缩进（首段缩进会被 trimStart 误删）
  return { data, body: body.replace(/^[ \t\r\n]+/, '') }
}

/**
 * 极简 YAML 解析：仅支持 `key: value` 形式（值不带引号或带引号）
 * 不支持嵌套/数组，满足 frontmatter 扁平字段需求
 */
function parseYamlLite(text) {
  const data = {}
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    // 去除包裹引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) data[key] = value
  }
  return data
}

/**
 * 将 frontmatter 对象与正文组装为 Markdown 文本
 * @param {Record<string, string|number|undefined|null>} data
 * @param {string} body
 * @returns {string}
 */
export function stringifyFrontmatter(data, body) {
  const lines = Object.keys(data || {})
    .filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== '')
    .map((k) => {
      const v = String(data[k])
      // 含冒号、首尾空格或特殊字符时用引号包裹，避免被误解析
      if (/[:#\n]/.test(v) || v !== v.trim()) {
        return `${k}: "${v.replace(/"/g, '\\"')}"`
      }
      return `${k}: ${v}`
    })
  const fm = [FRONTMATTER_DELIMITER, ...lines, FRONTMATTER_DELIMITER, ''].join('\n')
  return fm + (body || '')
}

/**
 * 由标题生成 slug
 * 策略：保留 ascii 字母数字与空格，空格转连字符；
 * 若结果为空（纯中文等），回退为时间戳，避免拼音依赖
 * @param {string} title
 * @returns {string}
 */
export function generateSlug(title) {
  if (!title) return String(Date.now())
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  if (ascii) return ascii
  return String(Date.now())
}

/**
 * 生成日记文件名：{date}-{slug}.md
 */
export function buildDiaryFilename(date, slug) {
  const d = date || new Date().toISOString().slice(0, 10)
  return `${d}-${slug}.md`
}

export default {
  parseFrontmatter,
  stringifyFrontmatter,
  generateSlug,
  buildDiaryFilename,
}
