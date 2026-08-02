/**
 * admin 本地 dev server 自定义中间件插件（Vite plugin）
 *
 * 提供以下本地代理接口，解决浏览器跨域 / ORB 限制：
 *
 * 1. 网易云音乐官方 OpenAPI 代理（openncm.music.163.com，RSA_SHA256 签名 + 扫码登录）
 *    GET  /api/netease/qr-code            -> { qrcodeUrl, qrcodeKey, expiresAt }
 *    GET  /api/netease/qr-status?key=XXX  -> { status: pending|scanned|authorized|expired|error }
 *    GET  /api/netease/token-status       -> { authorized, user }
 *    GET  /api/netease/diagnose           -> 诊断匿名登录是否可用
 *    POST /api/netease/logout
 *    GET  /api/netease/user-playlists     -> 用户歌单列表
 *    GET  /api/netease/playlist-detail?id -> 歌单内歌曲列表
 *    GET  /api/netease/songs              -> 合并已选歌单所有歌曲（供 blog APlayer）
 *    GET  /api/netease/song-mp3/:id       -> 透传音频字节流（32 位加密 songId）
 *    GET  /api/netease/lyrics?id=XXX
 *    GET  /api/netease/config  | POST /api/netease/config
 *
 * 2. 百度网盘图床代理（解决 d.pcs.baidu.com 的 CORS）
 *    POST /api/baidu/save-token   { access_token, refresh_token, expires_in }
 *    GET  /api/baidu/status       -> { authorized, photoDir }
 *    GET  /api/baidu/photos       -> [{ fs_id, filename, size, mtime, url }]
 *    GET  /api/baidu/image/:fsid  -> 透传图片字节流（带 CORS 头 + 浏览器缓存）
 *
 * 注意：仅在 `vite dev` 下生效；admin 是本地运行工具，不构建生产产物。
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync, statSync } from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import QRCode from 'qrcode'

// 用户网盘照片源目录（用户任务指定：我的网盘/小昕昕❤小叶叶）
// 注意：实际网盘文件夹名含 U+FE0F 变体选择符（❤️ emoji 呈现），
// 必须用 \uFE0F 显式写出，否则百度 list 接口会返回 errno=-9（目录不存在）。
// 可通过环境变量 PHOTO_SOURCE_DIR 覆盖；支持多个候选路径用 | 分隔
const PHOTO_SOURCE_DIR =
  process.env.PHOTO_SOURCE_DIR || '/小昕昕❤\uFE0F小叶叶'

// 候选路径列表：主路径失败（errno=-9/-10 或空结果）时依次尝试
// 涵盖网盘常见布局：根目录、apps/应用目录、apps/芋泥椰奶子目录
const PHOTO_SOURCE_CANDIDATES = [
  PHOTO_SOURCE_DIR,
  '/apps/芋泥椰奶/小昕昕❤\uFE0F小叶叶',
  '/小昕昕小叶叶',
  '/apps/芋泥椰奶/小昕昕小叶叶',
]

/**
 * 探测可用的网盘照片源目录：依次尝试候选路径，返回第一个能列出内容的路径
 * @param {string} token
 * @returns {Promise<{dir: string, errno: number}|null>}
 */
async function resolvePhotoSourceDir(token) {
  for (const dir of PHOTO_SOURCE_CANDIDATES) {
    try {
      const url =
        `https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${token}` +
        `&dir=${encodeURIComponent(dir)}&order=time&desc=1&start=0&limit=1&web=1`
      const resp = await fetch(url)
      const data = await resp.json()
      if (!data.errno || data.errno === 0) {
        return { dir, errno: 0 }
      }
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null
}

const __dirname_token = dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = join(__dirname_token, '.baidu-token.json')

// token 持久化到磁盘，dev server 重启后自动恢复
const tokenStore = {
  access_token: '',
  refresh_token: '',
  expires_at: 0, // 毫秒时间戳
}

// 启动时从磁盘加载 token
try {
  if (existsSync(TOKEN_FILE)) {
    const raw = readFileSync(TOKEN_FILE, 'utf-8')
    const saved = JSON.parse(raw)
    tokenStore.access_token = saved.access_token || ''
    tokenStore.refresh_token = saved.refresh_token || ''
    tokenStore.expires_at = saved.expires_at || 0
  }
} catch {
  /* 静默忽略损坏的 token 文件 */
}

function persistToken() {
  try {
    writeFileSync(
      TOKEN_FILE,
      JSON.stringify({
        access_token: tokenStore.access_token,
        refresh_token: tokenStore.refresh_token,
        expires_at: tokenStore.expires_at,
      }),
    )
  } catch {
    /* 静默忽略写入失败 */
  }
}

// dlink 缓存：fs_id -> { dlink, expires_at }
const dlinkCache = new Map()
const DLINK_TTL_MS = 7 * 60 * 60 * 1000 // 7 小时（百度 dlink 8h 过期，留 1h 缓冲）

/** 是否已配置百度凭证 */
function hasBaiduCreds(env) {
  return Boolean(env.VITE_BAIDU_APP_KEY && env.VITE_BAIDU_SECRET_KEY)
}

/** 检查并刷新 token（提前 5 分钟） */
async function ensureValidToken(env) {
  if (!tokenStore.access_token) return null
  const buffer = 5 * 60 * 1000
  if (Date.now() + buffer < tokenStore.expires_at) {
    return tokenStore.access_token
  }
  if (!tokenStore.refresh_token) return null
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refresh_token,
      client_id: env.VITE_BAIDU_APP_KEY,
      client_secret: env.VITE_BAIDU_SECRET_KEY,
    })
    const resp = await fetch('https://openapi.baidu.com/oauth/2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await resp.json()
    if (data.error) {
      tokenStore.access_token = ''
      tokenStore.refresh_token = ''
      tokenStore.expires_at = 0
      persistToken()
      return null
    }
    tokenStore.access_token = data.access_token
    tokenStore.refresh_token = data.refresh_token
    tokenStore.expires_at = Date.now() + (data.expires_in || 2592000) * 1000
    persistToken()
    return tokenStore.access_token
  } catch {
    return null
  }
}

// ---------- 百度 API 服务端缓存 ----------
// 网盘目录递归遍历实测 20-30s，而结果短期不会变化：
//  - 内存缓存 + TTL 30 分钟，命中的请求秒回
//  - 并发去重：同一 key 同时多个请求时共享同一次遍历，避免重复打网盘接口
//  - stale-while-revalidate：缓存过期后先返回旧数据，后台静默刷新
//  - URL 带 ?refresh=1 时强制绕过缓存重新遍历（供手动刷新场景）
const BAIDU_CACHE_TTL = 30 * 60 * 1000
const baiduCache = new Map() // key -> { value, expiresAt, inflight }

function cachedBaidu(key, fn) {
  const now = Date.now()
  const hit = baiduCache.get(key)
  if (hit && hit.value && hit.expiresAt > now) {
    return Promise.resolve(hit.value) // 新鲜命中
  }
  if (hit && hit.inflight) {
    return hit.inflight // 并发去重：共享进行中的遍历
  }
  if (hit && hit.value) {
    // 过期：后台刷新，先返回旧值（stale-while-revalidate）
    hit.inflight = fn()
      .then((v) => {
        baiduCache.set(key, { value: v, expiresAt: Date.now() + BAIDU_CACHE_TTL, inflight: null })
        return v
      })
      .catch((e) => {
        hit.inflight = null
        throw e
      })
    return Promise.resolve(hit.value)
  }
  const promise = fn()
    .then((v) => {
      baiduCache.set(key, { value: v, expiresAt: Date.now() + BAIDU_CACHE_TTL, inflight: null })
      return v
    })
    .catch((e) => {
      baiduCache.delete(key)
      throw e
    })
  baiduCache.set(key, { value: null, expiresAt: 0, inflight: promise })
  return promise
}

/**
 * 递归列出网盘目录下所有「直接包含照片」的子文件夹，每个作为一个相册。
 *  - 顶层目录本身的直接照片也算作一个"根相册"
 *  - 嵌套子文件夹会被递归发现（用户需求：有些相册嵌套在子文件夹里）
 *  - 只有「直接包含照片文件」的目录才作为相册，避免空目录污染
 * 返回每个相册：{ path, name, count, coverFsid }
 * @param {string} token access_token
 * @param {string} dir 网盘目录绝对路径
 * @param {number} maxAlbums 安全上限（防止异常目录爆栈）
 */
async function listPanAlbums(token, dir, maxAlbums = 500) {
  const imageExt = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
  const albums = []
  const visited = new Set()
  const queue = [dir]

  while (queue.length > 0 && albums.length < maxAlbums) {
    const currentDir = queue.shift()
    if (visited.has(currentDir)) continue
    visited.add(currentDir)

    let start = 0
    const limit = 1000
    let directPhotos = []
    const subdirs = []
    let pageSafety = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (pageSafety++ > 100) break // 单目录安全上限：100 页 = 10 万项
      const u =
        `https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${token}` +
        `&dir=${encodeURIComponent(currentDir)}&order=time&desc=1&start=${start}&limit=${limit}&web=1`
      const r = await fetch(u)
      const d = await r.json()
      if (d.errno && d.errno !== 0) {
        // -9 目录不存在 / -10 无权限：跳过该目录而非整体失败
        if (d.errno === -9 || d.errno === -10) break
        throw new Error(`百度 list 接口错误: errno=${d.errno} dir=${currentDir}`)
      }
      const l = Array.isArray(d.list) ? d.list : []
      if (l.length === 0) break
      for (const f of l) {
        if (f.isdir === 1) {
          subdirs.push(f.path)
        } else if (imageExt.test(f.server_filename || f.filename || '')) {
          directPhotos.push(f)
        }
      }
      if (l.length < limit) break
      start += limit
    }

    // 当前目录直接包含照片 → 作为一个相册（封面取最新一张）
    if (directPhotos.length > 0) {
      albums.push({
        path: currentDir,
        name: currentDir.split('/').pop() || '根目录',
        count: directPhotos.length,
        coverFsid: directPhotos[0].fs_id,
      })
    }
    // 子目录入队，继续递归
    for (const sub of subdirs) {
      if (!visited.has(sub)) queue.push(sub)
    }
  }
  return albums
}

/**
 * 列出网盘目录下所有图片文件（自动翻页 + 递归子目录）
 * 百度 list 接口单页最多 1000 项；为支持用户上万张照片，递归遍历所有子目录。
 * @param {string} token access_token
 * @param {string} dir 网盘目录绝对路径
 * @param {number} maxFiles 安全上限（防止异常目录爆栈）
 */
