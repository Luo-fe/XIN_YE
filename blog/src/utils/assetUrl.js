/**
 * 统一资源地址工具：给数据里的相对资源路径补上 Vite base 前缀。
 *
 * 数据（manifest / 背景 / 封面等 JSON）里存的是不带子路径的地址：
 *   /photo-thumbs/2026/p0034.webp、/backgrounds/bg.jpg、diary-covers/cover_xxx.jpg
 * 本地 dev（BASE_URL=/）下原样可用；GitHub Pages 子路径部署（/XIN_YE/）下
 * 必须补前缀，否则 img/background 全部 404。
 *
 * 幂等：已带 base 前缀、外部 URL（http/data/blob/mailto）原样返回。
 */
export function assetUrl(p) {
  if (!p) return ''
  if (/^(https?:|data:|blob:|mailto:)/i.test(p)) return p
  const base = import.meta.env.BASE_URL || '/'
  const path = p.startsWith('/') ? p.slice(1) : p
  // 幂等：已带 base 前缀（如 /XIN_YE/photo-thumbs/...）则原样返回
  if (base !== '/' && path.startsWith(base.slice(1))) return '/' + path
  return `${base}${path}`
}
