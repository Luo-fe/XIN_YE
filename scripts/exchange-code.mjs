// 一次性脚本：code 换 token（授权码模式）→ 写入 token 文件 → 重测 create
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const doc = readFileSync('F:/图片/调用百度网盘.md', 'utf8')
const getDoc = (k) => doc.match(new RegExp(k + ':\\s*\\r?\\n\\s*([^\\r\\n]+)'))?.[1]?.trim()
const APP_KEY = getDoc('AppKey')
const SECRET = getDoc('SecretKey')
const CODE = process.argv[2] || ''
const H = { 'User-Agent': 'pan.baidu.com' }

// 1. code 换 token（GET，参数全在 query，按文档）
const url = 'https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code=' + CODE +
  '&client_id=' + APP_KEY + '&client_secret=' + SECRET + '&redirect_uri=oob'
const d = await (await fetch(url, { headers: H })).json()
if (!d.access_token) {
  console.log('换 token 失败:', d.error, (d.error_description || '').slice(0, 100))
  process.exit(1)
}
writeFileSync(new URL('../admin/.baidu-token.json', import.meta.url), JSON.stringify({
  access_token: d.access_token,
  refresh_token: d.refresh_token,
  expires_at: Date.now() + (d.expires_in || 2592000) * 1000,
}, null, 2))
console.log('token 已更新（scope:', d.scope, '| 有效期', Math.round((d.expires_in || 0) / 86400), '天）')
const tok = d.access_token

// 2. 重测 mkdir + create
const q = (o) => new URLSearchParams(o).toString()
const BASE = 'https://pan.baidu.com/rest/2.0/xpan/file'
const mk = await (await fetch(BASE + '?' + q({ method: 'create', access_token: tok, path: '/test_d3', isdir: 1, size: 0, block_list: '[]' }), { method: 'POST', headers: H })).json()
console.log('A.新token mkdir ->', JSON.stringify(mk).slice(0, 120))
const bytes = Buffer.alloc(1024, 0x42)
const md5 = createHash('md5').update(bytes).digest('hex')
const BL = JSON.stringify([md5])
const pre = await (await fetch(BASE + '?' + q({ method: 'precreate', access_token: tok, path: '/test_v5.jpg', size: 1024, isdir: 0, autoinit: 1, rtype: 1, block_list: BL }), { method: 'POST', headers: H })).json()
if (pre.uploadid) {
  const up = await fetch('https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?' + q({
    method: 'upload', access_token: tok, type: 'tmpfile', path: '/test_v5.jpg', uploadid: pre.uploadid, partseq: 0, parttotal: 1,
  }), { method: 'POST', headers: H, body: bytes })
  console.log('B.superfile2 ->', (await up.text()).slice(0, 100))
  const cr = await (await fetch(BASE + '?' + q({
    method: 'create', access_token: tok, path: '/test_v5.jpg', size: 1024, isdir: 0, uploadid: pre.uploadid, block_list: BL, rtype: 1,
  }), { method: 'POST', headers: H })).json()
  console.log('C.新token create ->', JSON.stringify(cr).slice(0, 150))
} else console.log('precreate 失败:', JSON.stringify(pre).slice(0, 120))
