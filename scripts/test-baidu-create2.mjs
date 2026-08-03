// 百度 create 接口调试 2 轮：跑完把输出贴给 Claude
// 假设1：目录 block_list 应为空数组 [] 而非 [""]
// 假设2：目录创建需要 rtype
// 假设3：文件 create errno=2 是因为分片未真正上传（走完整 1 分片流程验证）
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const t = JSON.parse(readFileSync(new URL('../admin/.baidu-token.json', import.meta.url), 'utf8'))
const tok = t.access_token
const BASE = 'https://pan.baidu.com/rest/2.0/xpan/file'

const q = (obj) => new URLSearchParams(obj).toString()
const show = (label, r) => console.log(label, '->', (typeof r === 'string' ? r : JSON.stringify(r)).slice(0, 300))
// 文档惯例：所有请求带 User-Agent: pan.baidu.com
const H = { 'User-Agent': 'pan.baidu.com' }

// --- mkdir 变体们：POST，method 和全部参数放 query（与 precreate 同款成功姿势）---
const mk = async (label, extra) => {
  const url = BASE + '?' + q({ method: 'create', access_token: tok, path: '/test_d2', isdir: 1, ...extra })
  try { show(label, await (await fetch(url, { method: 'POST', headers: H })).json()) } catch (e) { show(label, '网络错误: ' + e.message) }
}
await mk('A.目录 block_list=[]', { size: 0, block_list: '[]' })
await mk('B.目录 无block_list', { size: 0 })
await mk('C.目录 无size无block_list', {})
await mk('D.目录 rtype=1+[]', { size: 0, block_list: '[]', rtype: 1 })

// --- 完整 1 分片上传流程：precreate → superfile2 → create ---
const bytes = Buffer.alloc(1024, 0x42)
const md5 = createHash('md5').update(bytes).digest('hex')
const BL = JSON.stringify([md5])
const pre = await (await fetch(BASE + '?' + q({ method: 'precreate', access_token: tok, path: '/test_v4.jpg', size: 1024, isdir: 0, autoinit: 1, rtype: 1, block_list: BL }), { method: 'POST', headers: H })).json()
show('E.precreate', pre)
if (pre.uploadid) {
  const up = await fetch('https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?' + q({
    method: 'upload', access_token: tok, type: 'tmpfile', path: '/test_v4.jpg',
    uploadid: pre.uploadid, partseq: 0, parttotal: 1,
  }), { method: 'POST', headers: H, body: bytes })
  show('E.superfile2', await up.text())
  const cr = await (await fetch(BASE + '?' + q({
    method: 'create', access_token: tok, path: '/test_v4.jpg', size: 1024, isdir: 0,
    uploadid: pre.uploadid, block_list: BL, rtype: 1,
  }), { method: 'POST' })).json()
  show('E.create', cr)
}
