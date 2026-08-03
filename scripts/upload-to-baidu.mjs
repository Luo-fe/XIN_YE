/**
 * 批量上传照片原图到百度网盘（方案 B 5.1）
 *
 * 用法（在 couple-blog 根目录）：
 *   node scripts/upload-to-baidu.mjs          # 全量上传
 *   node scripts/upload-to-baidu.mjs --dry-run # 只列出待上传清单
 *
 * - 读取 blog/src/data/local-photos-manifest.json 的 path 字段
 * - 上传 f:/图片/照片/<path> 到百度网盘 PHOTO_DIR/<path>（保持相对目录结构）
 * - 断点续传：进度存 scripts/.upload-progress.json，中断后重跑自动跳过已完成
 * - 分片上传（4MB/片，百度 superfile2 协议，要求按序），每文件失败重试 2 次
 * - 全部完成后把 baiduPath 字段写回 manifest（blog/src/data + blog/public）
 *
 * 凭据：admin/.baidu-token.json（access/refresh token）
 *       admin/.env.local 的 VITE_BAIDU_APP_KEY / VITE_BAIDU_SECRET_KEY（刷新用）
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync, writeFileSync, openSync, readSync, closeSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_SRC = join(ROOT, 'blog/src/data/local-photos-manifest.json')
const MANIFEST_PUB = join(ROOT, 'blog/public/local-photos-manifest.json')
const ORIGIN_ROOT = 'f:/图片/照片'
const TOKEN_FILE = join(ROOT, 'admin/.baidu-token.json')
const ENV_FILE = join(ROOT, 'admin/.env.local')
const PROGRESS_FILE = join(ROOT, 'scripts/.upload-progress.json')
const PHOTO_DIR = process.env.PHOTO_SOURCE_DIR || '/小昕昕❤\uFE0F小叶叶'
const CHUNK = 4 * 1024 * 1024 // 4MB / 片
const CONCURRENCY = 3
const MAX_RETRY = 2
const DRY_RUN = process.argv.includes('--dry-run')

// ---------- 凭据 ----------
function loadEnv() {
  const env = {}
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const tokenFile = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'))
let accessToken = tokenFile.access_token || ''
let refreshToken = tokenFile.refresh_token || ''
let expiresAt = tokenFile.expires_at || 0

async function refreshTokenOnce() {
  const env = loadEnv()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.VITE_BAIDU_APP_KEY || '',
    client_secret: env.VITE_BAIDU_SECRET_KEY || '',
  })
  const resp = await fetch('https://openapi.baidu.com/oauth/2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await resp.json()
  if (data.error) throw new Error('token 刷新失败: ' + (data.error_description || data.error))
  accessToken = data.access_token
  refreshToken = data.refresh_token || refreshToken
  expiresAt = Date.now() + (data.expires_in || 2592000) * 1000
  const persist = { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt }
  writeFileSync(TOKEN_FILE, JSON.stringify(persist, null, 2))
  console.log(`[token] 已刷新（有效期至 ${new Date(expiresAt).toISOString()}）`)
}

/** 确保 access_token 有效（提前 5 分钟刷新） */
async function ensureToken() {
  if (accessToken && Date.now() + 5 * 60 * 1000 < expiresAt) return
  await refreshTokenOnce()
}

// ---------- 进度 ----------
function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { uploaded: {}, failed: {} }
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) } catch { return { uploaded: {}, failed: {} } }
}
function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ---------- 百度 API ----------
async function baiduApi(method, params, body, base = 'https://pan.baidu.com/rest/2.0/xpan/file') {
  const url = new URL(base)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const resp = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
    body: body ? body.toString() : undefined,
  })
  return resp.json()
}

async function mkdirRemote(remotePath) {
  const data = await baiduApi('POST', { method: 'create', access_token: accessToken, path: remotePath, isdir: 1, size: 0, block_list: '[""]' })
  if (data.errno === 0 || data.errno === 4004) return true // 已存在也算成功
  throw new Error(`mkdir ${remotePath} errno=${data.errno}`)
}

/** 递归确保父目录存在（含 emoji 编码问题处理） */
const mkdirCache = new Set()
async function ensureParent(remotePath) {
  const dirs = remotePath.split('/').slice(0, -1)
  let cur = ''
  for (const d of dirs) {
    cur += '/' + d
    if (mkdirCache.has(cur)) continue
    await mkdirRemote(cur)
    mkdirCache.add(cur)
  }
}

/** 文件分块 md5 */
function fileBlocks(abs) {
  const fd = openSync(abs, 'r')
  const blocks = []
  let buf = Buffer.alloc(CHUNK)
  let read = 0
  try {
    while ((read = readSync(fd, buf, 0, CHUNK, null)) > 0) {
      blocks.push(createHash('md5').update(buf.subarray(0, read)).digest('hex'))
    }
  } finally {
    closeSync(fd)
  }
  return blocks
}