async function listPanFiles(token, dir, maxFiles = 100000) {
  const imageExt = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
  const all = []
  const dirQueue = [dir]
  const visited = new Set()

  while (dirQueue.length > 0 && all.length < maxFiles) {
    const currentDir = dirQueue.shift()
    if (visited.has(currentDir)) continue
    visited.add(currentDir)

    let start = 0
    const limit = 1000 // 百度单页最大值
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url =
        `https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${token}` +
        `&dir=${encodeURIComponent(currentDir)}&order=time&desc=1&start=${start}&limit=${limit}&web=1`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.errno && data.errno !== 0) {
        // -9: 目录不存在；-10: 没有访问权限。跳过该目录而非整体失败
        if (data.errno === -9 || data.errno === -10) break
        throw new Error(`百度 list 接口错误: errno=${data.errno} dir=${currentDir}`)
      }
      const list = Array.isArray(data.list) ? data.list : []
      for (const f of list) {
        if (f.isdir === 1) {
          dirQueue.push(f.path)
        } else if (imageExt.test(f.server_filename || f.filename || '')) {
          all.push(f)
          if (all.length >= maxFiles) break
        }
      }
      if (list.length < limit) break
      start += limit
      if (all.length >= maxFiles) break
    }
  }
  return all
}

/**
 * 调试用：单次列出指定目录（不递归），返回 errno + 前 5 项 + 总数
 */
async function debugListDir(token, dir) {
  const url =
    `https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${token}` +
    `&dir=${encodeURIComponent(dir)}&order=time&desc=1&start=0&limit=100&web=1`
  try {
    const resp = await fetch(url)
    const data = await resp.json()
    const list = Array.isArray(data.list) ? data.list : []
    return {
      dir,
      errno: data.errno || 0,
      total: list.length,
      sample: list.slice(0, 5).map((f) => ({
        name: f.server_filename || f.filename,
        path: f.path,
        isdir: f.isdir,
      })),
    }
  } catch (e) {
    return { dir, error: String(e.message || e) }
  }
}

/** 取一批 fs_id 的 dlink（含元信息） */
async function getFileMetas(token, fsids) {
  const url =
    `https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&access_token=${token}` +
    `&fsids=${encodeURIComponent(JSON.stringify(fsids))}&dlink=1`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errno && data.errno !== 0) {
    throw new Error(`百度 filemetas 接口错误: errno=${data.errno}`)
  }
  return Array.isArray(data.list) ? data.list : []
}

/** 获取单个文件的 dlink（带缓存） */
async function getDlink(token, fsid) {
  const cached = dlinkCache.get(fsid)
  if (cached && cached.expires_at > Date.now()) {
    return cached.dlink
  }
  const metas = await getFileMetas(token, [fsid])
  if (!metas.length) return null
  const dlink = metas[0].dlink
  if (!dlink) return null
  dlinkCache.set(fsid, { dlink, expires_at: Date.now() + DLINK_TTL_MS })
  return dlink
}

/** 统一 CORS 响应头 */
// ===== 内容管理 API =====
// 直接读写 blog/src/data/ 目录下的 JSON 和 MD 文件

// blog 数据目录的绝对路径（admin 的上级 couple-blog/blog/src/data）
const BLOG_DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'blog', 'src', 'data')

// 支持的 JSON 资源类型
const JSON_RESOURCES = {
  moods: 'moods.json',
  moments: 'moments.json',
  anniversaries: 'anniversaries.json',
  timeline: 'timeline.json',
  friends: 'friends.json',
  'photos-manifest': 'photos-manifest.json',
  'local-photos-manifest': 'local-photos-manifest.json',
}

// blog public 目录（用于写入缩略图等静态资源）
const BLOG_PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'blog', 'public')
const BLOG_PHOTOS_DIR = join(BLOG_PUBLIC_DIR, 'photos')

// 本地照片 manifest（6MB+）模块级缓存：日记封面"当日照片"候选列表只读一次
let _localManifestCache = null
async function loadLocalManifest() {
  if (_localManifestCache) return _localManifestCache
  _localManifestCache = readJsonArray(join(BLOG_DATA_DIR, 'local-photos-manifest.json'))
  return _localManifestCache
}

/** 安全读取 JSON 文件，返回数组 */
function readJsonArray(filePath) {
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** 安全写入 JSON 文件 */
function writeJsonFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

/** 解析 frontmatter + body */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }
  const fmText = match[1]
  const body = match[2]
  const data = {}
  for (const line of fmText.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) {
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      data[m[1]] = val
    }
  }
  return { data, body }
}

/** 生成 frontmatter + body */
function stringifyFrontmatter(data, body) {
  const lines = ['---']
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === '') continue
    const val = String(v).includes(':') || String(v).includes('#') ? `"${v}"` : v
    lines.push(`${k}: ${val}`)
  }
  lines.push('---', '')
  return lines.join('\n') + (body || '')
}

/** 从标题生成 slug */
function generateSlug(title) {
  return title
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50) || 'diary'
}

/** 生成日记文件名 */
function buildDiaryFilename(date, slug) {
  const d = date || new Date().toISOString().slice(0, 10)
  return `${d}-${slug}.md`
}

/** 读取 JSON 资源 */
function handleReadJsonResource(res, resource) {
  const fileName = JSON_RESOURCES[resource]
  if (!fileName) return sendJson(res, 400, { error: `未知资源类型: ${resource}` })
  const filePath = join(BLOG_DATA_DIR, fileName)
  const data = readJsonArray(filePath)
  sendJson(res, 200, { data })
  return true
}

/** 新增 JSON 资源条目 */
function handleCreateJsonItem(res, resource, body) {
  const fileName = JSON_RESOURCES[resource]
  if (!fileName) return sendJson(res, 400, { error: `未知资源类型: ${resource}` })
  const filePath = join(BLOG_DATA_DIR, fileName)
  const items = readJsonArray(filePath)
  const newItem = { id: Date.now().toString(36), ...body }
  items.unshift(newItem)
  writeJsonFile(filePath, items)
  sendJson(res, 201, { data: newItem })
  return true
}

/** 更新 JSON 资源条目 */
function handleUpdateJsonItem(res, resource, id, body) {
  const fileName = JSON_RESOURCES[resource]
  if (!fileName) return sendJson(res, 400, { error: `未知资源类型: ${resource}` })
  const filePath = join(BLOG_DATA_DIR, fileName)
  const items = readJsonArray(filePath)
  const idx = items.findIndex((it) => String(it.id) === String(id))
  if (idx === -1) return sendJson(res, 404, { error: '条目不存在' })
  items[idx] = { ...items[idx], ...body, id: items[idx].id }
  writeJsonFile(filePath, items)
  sendJson(res, 200, { data: items[idx] })
  return true
}

/** 删除 JSON 资源条目 */
function handleDeleteJsonItem(res, resource, id) {
  const fileName = JSON_RESOURCES[resource]
  if (!fileName) return sendJson(res, 400, { error: `未知资源类型: ${resource}` })
  const filePath = join(BLOG_DATA_DIR, fileName)
  const items = readJsonArray(filePath)
  const next = items.filter((it) => String(it.id) !== String(id))
  if (next.length === items.length) return sendJson(res, 404, { error: '条目不存在' })
  writeJsonFile(filePath, next)
  sendJson(res, 200, { ok: true })
  return true
}

/** 整体替换 JSON 资源（批量保存） */
function handleReplaceJsonResource(res, resource, body) {
  const fileName = JSON_RESOURCES[resource]
  if (!fileName) return sendJson(res, 400, { error: `未知资源类型: ${resource}` })
  if (!Array.isArray(body)) return sendJson(res, 400, { error: '请求体必须是数组' })
  const filePath = join(BLOG_DATA_DIR, fileName)
  writeJsonFile(filePath, body)
  sendJson(res, 200, { data: body })
  return true
}

/** 列出日记文件 */
function handleListDiaries(res) {
  const dir = join(BLOG_DATA_DIR, 'diaries')
  if (!existsSync(dir)) {
    sendJson(res, 200, { data: [] })
    return true
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = join(dir, f)
      const stat = statSync(filePath)
      const raw = readFileSync(filePath, 'utf-8')
      const { data } = parseFrontmatter(raw)
      return {
        filename: f,
        title: data.title || f.replace(/\.md$/, ''),
        date: data.date || '',
        summary: data.summary || '',
        cover: data.cover || '',
        mtime: stat.mtime.toISOString(),
      }
    })
    .sort((a, b) => (a.filename < b.filename ? 1 : -1))
  sendJson(res, 200, { data: files })
  return true
}

/** 读取单个日记 */
function handleReadDiary(res, filename) {
  if (!filename || filename.includes('..')) {
    sendJson(res, 400, { error: '无效的文件名' })
    return true
  }
  const filePath = join(BLOG_DATA_DIR, 'diaries', filename)
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: '日记不存在' })
    return true
  }
  const raw = readFileSync(filePath, 'utf-8')
  const { data, body } = parseFrontmatter(raw)
  sendJson(res, 200, {
    data: {
      filename,
      date: data.date || '',
      title: data.title || '',
      cover: data.cover || '',
      summary: data.summary || '',
      body,
    },
  })
  return true
}

/** 新建/更新日记 */
function handleSaveDiary(res, body, filename) {
  const { title, date, cover, summary, content } = body || {}
  if (!title || !title.trim()) {
    sendJson(res, 400, { error: '请填写标题' })
    return true
  }
  const slug = generateSlug(title)
  let fn = filename || buildDiaryFilename(date, slug)
  if (fn.includes('..')) {
    sendJson(res, 400, { error: '无效的文件名' })
    return true
  }
  const diariesDir = join(BLOG_DATA_DIR, 'diaries')
  mkdirSync(diariesDir, { recursive: true })

  // 新日记：目标文件已存在时追加 -2/-3 后缀，避免静默覆盖旧日记
  if (!filename) {
    const base = fn.replace(/\.md$/, '')
    let counter = 2
    while (existsSync(join(diariesDir, fn))) {
      fn = `${base}-${counter++}.md`
    }
  }

  // 编辑已有日记：合并原 frontmatter，保留编辑器不管理的字段（tags、location 等），
  // 避免保存一次就静默抹掉博客端依赖的额外数据
  let fmData = { date: date || '', title, cover: cover || '', summary: summary || '' }
  const filePath = join(diariesDir, fn)
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const { data: existing } = parseFrontmatter(raw)
      fmData = { ...existing, ...fmData }
    } catch {
      /* 原文件不可解析时按新数据写入 */
    }
  }
  const fileContent = stringifyFrontmatter(fmData, content || '')
  writeFileSync(filePath, fileContent, 'utf-8')
  sendJson(res, 200, { data: { filename: fn } })
  return true
}

/** 删除日记 */
function handleDeleteDiary(res, filename) {
  if (!filename || filename.includes('..')) {
    sendJson(res, 400, { error: '无效的文件名' })
    return true
  }
  const filePath = join(BLOG_DATA_DIR, 'diaries', filename)
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: '日记不存在' })
    return true
  }
  unlinkSync(filePath)
  sendJson(res, 200, { ok: true })
  return true
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

