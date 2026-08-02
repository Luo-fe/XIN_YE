/**
 * 百度网盘原图代理 Worker（方案 B 5.2 / B2）
 *
 * 用途：GitHub Pages 静态站上，点击照片"查看原图"时通过本 Worker 拉取
 *       百度网盘原图（d.pcs.baidu.com 直链有 CORS 限制，浏览器无法直接读）。
 *
 * 部署步骤（见同目录 README.md）：
 *   1. 注册 Cloudflare（免费）→ 创建 Worker（或本地 wrangler 部署）
 *   2. 绑定 KV 命名空间（存储网盘 token，自动刷新）
 *   3. 配置 4 个环境变量：BAIDU_APP_KEY / BAIDU_SECRET_KEY / BAIDU_REFRESH_TOKEN / TOKEN_KV
 *   4. 部署后把 Worker 域名配到网站的构建环境 VITE_BAIDU_PROXY（前端原图按钮自动启用）
 *
 * 请求格式：/img?path=<urlencoded 网盘完整路径>
 *   e.g. /img?path=%2F%E5%B0%8F%E6%98%95%E6%98%95...%2F2026%2F%E5%B9%B3%E9%81%A5%2Fxxx.jpg
 * 返回：原图字节流（带长缓存头，图片不变可缓存 30 天）
 */
const TOKEN_KEY = 'baidu_token'
const BAIDU_TOKEN_API = 'https://openapi.baidu.com/oauth/2.0/token'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/img') return handleImage(request, url, env)
    return new Response('baidu image proxy: use /img?path=<网盘完整路径>', { status: 404 })
  },
}

async function handleImage(request, url, env) {
  const path = url.searchParams.get('path')
  if (!path) return json({ error: 'missing path' }, 400)
  if (!env.KV) return json({ error: 'KV not bound' }, 500)

  try {
    const token = await ensureToken(env)
    // 1. 请求网盘下载接口，拿到 302 跳转直链
    const dlUrl = `https://d.pcs.baidu.com/rest/2.0/pcs/file?method=download&access_token=${token}&path=${encodeURIComponent(path)}`
    const dlResp = await fetch(dlUrl, { redirect: 'manual' })
    if (dlResp.status !== 302) {
      const body = await dlResp.text().catch(() => '')
      return json({ error: 'netdisk download failed', status: dlResp.status, body: body.slice(0, 300) }, 502)
    }
    const target = dlResp.headers.get('location')
    if (!target) return json({ error: 'no redirect location' }, 502)

    // 2. 跟随直链拉取原图，流式返回
    const imgResp = await fetch(target)
    if (!imgResp.ok) return json({ error: 'upstream failed', status: imgResp.status }, 502)
    const headers = new Headers(imgResp.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    // 图片内容几乎不变，长缓存减少重复拉取（照片改动后可手动更新 URL 或等 TTL）
    headers.set('Cache-Control', 'public, max-age=2592000')
    return new Response(imgResp.body, { status: 200, headers })
  } catch (e) {
    return json({ error: 'internal', message: String(e.message || e) }, 500)
  }
}

/** 从 KV 取 token，快过期（30 天有效，提前 1 天）时用 refresh_token 换新 */
async function ensureToken(env) {
  const stored = await env.KV.get(TOKEN_KEY, 'json')
  if (stored && stored.access_token && stored.expires_at > Date.now() + 24 * 3600 * 1000) {
    return stored.access_token
  }
  const refresh = (stored && stored.refresh_token) || env.BAIDU_REFRESH_TOKEN
  if (!refresh) throw new Error('no refresh token configured')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: env.BAIDU_APP_KEY || '',
    client_secret: env.BAIDU_SECRET_KEY || '',
  })
  const resp = await fetch(BAIDU_TOKEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await resp.json()
  if (data.error) throw new Error('token refresh failed: ' + (data.error_description || data.error))
  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh,
    expires_at: Date.now() + (data.expires_in || 2592000) * 1000,
  }
  await env.KV.put(TOKEN_KEY, JSON.stringify(next))
  return next.access_token
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