/** 单文件上传：precreate → 按序分片 upload → create */
async function uploadFile(rel, abs, size) {
  await ensureParent(PHOTO_DIR + '/' + rel)
  const remotePath = `${PHOTO_DIR}/${rel}`
  const blocks = fileBlocks(abs)

  // 1. precreate
  const pre = await baiduApi('POST', {
    method: 'precreate', access_token: accessToken, path: remotePath, isdir: 0,
    size, autoinit: 1, block_list: JSON.stringify(blocks), expire: 86400,
  })
  if (pre.errno && pre.errno !== 0) throw new Error(`precreate errno=${pre.errno}`)
  const uploadid = pre.uploadid

  // 2. 按序分片上传（百度要求 partseq 递增）
  const fd = openSync(abs, 'r')
  try {
    for (let i = 0; i < blocks.length; i++) {
      const part = Buffer.alloc(CHUNK)
      const n = readSync(fd, part, 0, CHUNK, i * CHUNK)
      const form = new FormData()
      form.append('file', new Blob([part.subarray(0, n)]), 'blob')
      const url = `https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?method=upload&access_token=${accessToken}&type=tmpfile&path=${encodeURIComponent(remotePath)}&uploadid=${encodeURIComponent(uploadid)}&partseq=${i}`
      const resp = await fetch(url, { method: 'POST', body: form })
      const data = await resp.json()
      if (data.errno && data.errno !== 0) throw new Error(`part${i} errno=${data.errno}`)
    }
  } finally {
    closeSync(fd)
  }

  // 3. create（提交完成）
  const create = await baiduApi('POST', {
    method: 'create', access_token: accessToken, path: remotePath, isdir: 0,
    size, uploadid, block_list: JSON.stringify(blocks),
  })
  if (create.errno && create.errno !== 0 && create.errno !== 4004) throw new Error(`create errno=${create.errno}`)
  return remotePath
}

// ---------- 主流程 ----------
const manifest = JSON.parse(readFileSync(MANIFEST_SRC, 'utf8'))
const progress = loadProgress()
const todo = manifest.filter((p) => p.path && !progress.uploaded[p.path])

console.log(`manifest ${manifest.length} 条 | 已完成 ${Object.keys(progress.uploaded).length} | 失败 ${Object.keys(progress.failed).length} | 待上传 ${todo.length}`)
if (DRY_RUN) {
  todo.slice(0, 20).forEach((p) => console.log('  ', p.path))
  console.log(DRY_RUN && '... 共 ' + todo.length + ' 张（dry-run 不实际上传）')
  process.exit(0)
}

if (todo.length === 0) {
  console.log('没有待上传文件。')
} else {
  await ensureToken()
  const missing = []
  let done = 0, okCount = 0, failCount = 0
  const startedAt = Date.now()

  async function worker(item) {
    const abs = join(ORIGIN_ROOT, item.path)
    if (!existsSync(abs)) { missing.push(item.path); return }
    let lastErr = null
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      try {
        const size = statSync(abs).size
        const remotePath = await uploadFile(item.path, abs, size)
        progress.uploaded[item.path] = { remotePath, size, at: new Date().toISOString() }
        delete progress.failed[item.path]
        okCount++
        break
      } catch (e) {
        lastErr = e
        if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
      }
    }
    if (!progress.uploaded[item.path]) {
      progress.failed[item.path] = { error: lastErr?.message, at: new Date().toISOString() }
      failCount++
    }
    done++
    if (done % 25 === 0 || done === todo.length) {
      const rate = (done / (Date.now() - startedAt)) * 1000
      console.log(`[${done}/${todo.length}] 成功 ${okCount} 失败 ${failCount}（${rate.toFixed(1)} 张/秒）`)
      saveProgress()
    }
  }

  const queue = [...todo]
  async function runner() {
    while (queue.length > 0) {
      const item = queue.shift()
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, runner))

  saveProgress()
  const secs = ((Date.now() - startedAt) / 1000).toFixed(0)
  console.log(`\n==== 上传结束 ====`)
  console.log(`成功 ${okCount} | 失败 ${failCount} | 本地缺失 ${missing.length} | 耗时 ${secs}s`)
  if (missing.length) console.log('缺失文件:', missing.slice(0, 20).join(', '))
  if (failCount) console.log('失败列表见 scripts/.upload-progress.json')
}

// ---------- 写回 baiduPath ----------
const uploaded = progress.uploaded
const withBaidu = manifest.map((p) => {
  const u = uploaded[p.path]
  return u ? { ...p, baiduPath: u.remotePath } : p
})
const baiduCount = withBaidu.filter((p) => p.baiduPath).length
if (baiduCount > 0) {
  writeFileSync(MANIFEST_SRC, JSON.stringify(withBaidu, null, 2) + '\n')
  writeFileSync(MANIFEST_PUB, JSON.stringify(withBaidu, null, 2) + '\n')
  console.log(`manifest 已写回 baiduPath：${baiduCount}/${withBaidu.length} 条（blog/src/data + blog/public）`)
}