/** 安全解析 JSON body */
async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf-8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** 发送 JSON */
function sendJson(res, status, body) {
  setCors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/**
 * 处理百度 token 保存
 * POST /api/baidu/save-token
 *
 * 向后兼容：浏览器端 OAuth 流程仍可通过此接口把 token 推到 server。
 * 新的 server 端 OAuth 流程（/api/baidu/qr-code、/api/baidu/qr-status）不再依赖此接口。
 */
async function handleSaveToken(req, res) {
  const body = await readJsonBody(req)
  const { access_token, refresh_token, expires_in } = body || {}
  if (!access_token) {
    return sendJson(res, 400, { error: 'access_token required' })
  }
  tokenStore.access_token = access_token
  tokenStore.refresh_token = refresh_token || ''
  tokenStore.expires_at = Date.now() + (Number(expires_in) || 2592000) * 1000
  persistToken()
  // 清空 dlink 缓存（新 token 后旧 dlink 仍可用，但保险起见）
  dlinkCache.clear()
  return sendJson(res, 200, { ok: true, expires_at: tokenStore.expires_at })
}

/**
 * 服务端 OAuth：获取设备码 + 二维码
 * GET /api/baidu/qr-code
 *
 * token 永不经过浏览器，全部在 server 端 fetch 百度开放平台。
 * 参考文档：https://openauth.baidu.com/doc/doc.html
 */
async function handleGetQrCode(res, env) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, {
      error: 'baidu credentials not configured',
      message: '请在 admin/.env.local 配置 VITE_BAIDU_APP_KEY / VITE_BAIDU_SECRET_KEY',
    })
  }
  try {
    const params = new URLSearchParams({
      client_id: env.VITE_BAIDU_APP_KEY,
      scope: 'basic,netdisk',
      response_type: 'device_code',
    })
    const resp = await fetch('https://openapi.baidu.com/oauth/2.0/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await resp.json()
    if (data.error) {
      return sendJson(res, 502, {
        error: data.error,
        message: data.error_description || data.error,
      })
    }
    return sendJson(res, 200, {
      qrcode_url: data.qrcode_url,
      device_code: data.device_code,
      verification_url: data.verification_url,
      expires_in: data.expires_in || 300,
      interval: data.interval || 5,
    })
  } catch (e) {
    return sendJson(res, 502, { error: 'device code fetch failed', message: String(e.message || e) })
  }
}

/**
 * 服务端 OAuth：轮询扫码状态，成功则把 token 存入 tokenStore + 持久化磁盘
 * GET /api/baidu/qr-status?code=<device_code>
 *
 * 返回：
 *   { status: 'pending' }                       未扫码 / 已扫码未确认
 *   { status: 'authorized', expires_at: <ms> }  授权成功
 *   { status: 'expired' }                       二维码过期，需重新获取
 *   { status: 'error', message: '...' }         其他错误
 */
async function handleQrStatus(res, env, deviceCode) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  if (!deviceCode) {
    return sendJson(res, 400, { error: 'device_code (code) required' })
  }
  try {
    const params = new URLSearchParams({
      grant_type: 'device_token',
      code: deviceCode,
      client_id: env.VITE_BAIDU_APP_KEY,
      client_secret: env.VITE_BAIDU_SECRET_KEY,
    })
    const resp = await fetch('https://openapi.baidu.com/oauth/2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await resp.json()
    if (data.error) {
      // 未扫码 / 已扫码未确认 / 轮询过快
      if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        return sendJson(res, 200, { status: 'pending' })
      }
      // 二维码过期
      if (data.error === 'expired_token') {
        return sendJson(res, 200, { status: 'expired', message: '二维码已过期，请重新获取' })
      }
      return sendJson(res, 200, {
        status: 'error',
        message: data.error_description || data.error,
      })
    }
    // 授权成功：存 token + 持久化
    tokenStore.access_token = data.access_token
    tokenStore.refresh_token = data.refresh_token || ''
    tokenStore.expires_at = Date.now() + (data.expires_in || 2592000) * 1000
    persistToken()
    dlinkCache.clear()
    return sendJson(res, 200, {
      status: 'authorized',
      expires_at: tokenStore.expires_at,
    })
  } catch (e) {
    return sendJson(res, 502, { status: 'error', message: String(e.message || e) })
  }
}

/**
 * 服务端 OAuth：退出授权，清空 server 端 token + 磁盘文件
 * POST /api/baidu/logout
 */
async function handleBaiduLogout(res) {
  tokenStore.access_token = ''
  tokenStore.refresh_token = ''
  tokenStore.expires_at = 0
  persistToken()
  dlinkCache.clear()
  return sendJson(res, 200, { ok: true })
}

/**
 * 处理百度授权状态查询
 * GET /api/baidu/status
 */
async function handleBaiduStatus(res, env) {
  const credsReady = hasBaiduCreds(env)
  if (!credsReady) {
    return sendJson(res, 200, {
      authorized: false,
      credentialsConfigured: false,
      photoDir: PHOTO_SOURCE_DIR,
    })
  }
  const token = await ensureValidToken(env)
  return sendJson(res, 200, {
    authorized: Boolean(token),
    credentialsConfigured: true,
    photoDir: PHOTO_SOURCE_DIR,
    expires_at: tokenStore.expires_at || 0,
  })
}

/**
 * 获取当前 access_token（供前端代理调用百度 API 使用）
 * GET /api/baidu/token
 */
async function handleBaiduToken(res, env) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  const token = await ensureValidToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'not authorized', message: '请先扫码授权' })
  }
  return sendJson(res, 200, { access_token: token })
}

/**
 * 列出网盘照片（含代理 URL）
 * GET /api/baidu/photos?refresh=1（refresh 强制重新遍历网盘）
 */
async function handleListPhotos(res, env, refresh = false) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  const token = await ensureValidToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'baidu not authorized', message: '请先在 admin 中扫码授权' })
  }
  try {
    // 探测可用的源目录（主路径可能因 emoji/路径差异失败）
    const resolved = await resolvePhotoSourceDir(token)
    const sourceDir = resolved?.dir || PHOTO_SOURCE_DIR
    // 服务端缓存：网盘遍历 20-30s，30 分钟内重复请求直接命中缓存
    const files = refresh
      ? await listPanFiles(token, sourceDir)
      : await cachedBaidu(`photos:${sourceDir}:${token}`, () => listPanFiles(token, sourceDir))
    const photos = files.map((f) => ({
      fs_id: f.fs_id,
      filename: f.server_filename || f.filename || '',
      size: f.size,
      mtime: f.local_mtime || f.server_mtime || 0,
      // 浏览器访问需带 admin origin；这里返回相对路径，由 blog 拼前缀
      url: `/api/baidu/image/${f.fs_id}`,
      // 透传路径，便于 blog 端按文件名匹配本地 manifest 的 EXIF 元数据
      path: f.path,
    }))
    return sendJson(res, 200, {
      photoDir: sourceDir,
      count: photos.length,
      photos,
    })
  } catch (e) {
    return sendJson(res, 502, { error: 'list failed', message: String(e.message || e) })
  }
}

/**
 * 列出网盘相册（子文件夹）列表 + 封面
 * GET /api/baidu/albums?refresh=1（refresh 强制重新遍历网盘）
 */
async function handleListAlbums(res, env, refresh = false) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  const token = await ensureValidToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'baidu not authorized', message: '请先在 admin 中扫码授权' })
  }
  try {
    // 探测可用的源目录
    const resolved = await resolvePhotoSourceDir(token)
    const sourceDir = resolved?.dir || PHOTO_SOURCE_DIR
    // 服务端缓存：相册遍历 20-30s，30 分钟内重复请求直接命中缓存
    const albums = refresh
      ? await listPanAlbums(token, sourceDir)
      : await cachedBaidu(`albums:${sourceDir}:${token}`, () => listPanAlbums(token, sourceDir))
    // admin「照片墙」上传目录也作为一个相册展示 —— 否则上传的照片在博客永远看不到
    const uploadDir = `/apps/${env.VITE_BAIDU_APP_NAME || '芋泥椰奶'}/照片墙`
    if (uploadDir !== sourceDir && !albums.some((a) => a.path === uploadDir)) {
      try {
        const files = await listPanFiles(token, uploadDir)
        if (Array.isArray(files) && files.length > 0) {
          albums.push({
            path: uploadDir,
            name: '照片墙',
            count: files.length,
            coverFsid: files[0].fs_id,
          })
        }
      } catch {
        /* 上传目录不存在则跳过 */
      }
    }
    return sendJson(res, 200, {
      photoDir: sourceDir,
      count: albums.length,
      albums: albums.map((a) => ({
        ...a,
        coverUrl: `/api/baidu/image/${a.coverFsid}`,
      })),
    })
  } catch (e) {
    return sendJson(res, 502, { error: 'list albums failed', message: String(e.message || e) })
  }
}

/**
 * 列出某个相册（子文件夹）内的照片
 * GET /api/baidu/album-photos?path=<网盘路径>&refresh=1
 */
async function handleListAlbumPhotos(res, env, albumPath, refresh = false) {
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  const token = await ensureValidToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'baidu not authorized' })
  }
  if (!albumPath) {
    return sendJson(res, 400, { error: 'path required' })
  }
  try {
    // 服务端缓存：相册内照片列表同样缓存 30 分钟
    const files = refresh
      ? await listPanFiles(token, albumPath)
      : await cachedBaidu(`album:${albumPath}:${token}`, () => listPanFiles(token, albumPath))
    const photos = files.map((f) => ({
      fs_id: f.fs_id,
      filename: f.server_filename || f.filename || '',
      size: f.size,
      mtime: f.local_mtime || f.server_mtime || 0,
      url: `/api/baidu/image/${f.fs_id}`,
      path: f.path,
    }))
    return sendJson(res, 200, { album: albumPath, count: photos.length, photos })
  } catch (e) {
    return sendJson(res, 502, { error: 'list album photos failed', message: String(e.message || e) })
  }
}

/**
 * 代理百度网盘图片字节流
 * GET /api/baidu/image/:fsid
 */
async function handleImageProxy(req, res, fsidStr, env) {
  if (!/^\d+$/.test(fsidStr)) {
    return sendJson(res, 400, { error: 'invalid fsid' })
  }
  const fsid = Number(fsidStr)
  if (!hasBaiduCreds(env)) {
    return sendJson(res, 400, { error: 'baidu credentials not configured' })
  }
  const token = await ensureValidToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'baidu not authorized' })
  }
  try {
    const dlink = await getDlink(token, fsid)
    if (!dlink) {
      return sendJson(res, 404, { error: 'dlink not found, file may not exist' })
    }
    // 百度 filemetas 返回的 dlink 不含 access_token，下载时必须拼接，否则返回 403
    const downloadUrl =
      dlink + (dlink.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token)
    const upstreamResp = await fetch(downloadUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
    })
    if (!upstreamResp.ok) {
      return sendJson(res, upstreamResp.status, {
        error: 'upstream error',
        status: upstreamResp.status,
      })
    }
    const contentType = upstreamResp.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await upstreamResp.arrayBuffer())
    setCors(res)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    // 浏览器缓存 1 天，减少 admin 代理压力
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  } catch (e) {
    return sendJson(res, 502, { error: 'image proxy failed', message: String(e.message || e) })
  }
}

/** 健康检查 */
function handleHealth(res) {
  setCors(res)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, ts: Date.now() }))
}

// ============================================================
// 网易云音乐 OpenAPI 代理（openncm.music.163.com）
// 端点基址、ncmcli 风格 device 公共参数、RSA_SHA256 签名
// ============================================================

const NETEASE_BASE = 'https://openncm.music.163.com'

const NETEASE_TOKEN_FILE = join(__dirname_token, '.netease-token.json')
const NETEASE_CONFIG_FILE = join(__dirname_token, '.netease-config.json')

// 用户授权 token（扫码登录后获得）
const neteaseTokenStore = {
  accessToken: '',
  refreshToken: '',
  expireTime: 0, // 秒级时间戳
  user: null, // { userId, nickname, avatarUrl }
}

// 用户在 admin 选中的歌单 + 音质
const neteaseConfigStore = {
  selectedPlaylistIds: [],
  audioLevel: 'exhigh', // standard|higher|exhigh|lossless|hires
}

try {
  if (existsSync(NETEASE_TOKEN_FILE)) {
    const saved = JSON.parse(readFileSync(NETEASE_TOKEN_FILE, 'utf-8'))
    neteaseTokenStore.accessToken = saved.accessToken || ''
    neteaseTokenStore.refreshToken = saved.refreshToken || ''
    neteaseTokenStore.expireTime = saved.expireTime || 0
    neteaseTokenStore.user = saved.user || null
  }
} catch {
  /* 静默忽略损坏的 token 文件 */
}

try {
  if (existsSync(NETEASE_CONFIG_FILE)) {
    const saved = JSON.parse(readFileSync(NETEASE_CONFIG_FILE, 'utf-8'))
    if (Array.isArray(saved.selectedPlaylistIds)) {
      neteaseConfigStore.selectedPlaylistIds = saved.selectedPlaylistIds
    }
    if (saved.audioLevel) neteaseConfigStore.audioLevel = saved.audioLevel
  }
} catch {
  /* 静默忽略损坏的 config 文件 */
}

function persistNeteaseToken() {
  try {
    writeFileSync(
      NETEASE_TOKEN_FILE,
      JSON.stringify({
        accessToken: neteaseTokenStore.accessToken,
        refreshToken: neteaseTokenStore.refreshToken,
        expireTime: neteaseTokenStore.expireTime,
        user: neteaseTokenStore.user,
        deviceId: NETEASE_DEVICE_ID,
      }),
    )
  } catch {
    /* 静默忽略写入失败 */
  }
}

function persistNeteaseConfig() {
  try {
    writeFileSync(NETEASE_CONFIG_FILE, JSON.stringify(neteaseConfigStore))
  } catch {
    /* 静默忽略写入失败 */
  }
}

// 匿名 token 缓存（用于扫码登录前置步骤）
const anonymousTokenCache = { token: '', expiresAt: 0 }

// 扫码 key 状态：qrcodeKey -> { uniKey, clientId, createdAt }
const qrKeyState = new Map()

// device 公共参数（ncmcli 风格）
// deviceId 持久化到 token 文件：扫码登录拿到的 accessToken 绑定在 deviceId 上，
// 若每次启动重新生成，重启后旧 token 会被网关拒绝（HTTP 400 空响应）。
let NETEASE_DEVICE_ID = ''
try {
  if (existsSync(NETEASE_TOKEN_FILE)) {
    const saved = JSON.parse(readFileSync(NETEASE_TOKEN_FILE, 'utf-8'))
    if (saved.deviceId) NETEASE_DEVICE_ID = saved.deviceId
  }
} catch {
  /* 静默忽略损坏的 token 文件 */
}
if (!NETEASE_DEVICE_ID) {
  NETEASE_DEVICE_ID = `ncmcli_${crypto.randomBytes(8).toString('hex')}`
}
const NETEASE_DEVICE = JSON.stringify({
  deviceType: 'openapi',
  os: 'ncmcli',
  appVer: '0.1.6',
  channel: 'ncmcli',
  model: 'Windows_x64_cli',
  brand: 'ncmcli',
  osVer: os.release(),
  clientIp: '127.0.0.1',
  deviceId: NETEASE_DEVICE_ID,
})

/** 是否已配置网易云凭证 */
function hasNeteaseCreds(env) {
  return Boolean(env.VITE_NETEASE_CLIENT_ID && env.VITE_NETEASE_PRIVATE_KEY)
}

/** 单行 base64 PKCS8 私钥 → PEM（crypto.createSign 需要 PEM 格式） */
function privateKeyToPem(base64) {
  const cleaned = (base64 || '').replace(/\s+/g, '').replace(/-----[^-]+-----/g, '')
  if (!cleaned) return ''
  const lines = []
  for (let i = 0; i < cleaned.length; i += 64) {
    lines.push(cleaned.slice(i, i + 64))
  }
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

/** RSA-SHA256 签名：参数按 key ASCII 升序拼成 k=v&k=v&... */
function signRequest(params, privateKeyPem) {
  const sorted = Object.keys(params).sort()
  const stringToSign = sorted.map((k) => `${k}=${params[k]}`).join('&')
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign, 'utf8')
  return signer.sign(privateKeyPem, 'base64')
}

/**
 * 调用网易云 OpenAPI（GET，所有参数走 query string）
 * @param {string} path  /openapi/...
 * @param {object} opts  { bizContent: object, accessToken?: string, env }
 * @returns {Promise<object>} 响应 JSON
 */
async function iotRequest(path, opts) {
  const { bizContent, accessToken, env } = opts
  const appId = env.VITE_NETEASE_CLIENT_ID
  const privateKeyPem = privateKeyToPem(env.VITE_NETEASE_PRIVATE_KEY)

  const params = {
    appId,
    signType: 'RSA_SHA256',
    timestamp: String(Date.now()),
    device: NETEASE_DEVICE,
    bizContent: JSON.stringify(bizContent),
  }
  if (accessToken) params.accessToken = accessToken
  params.sign = signRequest(params, privateKeyPem)

  const url = `${NETEASE_BASE}${path}?${new URLSearchParams(params).toString()}`
  // 20s 超时：上游挂起时避免请求无限挂住（按钮一直转圈）
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  let resp
  try {
    resp = await fetch(url, {
      headers: { 'User-Agent': 'ncmcli/0.1.6' },
      signal: ctrl.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error('网易云接口请求超时（20s），请稍后重试')
    throw e
  }
  clearTimeout(timer)
  const status = resp.status
  const text = await resp.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    // 设备不匹配 / token 失效时网关返回 HTTP 400 + 空 body（常见于服务器重启后）
    if (status === 400 && !text.trim()) {
      throw new Error('网易云登录已失效（设备不匹配），请重新扫码授权')
    }
    throw new Error(`netease response not JSON (HTTP ${status}): ${text.slice(0, 200)}`)
  }
  // 设备未授权 / 缺少 token：本地 token 已失效，清除并提示重新登录
  if ((data.code === 1406 || data.code === 2509) && accessToken) {
    neteaseTokenStore.accessToken = ''
    neteaseTokenStore.refreshToken = ''
    neteaseTokenStore.expireTime = 0
    neteaseTokenStore.user = null
    persistNeteaseToken()
    throw new Error(data.message || data.msg || '网易云登录已失效，请重新扫码授权')
  }
  return data
}

/** 获取匿名 token（缓存 50 分钟，避免每次扫码都重新拿） */
async function getAnonymousToken(env) {
  if (anonymousTokenCache.token && Date.now() < anonymousTokenCache.expiresAt) {
    return anonymousTokenCache.token
  }
  const data = await iotRequest('/openapi/music/basic/oauth2/login/anonymous', {
    bizContent: { clientId: env.VITE_NETEASE_CLIENT_ID },
    env,
  })
  if (data.code !== 200 || !data.data || !data.data.accessToken) {
    throw new Error(
      `anonymous login failed: code=${data.code} msg=${data.message || data.msg || ''}`,
    )
  }
  anonymousTokenCache.token = data.data.accessToken
  const exp = data.data.expireTime ? Number(data.data.expireTime) : 0
  anonymousTokenCache.expiresAt = exp
    ? exp * 1000 - 5 * 60 * 1000
    : Date.now() + 50 * 60 * 1000
  return anonymousTokenCache.token
}

/** 拿到当前用户 token；过期则尝试刷新；都没则返回 null */
async function ensureNeteaseToken(env) {
  if (!neteaseTokenStore.accessToken) return null
  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec + 300 < neteaseTokenStore.expireTime) {
    return neteaseTokenStore.accessToken
  }
  if (!neteaseTokenStore.refreshToken) return null
  try {
    const data = await iotRequest('/openapi/music/basic/user/oauth2/token/refresh/v2', {
      bizContent: {
        refreshToken: neteaseTokenStore.refreshToken,
        clientId: env.VITE_NETEASE_CLIENT_ID,
      },
      env,
    })
    if (data.code !== 200 || !data.data || !data.data.accessToken) {
      neteaseTokenStore.accessToken = ''
      neteaseTokenStore.refreshToken = ''
      neteaseTokenStore.expireTime = 0
      neteaseTokenStore.user = null
      persistNeteaseToken()
      return null
    }
    const tokenObj = data.data.accessToken
    const tokenStr = typeof tokenObj === 'string' ? tokenObj : (tokenObj.accessToken || '')
    neteaseTokenStore.accessToken = tokenStr
    if (typeof tokenObj === 'object' && tokenObj.refreshToken) {
      neteaseTokenStore.refreshToken = tokenObj.refreshToken
    } else if (data.data.refreshToken) {
      neteaseTokenStore.refreshToken = data.data.refreshToken
    }
    const relExpire = typeof tokenObj === 'object' ? tokenObj.expireTime : 0
    neteaseTokenStore.expireTime = relExpire ? Math.floor(Date.now() / 1000) + Number(relExpire) : (data.data.expireTime ? Number(data.data.expireTime) : 0)
    persistNeteaseToken()
    return neteaseTokenStore.accessToken
  } catch {
    return null
  }
}

/** 拉取用户 profile */
async function fetchNeteaseUser(env, accessToken) {
  try {
    const data = await iotRequest('/openapi/music/basic/user/profile/get/v2', {
      bizContent: {},
      accessToken,
      env,
    })
    if (data.code === 200 && data.data) {
      const u = data.data
      return {
        userId: String(u.userId || u.accountId || ''),
        nickname: u.nickname || '',
        avatarUrl: u.avatarUrl || '',
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * GET /api/netease/diagnose
 * 测试匿名登录是否可用
 */
async function handleNeteaseDiagnose(res, env) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 200, {
      ok: false,
      code: 'NO_CREDENTIALS',
      message:
        'admin/.env.local 未配置 VITE_NETEASE_CLIENT_ID / VITE_NETEASE_PRIVATE_KEY',
    })
  }
  try {
    const data = await iotRequest('/openapi/music/basic/oauth2/login/anonymous', {
      bizContent: { clientId: env.VITE_NETEASE_CLIENT_ID },
      env,
    })
    if (data.code === 200 && data.data && data.data.accessToken) {
      return sendJson(res, 200, {
        ok: true,
        message: `匿名登录成功，accessToken 前 8 位：${data.data.accessToken.slice(0, 8)}…`,
        detail: {
          scopes: data.data.scopes,
          expireTime: data.data.expireTime,
          deviceId: NETEASE_DEVICE_ID,
        },
      })
    }
    return sendJson(res, 200, {
      ok: false,
      code: data.code,
      message: `匿名登录失败：code=${data.code} ${data.message || data.msg || ''}`,
    })
  } catch (e) {
    return sendJson(res, 200, {
      ok: false,
      code: 'EXCEPTION',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/qr-code
 * 1. 拿匿名 token
 * 2. 生成扫码 key
 * 返回：{ qrcodeUrl, qrcodeKey, expiresAt }
 */
async function handleNeteaseGetQrCode(res, env) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  try {
    const accessToken = await getAnonymousToken(env)
    const data = await iotRequest(
      '/openapi/music/basic/user/oauth2/qrcodekey/get/v2',
      {
        bizContent: { type: 2, expiredKey: '300' },
        accessToken,
        env,
      },
    )
    if (data.code !== 200 || !data.data) {
      return sendJson(res, 502, {
        error: 'qrcode key fetch failed',
        code: data.code,
        message: data.message || data.msg || '',
      })
    }
    const { qrCodeUrl, uniKey } = data.data
    // 163cn.tv 短链返回的是 HTML 页面而非图片，不能直接做 <img src>。
    // 用 qrcode 包把短链内容编码成 data URL，前端直接渲染。
    const qrcodeImg = await QRCode.toDataURL(qrCodeUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#000000', light: '#ffffff' },
    })
    // 自生成 qrcodeKey 作为前端轮询的句柄，避免暴露 uniKey
    const qrcodeKey = crypto.randomBytes(12).toString('hex')
    qrKeyState.set(qrcodeKey, {
      uniKey,
      clientId: env.VITE_NETEASE_CLIENT_ID,
      createdAt: Date.now(),
    })
    return sendJson(res, 200, {
      qrcodeUrl: qrcodeImg,
      qrcodeKey,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })
  } catch (e) {
    return sendJson(res, 502, {
      error: 'qr-code failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/qr-status?key=XXX
 * 状态映射：800=expired, 801=pending, 802=scanned, 803=authorized
 */
async function handleNeteaseQrStatus(res, env, key) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const state = qrKeyState.get(key)
  if (!state) {
    return sendJson(res, 400, { error: 'invalid or expired qrcodeKey' })
  }
  if (Date.now() - state.createdAt > 5 * 60 * 1000) {
    qrKeyState.delete(key)
    return sendJson(res, 200, { status: 'expired', message: '二维码已过期' })
  }
  try {
    const accessToken = await getAnonymousToken(env)
    const data = await iotRequest(
      '/openapi/music/basic/oauth2/device/login/qrcode/get',
      {
        bizContent: { key: state.uniKey, clientId: state.clientId },
        accessToken,
        env,
      },
    )
    if (data.code !== 200 || !data.data) {
      return sendJson(res, 200, {
        status: 'error',
        code: data.code,
        message: data.message || data.msg || '查询扫码状态失败',
      })
    }
    const d = data.data
    const status = d.status
    if (status === 803 && d.accessToken) {
      // 网易云 API 返回的 accessToken 可能是嵌套对象 { accessToken, refreshToken, expireTime }
      const tokenObj = d.accessToken
      const tokenStr = typeof tokenObj === 'string' ? tokenObj : (tokenObj.accessToken || '')
      neteaseTokenStore.accessToken = tokenStr
      neteaseTokenStore.refreshToken = (typeof tokenObj === 'object' ? tokenObj.refreshToken : '') || d.refreshToken || ''
      // expireTime 是秒级相对时长（如 86400），转为绝对时间戳
      const relExpire = typeof tokenObj === 'object' ? tokenObj.expireTime : 0
      neteaseTokenStore.expireTime = relExpire ? Math.floor(Date.now() / 1000) + Number(relExpire) : 0
      neteaseTokenStore.user = await fetchNeteaseUser(env, tokenStr)
      persistNeteaseToken()
      qrKeyState.delete(key)
      return sendJson(res, 200, { status: 'authorized' })
    }
    if (status === 800) {
      qrKeyState.delete(key)
      return sendJson(res, 200, { status: 'expired', message: '二维码已过期' })
    }
    if (status === 802) return sendJson(res, 200, { status: 'scanned' })
    // 801 或其他：按 pending 处理
    return sendJson(res, 200, { status: 'pending' })
  } catch (e) {
    return sendJson(res, 502, { status: 'error', message: String(e.message || e) })
  }
}

/**
 * GET /api/netease/token-status
 * 返回当前授权状态 + 用户信息
 */
/**
 * 验证 token 是否真正可用：调用与设备强绑定的歌单接口（profile 接口不校验设备绑定，
 * 旧 token 也能通过，无法发现"重启后设备不匹配"的问题）
 */
async function verifyNeteaseToken(env, token) {
  try {
    const data = await iotRequest('/openapi/music/basic/playlist/created/get/v2', {
      bizContent: {},
      accessToken: token,
      env,
    })
    return data.code === 200
  } catch {
    return false
  }
}

async function handleNeteaseTokenStatus(res, env) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 200, { authorized: false, credentialsConfigured: false })
  }
  const token = await ensureNeteaseToken(env)
  // 用设备强绑定的歌单接口验证 token（重启后 deviceId 变化会导致 token 失效）
  let authorized = false
  if (token) {
    authorized = await verifyNeteaseToken(env, token)
    if (!authorized) {
      neteaseTokenStore.accessToken = ''
      neteaseTokenStore.refreshToken = ''
      neteaseTokenStore.expireTime = 0
      neteaseTokenStore.user = null
      persistNeteaseToken()
    }
  }
  return sendJson(res, 200, {
    authorized,
    credentialsConfigured: true,
    user: authorized ? neteaseTokenStore.user : null,
    expireTime: neteaseTokenStore.expireTime,
    message: authorized ? '' : '登录已失效（设备不匹配），请重新扫码授权',
  })
}

/**
 * POST /api/netease/logout
 */
async function handleNeteaseLogout(res) {
  neteaseTokenStore.accessToken = ''
  neteaseTokenStore.refreshToken = ''
  neteaseTokenStore.expireTime = 0
  neteaseTokenStore.user = null
  persistNeteaseToken()
  return sendJson(res, 200, { ok: true })
}

/**
 * GET /api/netease/user-playlists
 * 拉取用户创建 + 收藏的歌单
 */
async function handleNeteaseUserPlaylists(res, env) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const token = await ensureNeteaseToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'not authorized', message: '请先扫码授权' })
  }
  try {
    const [created, subed] = await Promise.all([
      iotRequest('/openapi/music/basic/playlist/created/get/v2', {
        bizContent: {},
        accessToken: token,
        env,
      }),
      iotRequest('/openapi/music/basic/playlist/subed/get/v2', {
        bizContent: {},
        accessToken: token,
        env,
      }),
    ])
    const createdList =
      created.code === 200 && Array.isArray(created.data) ? created.data : []
    const subedList =
      subed.code === 200 && Array.isArray(subed.data) ? subed.data : []
    const all = [...createdList, ...subedList].map((p) => ({
      id: p.id || p.playlistId,
      name: p.name || '',
      coverImgUrl: p.coverImgUrl || p.picUrl || '',
      trackCount: p.trackCount || 0,
      creator: p.creator ? { nickname: p.creator.nickname || '' } : null,
    }))
    return sendJson(res, 200, { count: all.length, playlists: all })
  } catch (e) {
    return sendJson(res, 502, {
      error: 'playlists fetch failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/playlist-detail?id=<playlistId>
 * 翻页拉取歌单内歌曲列表（每页 100 首）
 */
async function handleNeteasePlaylistDetail(res, env, playlistId) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const token = await ensureNeteaseToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'not authorized' })
  }
  if (!playlistId) {
    return sendJson(res, 400, { error: 'id required' })
  }
  try {
    const all = []
    let page = 1
    const limit = 100
    let safety = 0
    while (safety++ < 100) {
      const data = await iotRequest(
        '/openapi/music/basic/playlist/song/list/get/v3',
        {
          bizContent: { playlistId: String(playlistId), page, limit },
          accessToken: token,
          env,
        },
      )
      if (data.code !== 200) {
        if (all.length === 0) {
          return sendJson(res, 502, {
            error: 'playlist detail failed',
            code: data.code,
            message: data.message || data.msg || '',
          })
        }
        break
      }
      const list = Array.isArray(data.data)
        ? data.data
        : (data.data && (data.data.songs || data.data.list)) || []
      if (list.length === 0) break
      for (const s of list) {
        all.push({
          id: s.songId || s.id,
          name: s.name || s.songName || '',
          artist: Array.isArray(s.artists)
            ? s.artists.map((a) => a.name).join(' / ')
            : s.artistName || '',
          album: (s.album && s.album.name) || s.albumName || '',
          duration: s.duration || 0,
          coverUrl: (s.album && s.album.picUrl) || s.picUrl || '',
        })
      }
      if (list.length < limit) break
      page++
    }
    return sendJson(res, 200, { count: all.length, songs: all })
  } catch (e) {
    return sendJson(res, 502, {
      error: 'playlist detail failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/songs
 * 合并已选歌单所有歌曲（去重），供 blog APlayer 使用
 */
async function handleNeteaseSongs(res, env) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const token = await ensureNeteaseToken(env)
  if (!token) {
    return sendJson(res, 401, {
      error: 'not authorized',
      message: '请先在 admin 扫码授权',
    })
  }
  const ids = neteaseConfigStore.selectedPlaylistIds.filter(Boolean)
  if (ids.length === 0) {
    return sendJson(res, 200, { count: 0, songs: [] })
  }
  try {
    const seen = new Set()
    const merged = []
    for (const pid of ids) {
      try {
        let page = 1
        const limit = 100
        let safety = 0
        while (safety++ < 50) {
          const data = await iotRequest(
            '/openapi/music/basic/playlist/song/list/get/v3',
            {
              bizContent: { playlistId: String(pid), page, limit },
              accessToken: token,
              env,
            },
          )
          if (data.code !== 200) break
          const list = Array.isArray(data.data)
            ? data.data
            : (data.data && (data.data.songs || data.data.list)) || []
          if (list.length === 0) break
          for (const s of list) {
            const id = s.songId || s.id
            if (!id || seen.has(id)) continue
            seen.add(id)
            merged.push({
              id,
              name: s.name || s.songName || '',
              artist: Array.isArray(s.artists)
                ? s.artists.map((a) => a.name).join(' / ')
                : s.artistName || '',
              album: (s.album && s.album.name) || s.albumName || '',
              duration: s.duration || 0,
              coverUrl: (s.album && s.album.picUrl) || s.picUrl || '',
              url: `/api/netease/song-mp3/${id}`,
            })
          }
          if (list.length < limit) break
          page++
        }
      } catch {
        /* 单个歌单失败不阻断整体 */
      }
    }
    return sendJson(res, 200, { count: merged.length, songs: merged })
  } catch (e) {
    return sendJson(res, 502, {
      error: 'merge songs failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/song-mp3/:songId
 * 透传音频字节流（songId 是 32 位加密字符串）
 */
async function handleNeteaseSongMp3(req, res, env, songId) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const token = await ensureNeteaseToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'not authorized' })
  }
  if (!/^[A-Za-z0-9_-]+$/.test(songId)) {
    return sendJson(res, 400, { error: 'invalid songId' })
  }
  try {
    // 音质 → bitrate 数字映射
    const levelMap = {
      standard: 128,
      higher: 192,
      exhigh: 320,
      lossless: 999,
      hires: 1999,
    }
    const bitrate = levelMap[neteaseConfigStore.audioLevel] || 320
    const data = await iotRequest('/openapi/music/basic/song/playurl/get/v2', {
      bizContent: { songId, bitrate },
      accessToken: token,
      env,
    })
    if (data.code !== 200 || !data.data) {
      return sendJson(res, 502, {
        error: 'playurl fetch failed',
        code: data.code,
        message: data.message || data.msg || '',
      })
    }
    const url = data.data.url
    if (!url) {
      return sendJson(res, 404, {
        error: 'no playurl',
        message: '歌曲可能版权受限或需 VIP',
      })
    }
    const audioResp = await fetch(url, {
      headers: { 'User-Agent': 'ncmcli/0.1.6' },
      redirect: 'follow',
    })
    if (!audioResp.ok) {
      return sendJson(res, audioResp.status, { error: 'audio upstream error' })
    }
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg'
    const buf = Buffer.from(await audioResp.arrayBuffer())
    setCors(res)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  } catch (e) {
    return sendJson(res, 502, {
      error: 'song-mp3 failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET /api/netease/lyrics?id=XXX
 */
async function handleNeteaseLyrics(res, env, songId) {
  if (!hasNeteaseCreds(env)) {
    return sendJson(res, 400, { error: 'netease credentials not configured' })
  }
  const token = await ensureNeteaseToken(env)
  if (!token) {
    return sendJson(res, 401, { error: 'not authorized' })
  }
  if (!songId) {
    return sendJson(res, 400, { error: 'id required' })
  }
  try {
    const data = await iotRequest('/openapi/music/basic/song/lyric/get/v2', {
      bizContent: { songId },
      accessToken: token,
      env,
    })
    if (data.code !== 200) {
      return sendJson(res, 502, {
        error: 'lyrics fetch failed',
        code: data.code,
        message: data.message || data.msg || '',
      })
    }
    return sendJson(res, 200, { lyrics: data.data })
  } catch (e) {
    return sendJson(res, 502, {
      error: 'lyrics failed',
      message: String(e.message || e),
    })
  }
}

/**
 * GET  /api/netease/config  -> 返回当前配置
 * POST /api/netease/config  -> 保存配置 { selectedPlaylistIds, audioLevel }
 */
async function handleNeteaseConfig(req, res) {
  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    if (Array.isArray(body.selectedPlaylistIds)) {
      neteaseConfigStore.selectedPlaylistIds = body.selectedPlaylistIds.map(String)
    }
    if (body.audioLevel) neteaseConfigStore.audioLevel = body.audioLevel
    persistNeteaseConfig()
    return sendJson(res, 200, { ok: true, config: neteaseConfigStore })
  }
  return sendJson(res, 200, neteaseConfigStore)
}

/**
 * Vite 插件入口
 */
export function adminServerPlugin() {
  return {
    name: 'admin-server-plugin',
    configureServer(server) {
      const env = server.config.env

      // 中间件需在 Vite 内置中间件之前注册，确保 /api/* 不被静态资源处理器吃掉
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]

        // 统一处理 OPTIONS 预检
        if (req.method === 'OPTIONS' && url.startsWith('/api/')) {
          setCors(res)
          res.statusCode = 204
          res.end()
          return
        }

        // 健康检查
        if (url === '/api/health') {
          handleHealth(res)
          return
        }

        // 百度 token 保存（向后兼容浏览器端 OAuth）
        if (url === '/api/baidu/save-token' && req.method === 'POST') {
          await handleSaveToken(req, res)
          return
        }

        // 服务端 OAuth：获取设备码 + 二维码
        if (url === '/api/baidu/qr-code' && req.method === 'GET') {
          await handleGetQrCode(res, env)
          return
        }

        // 服务端 OAuth：轮询扫码状态
        if (url === '/api/baidu/qr-status' && req.method === 'GET') {
          const code = new URL(req.url, 'http://localhost').searchParams.get('code') || ''
          await handleQrStatus(res, env, code)
          return
        }

        // 服务端 OAuth：退出授权
        if (url === '/api/baidu/logout' && req.method === 'POST') {
          await handleBaiduLogout(res)
          return
        }

        // 百度授权状态
        if (url === '/api/baidu/status' && req.method === 'GET') {
          await handleBaiduStatus(res, env)
          return
        }

        // 百度 access_token（供前端代理调用）
        if (url === '/api/baidu/token' && req.method === 'GET') {
          await handleBaiduToken(res, env)
          return
        }

        // 百度照片列表
        if (url === '/api/baidu/photos' && req.method === 'GET') {
          const refresh = new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1'
          await handleListPhotos(res, env, refresh)
          return
        }

        // 百度相册（子文件夹）列表 + 封面
        if (url === '/api/baidu/albums' && req.method === 'GET') {
          const refresh = new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1'
          await handleListAlbums(res, env, refresh)
          return
        }

        // 某个相册内的照片列表
        if (url === '/api/baidu/album-photos' && req.method === 'GET') {
          const sp = new URL(req.url, 'http://localhost').searchParams
          const albumPath = sp.get('path') || ''
          const refresh = sp.get('refresh') === '1'
          await handleListAlbumPhotos(res, env, albumPath, refresh)
          return
        }

        // 调试：探测多个候选路径的可访问性（排查沙箱/路径问题）
        if (url === '/api/baidu/debug' && req.method === 'GET') {
          const token = await ensureValidToken(env)
          if (!token) {
            return sendJson(res, 401, { error: 'not authorized' })
          }
          const candidates = [
            '/',
            '/apps',
            '/apps/芋泥椰奶',
            '/apps/芋泥椰奶/小昕昕❤小叶叶',
            '/小昕昕❤小叶叶',
            '/我的资源',
          ]
          const results = []
          for (const d of candidates) {
            results.push(await debugListDir(token, d))
          }
          return sendJson(res, 200, { results })
        }

        // 百度图片字节代理：/api/baidu/image/:fsid
        const imgMatch = url.match(/^\/api\/baidu\/image\/(\d+)$/)
        if (imgMatch && req.method === 'GET') {
          await handleImageProxy(req, res, imgMatch[1], env)
          return
        }

        // ===== 内容管理 API =====

        // JSON 资源单条操作优先匹配: /api/content/:resource/:id
        // 必须在 collection 路由之前，否则单条 PUT/DELETE 会被 collection 路由拦截
        const jsonItemMatch = url.match(/^\/api\/content\/(\w+)\/([^/]+)$/)
        if (jsonItemMatch && jsonItemMatch[1] !== 'diaries') {
          const [, resource, id] = jsonItemMatch
          if (JSON_RESOURCES[resource]) {
            if (req.method === 'PUT') {
              const body = await readJsonBody(req)
              handleUpdateJsonItem(res, resource, id, body)
              return
            }
            if (req.method === 'DELETE') {
              handleDeleteJsonItem(res, resource, id)
              return
            }
          }
        }

        // JSON 资源 collection 操作: /api/content/:resource（仅一级路径）
        //   GET    → 读取列表
        //   POST   → 新增条目
        //   PUT    → 整体替换（批量保存）
        const collectionMatch = url.match(/^\/api\/content\/(\w+)\/?$/)
        if (collectionMatch && collectionMatch[1] !== 'diaries') {
          const resource = collectionMatch[1]
          if (JSON_RESOURCES[resource]) {
            if (req.method === 'GET') {
              handleReadJsonResource(res, resource)
              return
            }
            if (req.method === 'POST') {
              const body = await readJsonBody(req)
              handleCreateJsonItem(res, resource, body)
              return
            }
            if (req.method === 'PUT') {
              const body = await readJsonBody(req)
              handleReplaceJsonResource(res, resource, body)
              return
            }
          }
        }

        // 聊天总结列表: GET /api/content/chat-summaries（用于 Overview 统计）
        if (url === '/api/content/chat-summaries' && req.method === 'GET') {
          try {
            const dir = join(BLOG_DATA_DIR, 'chat-summaries')
            const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
            sendJson(res, 200, { count: files.length, files })
          } catch {
            sendJson(res, 200, { count: 0, files: [] })
          }
          return
        }

        // ===== 网站背景 API =====
        // 背景列表存 blog/public/site-backgrounds.json；上传的图片存 public/backgrounds/
        // 博客端每次打开页面读取并随机抽取一张作为网站背景
        const BACKGROUNDS_FILE = join(BLOG_PUBLIC_DIR, 'site-backgrounds.json')
        const BACKGROUNDS_DIR = join(BLOG_PUBLIC_DIR, 'backgrounds')

        function readBackgrounds() {
          try {
            if (existsSync(BACKGROUNDS_FILE)) {
              const list = JSON.parse(readFileSync(BACKGROUNDS_FILE, 'utf-8'))
              return Array.isArray(list) ? list : []
            }
          } catch {
            /* 损坏时按空处理 */
          }
          return []
        }

        function writeBackgrounds(list) {
          mkdirSync(BLOG_PUBLIC_DIR, { recursive: true })
          writeFileSync(BACKGROUNDS_FILE, JSON.stringify(list, null, 2), 'utf-8')
        }

        // GET /api/backgrounds -> { backgrounds: [{ id, name, url, thumbPath, photoId, kind, addedAt }] }
        if (url === '/api/backgrounds' && req.method === 'GET') {
          sendJson(res, 200, { backgrounds: readBackgrounds() })
          return
        }

        // POST /api/backgrounds
        // body: { name?, photoId?, url?, thumbPath?, dataUrl? }
        //   - dataUrl: 上传图片（存到 public/backgrounds/）
        //   - photoId + url: 本地照片（照片墙一键设背景）
        //   - url: 外部图片链接
        if (url === '/api/backgrounds' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const list = readBackgrounds()
            const id = `bg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
            let entry = { id, name: '', photoId: '', thumbPath: '', url: '', kind: 'url', addedAt: Date.now() }
            if (body.dataUrl) {
              const base64Match = body.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
              if (!base64Match) {
                sendJson(res, 400, { error: '无效的 dataUrl' })
                return
              }
              const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
              const filename = `${id}.${ext}`
              mkdirSync(BACKGROUNDS_DIR, { recursive: true })
              writeFileSync(join(BACKGROUNDS_DIR, filename), Buffer.from(base64Match[2], 'base64'))
              entry.url = `/backgrounds/${filename}`
              entry.kind = 'uploaded'
            } else if (body.photoId && body.url) {
              entry.photoId = String(body.photoId)
              entry.url = body.url
              entry.thumbPath = body.thumbPath || ''
              entry.kind = 'local'
            } else if (body.url) {
              entry.url = body.url
            } else {
              sendJson(res, 400, { error: '请提供图片（上传 / 照片 / URL）' })
              return
            }
            entry.name = (body.name || '').slice(0, 60)
            list.push(entry)
            writeBackgrounds(list)
            sendJson(res, 200, { ok: true, background: entry })
          } catch (e) {
            sendJson(res, 500, { error: String(e.message || e) })
          }
          return
        }

        // DELETE /api/backgrounds?id=xxx -> 删除记录（上传的图片文件一并删除）
        if (url === '/api/backgrounds' && req.method === 'DELETE') {
          try {
            const q = new URL(req.url, 'http://x').searchParams
            const id = q.get('id') || ''
            const list = readBackgrounds()
            const target = list.find((b) => b.id === id)
            if (!target) {
              sendJson(res, 404, { error: '背景不存在' })
              return
            }
            writeBackgrounds(list.filter((b) => b.id !== id))
            // 上传的本地文件一并删除
            if (target.kind === 'uploaded' && target.url.startsWith('/backgrounds/')) {
              try {
                const file = join(BLOG_PUBLIC_DIR, target.url.replace(/^\//, ''))
                if (existsSync(file)) unlinkSync(file)
              } catch {
                /* 文件删除失败不影响记录删除 */
              }
            }
            sendJson(res, 200, { ok: true })
          } catch (e) {
            sendJson(res, 500, { error: String(e.message || e) })
          }
          return
        }

        // ===== 站点配置 API =====
        // SettingsView 保存的站点信息落盘到 blog/public/site-config.json，
        // 博客端启动时读取并覆盖 site.js 默认值 → 设置页对博客真实生效
        const SITE_CONFIG_FILE = join(BLOG_PUBLIC_DIR, 'site-config.json')
        if (url === '/api/site-config' && req.method === 'GET') {
          try {
            if (existsSync(SITE_CONFIG_FILE)) {
              sendJson(res, 200, {
                data: JSON.parse(readFileSync(SITE_CONFIG_FILE, 'utf-8')),
              })
            } else {
              sendJson(res, 200, { data: null })
            }
          } catch {
            sendJson(res, 200, { data: null })
          }
          return
        }
        if (url === '/api/site-config' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const profile = body.profile || {}
            // 关于页内容字段：旧版本设置页表单不会携带这些字段，
            // 缺省时从已落盘配置继承，避免保存一次就把默认文案丢掉
            let prevProfile = {}
            try {
              if (existsSync(SITE_CONFIG_FILE)) {
                const prev = JSON.parse(readFileSync(SITE_CONFIG_FILE, 'utf-8'))
                if (prev && typeof prev.profile === 'object') prevProfile = prev.profile
              }
            } catch {
              /* 忽略损坏配置 */
            }
            for (const k of ['author', 'location']) {
              if (!profile[k] && prevProfile[k]) profile[k] = prevProfile[k]
            }
            if (!Array.isArray(profile.aboutParagraphs) && Array.isArray(prevProfile.aboutParagraphs)) {
              profile.aboutParagraphs = prevProfile.aboutParagraphs
            }
            if (!Array.isArray(profile.features) && Array.isArray(prevProfile.features)) {
              profile.features = prevProfile.features
            }
            const config = {
              // 映射到博客 site.js 的字段
              navTitle: profile.nickname || '',
              avatarUrl: profile.avatar || '',
              bio: profile.signature || '',
              coupleHero: profile.coupleHero || '',
              heroArea: profile.heroArea || null,
              startYear: profile.loveStartDate
                ? Number(profile.loveStartDate.slice(0, 4)) || 0
                : 0,
              profile,
              paths: body.paths || {},
              baidu: body.baidu || {},
            }
            mkdirSync(BLOG_PUBLIC_DIR, { recursive: true })
            writeFileSync(SITE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
            sendJson(res, 200, { ok: true, data: config })
          } catch (e) {
            sendJson(res, 500, { error: String(e.message || e) })
          }
          return
        }

        // 日记管理: /api/content/diaries
        if (url === '/api/content/diaries') {
          if (req.method === 'GET') {
            handleListDiaries(res)
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            handleSaveDiary(res, body)
            return
          }
        }

        // 日记单篇操作: /api/content/diaries/:filename
        const diaryMatch = url.match(/^\/api\/content\/diaries\/(.+)$/)
        if (diaryMatch) {
          const filename = decodeURIComponent(diaryMatch[1])
          if (req.method === 'GET') {
            handleReadDiary(res, filename)
            return
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req)
            handleSaveDiary(res, body, filename)
            return
          }
          if (req.method === 'DELETE') {
            handleDeleteDiary(res, filename)
            return
          }
        }

        // 批量物理删除照片: POST /api/content/photos/batch-delete
        // body: { ids: ["p0001", "p0002", ...] }
        // 删除缩略图文件 + 从 local-photos-manifest.json 和 photos-manifest.json 中移除
        if (url === '/api/content/photos/batch-delete' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const ids = body.ids || []
          if (!Array.isArray(ids) || ids.length === 0) {
            sendJson(res, 400, { error: '请提供要删除的照片 ID 列表' })
            return
          }

          const results = { deletedFiles: 0, deletedRecords: 0, errors: [] }

          // 1. 从 local-photos-manifest.json 中查找照片信息并删除缩略图文件
          const localManifestPath = join(BLOG_DATA_DIR, 'local-photos-manifest.json')
          const localManifest = readJsonArray(localManifestPath)
          const idSet = new Set(ids)
          const survivors = []
          for (const item of localManifest) {
            if (idSet.has(item.id)) {
              // 删除缩略图文件
              if (item.thumbPath) {
                const thumbFile = join(BLOG_PUBLIC_DIR, item.thumbPath)
                try {
                  if (existsSync(thumbFile)) {
                    unlinkSync(thumbFile)
                    results.deletedFiles++
                  }
                } catch (err) {
                  results.errors.push(`删除缩略图失败 ${item.id}: ${err.message}`)
                }
              }
              results.deletedRecords++
            } else {
              survivors.push(item)
            }
          }
          // 写回 manifest
          if (survivors.length < localManifest.length) {
            writeJsonFile(localManifestPath, survivors)
          }

          // 2. 同步清理 public/local-photos-manifest.json（如果存在）
          const publicManifestPath = join(BLOG_PUBLIC_DIR, 'local-photos-manifest.json')
          if (existsSync(publicManifestPath)) {
            const publicManifest = readJsonArray(publicManifestPath)
            const publicSurvivors = publicManifest.filter((item) => !idSet.has(item.id))
            if (publicSurvivors.length < publicManifest.length) {
              writeJsonFile(publicManifestPath, publicSurvivors)
            }
          }

          // 3. 同步清理 photos-manifest.json（如果包含对应记录）
          const photosManifestPath = join(BLOG_DATA_DIR, 'photos-manifest.json')
          if (existsSync(photosManifestPath)) {
            const photosManifest = readJsonArray(photosManifestPath)
            const photosSurvivors = photosManifest.filter((item) => !idSet.has(item.id))
            if (photosSurvivors.length < photosManifest.length) {
              writeJsonFile(photosManifestPath, photosSurvivors)
            }
          }

          sendJson(res, 200, {
            data: {
              deletedFiles: results.deletedFiles,
              deletedRecords: results.deletedRecords,
              errors: results.errors,
            },
          })
          return
        }

        // 缩略图上传: POST /api/content/photo-thumb/:filename
        // body: { dataUrl: "data:image/webp;base64,..." }
        const thumbMatch = url.match(/^\/api\/content\/photo-thumb\/(.+)$/)
        if (thumbMatch && req.method === 'POST') {
          const filename = decodeURIComponent(thumbMatch[1])
          if (filename.includes('..')) {
            sendJson(res, 400, { error: '无效的文件名' })
            return
          }
          const body = await readJsonBody(req)
          const dataUrl = body.dataUrl || ''
          const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
          if (!base64Match) {
            sendJson(res, 400, { error: '无效的 dataUrl' })
            return
          }
          const buffer = Buffer.from(base64Match[1], 'base64')
          mkdirSync(BLOG_PHOTOS_DIR, { recursive: true })
          const thumbPath = join(BLOG_PHOTOS_DIR, filename)
          writeFileSync(thumbPath, buffer)
          // 绝对路径（前导 /）：日记详情页等深层路由下也能正确解析
          sendJson(res, 200, { data: { path: `/photos/${filename}` } })
          return
        }

        // ===== 评论 API =====
        // 评论数据存储为对象：{ "diary:slug": [{id, author, text, images, createdAt}], ... }
        const COMMENTS_FILE = join(BLOG_DATA_DIR, 'comments.json')
        const COMMENT_IMG_DIR = join(BLOG_PUBLIC_DIR, 'comments')

        function readComments() {
          if (!existsSync(COMMENTS_FILE)) return {}
          try {
            const raw = readFileSync(COMMENTS_FILE, 'utf-8')
            const data = JSON.parse(raw)
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
          } catch {
            return {}
          }
        }
        function writeComments(data) {
          writeJsonFile(COMMENTS_FILE, data)
        }

        // GET /api/comments          → 返回全部评论
        // GET /api/comments?key=xxx  → 返回某个目标的评论
        if (url.startsWith('/api/comments') && req.method === 'GET') {
          const all = readComments()
          const key = new URL(req.url, 'http://localhost').searchParams.get('key') || ''
          sendJson(res, 200, { data: key ? (all[key] || []) : all })
          return
        }

        // POST /api/comments  body: { key, author, text, images }
        if (url === '/api/comments' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const key = body.key
          if (!key) return sendJson(res, 400, { error: '缺少 key' })
          const all = readComments()
          const list = all[key] || []
          const newComment = {
            id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            author: body.author === '小昕昕' ? '小昕昕' : '小叶叶',
            text: String(body.text || '').slice(0, 2000),
            images: Array.isArray(body.images) ? body.images.slice(0, 9) : [],
            createdAt: new Date().toISOString(),
          }
          list.push(newComment)
          all[key] = list
          writeComments(all)
          sendJson(res, 201, { data: newComment })
          return
        }

        // DELETE /api/comments/:id?key=xxx
        const cmtDeleteMatch = url.match(/^\/api\/comments\/([^/]+)$/)
        if (cmtDeleteMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(cmtDeleteMatch[1])
          const key = new URL(req.url, 'http://localhost').searchParams.get('key') || ''
          if (!key) return sendJson(res, 400, { error: '缺少 key' })
          const all = readComments()
          const list = all[key] || []
          const next = list.filter((c) => c.id !== id)
          if (next.length === list.length) return sendJson(res, 404, { error: '评论不存在' })
          all[key] = next
          writeComments(all)
          sendJson(res, 200, { ok: true })
          return
        }

        // 评论图片上传: POST /api/comment-image
        // body: { dataUrl: "data:image/jpeg;base64,..." }
        // 返回 { path: "comments/<filename>" }
        if (url === '/api/comment-image' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const dataUrl = body.dataUrl || ''
          const base64Match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
          if (!base64Match) return sendJson(res, 400, { error: '无效的 dataUrl' })
          const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
          const filename = `cmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`
          mkdirSync(COMMENT_IMG_DIR, { recursive: true })
          writeFileSync(join(COMMENT_IMG_DIR, filename), Buffer.from(base64Match[2], 'base64'))
          sendJson(res, 200, { data: { path: `/comments/${filename}` } })
          return
        }

        // ===== 日记封面 API =====
        // 数据文件: blog/src/data/diary-covers.json  格式: { "<slug>": "<path>" }
        // 图片目录: blog/public/diary-covers/
        const DIARY_COVERS_FILE = join(BLOG_DATA_DIR, 'diary-covers.json')
        const DIARY_COVER_IMG_DIR = join(BLOG_PUBLIC_DIR, 'diary-covers')

        function readDiaryCovers() {
          if (!existsSync(DIARY_COVERS_FILE)) return {}
          try {
            const raw = readFileSync(DIARY_COVERS_FILE, 'utf-8')
            const data = JSON.parse(raw)
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
          } catch {
            return {}
          }
        }
        function writeDiaryCovers(data) {
          writeJsonFile(DIARY_COVERS_FILE, data)
        }

        // GET /api/diary-covers         → 返回全部上传的封面映射
        // GET /api/diary-covers?slug=xxx → 返回单个封面
        if (url.startsWith('/api/diary-covers') && req.method === 'GET') {
          const all = readDiaryCovers()
          const slug = new URL(req.url, 'http://localhost').searchParams.get('slug') || ''
          if (slug) {
            sendJson(res, 200, { data: { cover: all[slug] || '' } })
          } else {
            sendJson(res, 200, { data: all })
          }
          return
        }

        // POST /api/diary-cover  body: { slug, dataUrl }
        // 上传图片并保存映射，返回 { data: { cover } }
        if (url === '/api/diary-cover' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const slug = String(body.slug || '').trim()
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const dataUrl = body.dataUrl || ''
          const base64Match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
          if (!base64Match) return sendJson(res, 400, { error: '无效的 dataUrl' })
          const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
          const filename = `cover_${slug.replace(/[^\w-]/g, '_')}_${Date.now().toString(36)}.${ext}`
          mkdirSync(DIARY_COVER_IMG_DIR, { recursive: true })
          writeFileSync(join(DIARY_COVER_IMG_DIR, filename), Buffer.from(base64Match[2], 'base64'))
          const coverPath = `diary-covers/${filename}`
          const all = readDiaryCovers()
          all[slug] = coverPath
          writeDiaryCovers(all)
          sendJson(res, 200, { data: { cover: coverPath } })
          return
        }

        // DELETE /api/diary-cover?slug=xxx
        // 移除封面映射（不删除已上传的图片文件，避免破坏历史）
        // 注意：用正则精确匹配，避免误匹配 /api/diary-cover-area 等
        if (url.match(/^\/api\/diary-cover(\?|$)/) && req.method === 'DELETE') {
          const slug = new URL(req.url, 'http://localhost').searchParams.get('slug') || ''
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const all = readDiaryCovers()
          if (!all[slug]) return sendJson(res, 404, { error: '封面不存在' })
          delete all[slug]
          writeDiaryCovers(all)
          sendJson(res, 200, { ok: true })
          return
        }

        // ===== 日记照片封面 API =====
        // 用于"从照片墙当日图片中随机抽取一张"的持久化映射
        // 数据文件: blog/src/data/diary-photo-covers.json  格式: { "<slug>": { "photoId": "...", "url": "..." } }
        const DIARY_PHOTO_COVERS_FILE = join(BLOG_DATA_DIR, 'diary-photo-covers.json')

        function readDiaryPhotoCovers() {
          if (!existsSync(DIARY_PHOTO_COVERS_FILE)) return {}
          try {
            const raw = readFileSync(DIARY_PHOTO_COVERS_FILE, 'utf-8')
            const data = JSON.parse(raw)
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
          } catch {
            return {}
          }
        }
        function writeDiaryPhotoCovers(data) {
          writeJsonFile(DIARY_PHOTO_COVERS_FILE, data)
        }

        // GET /api/diary-photo-covers → 返回全部抽取映射
        if (url.startsWith('/api/diary-photo-covers') && req.method === 'GET') {
          sendJson(res, 200, { data: readDiaryPhotoCovers() })
          return
        }

        // GET /api/diary-photo-options?date=YYYY-MM-DD
        // 返回该日期拍摄的本地照片候选（图库选封面用），只取缩略图路径与原图 URL
        if (url.startsWith('/api/diary-photo-options') && req.method === 'GET') {
          const date = new URL(req.url, 'http://localhost').searchParams.get('date') || ''
          const manifest = await loadLocalManifest()
          const items = Array.isArray(manifest)
            ? manifest
                .filter((p) => (p.dateTime || '').slice(0, 10) === date)
                .map((p) => ({
                  id: p.id || '',
                  filename: p.filename || '',
                  thumbPath: p.thumbPath || '',
                  url: p.path ? `/local-photo/${encodeURI(p.path.replace(/^[/\\]+/, ''))}` : '',
                }))
            : []
          sendJson(res, 200, { data: items })
          return
        }

        // POST /api/diary-photo-cover  body: { slug, photoId, url, thumbPath }
        // 保存/更新某 slug 的抽取结果
        if (url === '/api/diary-photo-cover' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const slug = String(body.slug || '').trim()
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const entry = {
            photoId: String(body.photoId || ''),
            url: String(body.url || ''),
            thumbPath: String(body.thumbPath || ''),
            updatedAt: new Date().toISOString(),
          }
          const all = readDiaryPhotoCovers()
          all[slug] = entry
          writeDiaryPhotoCovers(all)
          sendJson(res, 200, { data: entry })
          return
        }

        // DELETE /api/diary-photo-cover?slug=xxx → 清除抽取，回到默认 seed
        if (url.startsWith('/api/diary-photo-cover') && req.method === 'DELETE') {
          const slug = new URL(req.url, 'http://localhost').searchParams.get('slug') || ''
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const all = readDiaryPhotoCovers()
          if (!all[slug]) return sendJson(res, 404, { error: '抽取记录不存在' })
          delete all[slug]
          writeDiaryPhotoCovers(all)
          sendJson(res, 200, { ok: true })
          return
        }

        // ===== 日记封面展示区域 API =====
        // 存储"封面图中选取的展示区域"，格式：{ "<slug>": { x, y, width, height } }（均为 0-1 比例）
        // 数据文件: blog/src/data/diary-cover-areas.json
        const DIARY_COVER_AREAS_FILE = join(BLOG_DATA_DIR, 'diary-cover-areas.json')

        function readDiaryCoverAreas() {
          if (!existsSync(DIARY_COVER_AREAS_FILE)) return {}
          try {
            const raw = readFileSync(DIARY_COVER_AREAS_FILE, 'utf-8')
            const data = JSON.parse(raw)
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
          } catch {
            return {}
          }
        }
        function writeDiaryCoverAreas(data) {
          writeJsonFile(DIARY_COVER_AREAS_FILE, data)
        }

        // 校验 area 字段是否合法（0-1 比例）
        // 格式: { x, y, width, height } 均为 0-1，表示取景框在原图上的位置和大小
        function sanitizeArea(area) {
          if (!area || typeof area !== 'object') return null
          const num = (v, d) => {
            const n = Number(v)
            return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d
          }
          const x = num(area.x, 0)
          const y = num(area.y, 0)
          const w = Math.max(0.05, Math.min(1, num(area.width, 1)))
          const h = Math.max(0.05, Math.min(1, num(area.height, 1)))
          // 保证 x+width <= 1, y+height <= 1
          return {
            x: Math.min(x, 1 - w),
            y: Math.min(y, 1 - h),
            width: w,
            height: h,
          }
        }

        // GET /api/diary-cover-areas → 返回全部区域映射
        if (url.startsWith('/api/diary-cover-areas') && req.method === 'GET') {
          sendJson(res, 200, { data: readDiaryCoverAreas() })
          return
        }

        // POST /api/diary-cover-area  body: { slug, area: {x,y,width,height} }
        if (url === '/api/diary-cover-area' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const slug = String(body.slug || '').trim()
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const area = sanitizeArea(body.area)
          if (!area) return sendJson(res, 400, { error: '无效的 area' })
          const all = readDiaryCoverAreas()
          all[slug] = { ...area, updatedAt: new Date().toISOString() }
          writeDiaryCoverAreas(all)
          sendJson(res, 200, { data: all[slug] })
          return
        }

        // DELETE /api/diary-cover-area?slug=xxx → 清除区域，回到默认（居中 cover）
        if (url.startsWith('/api/diary-cover-area') && req.method === 'DELETE') {
          const slug = new URL(req.url, 'http://localhost').searchParams.get('slug') || ''
          if (!slug) return sendJson(res, 400, { error: '缺少 slug' })
          const all = readDiaryCoverAreas()
          if (!all[slug]) return sendJson(res, 404, { error: '区域记录不存在' })
          delete all[slug]
          writeDiaryCoverAreas(all)
          sendJson(res, 200, { ok: true })
          return
        }

        // ===== 网易云 OpenAPI 代理 =====

        // 诊断匿名登录
        if (url === '/api/netease/diagnose' && req.method === 'GET') {
          await handleNeteaseDiagnose(res, env)
          return
        }

        // 获取扫码二维码
        if (url === '/api/netease/qr-code' && req.method === 'GET') {
          await handleNeteaseGetQrCode(res, env)
          return
        }

        // 轮询扫码状态
        if (url === '/api/netease/qr-status' && req.method === 'GET') {
          const key = new URL(req.url, 'http://localhost').searchParams.get('key') || ''
          await handleNeteaseQrStatus(res, env, key)
          return
        }

        // 授权状态
        if (url === '/api/netease/token-status' && req.method === 'GET') {
          await handleNeteaseTokenStatus(res, env)
          return
        }

        // 退出授权
        if (url === '/api/netease/logout' && req.method === 'POST') {
          await handleNeteaseLogout(res)
          return
        }

        // 用户歌单列表
        if (url === '/api/netease/user-playlists' && req.method === 'GET') {
          await handleNeteaseUserPlaylists(res, env)
          return
        }

        // 歌单内歌曲列表
        if (url === '/api/netease/playlist-detail' && req.method === 'GET') {
          const id = new URL(req.url, 'http://localhost').searchParams.get('id') || ''
          await handleNeteasePlaylistDetail(res, env, id)
          return
        }

        // 合并已选歌单的歌曲（供 blog APlayer）
        if (url === '/api/netease/songs' && req.method === 'GET') {
          await handleNeteaseSongs(res, env)
          return
        }

        // 歌词
        if (url === '/api/netease/lyrics' && req.method === 'GET') {
          const id = new URL(req.url, 'http://localhost').searchParams.get('id') || ''
          await handleNeteaseLyrics(res, env, id)
          return
        }

        // 配置 GET/POST
        if (url === '/api/netease/config') {
          await handleNeteaseConfig(req, res)
          return
        }

        // 网易云音频字节代理：/api/netease/song-mp3/:songId
        const songMatch = url.match(/^\/api\/netease\/song-mp3\/([A-Za-z0-9_-]+)$/)
        if (songMatch && req.method === 'GET') {
          await handleNeteaseSongMp3(req, res, env, songMatch[1])
          return
        }

        // 其余请求交给后续中间件
        next()
      })
    },
  }
}

export default adminServerPlugin
