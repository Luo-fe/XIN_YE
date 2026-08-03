// 百度 create 接口调试：跑完把输出贴给 Claude
import { readFileSync } from 'node:fs'
const t = JSON.parse(readFileSync(new URL('../admin/.baidu-token.json', import.meta.url), 'utf8'))
const tok = t.access_token
const BL = '["d41d8cd98f00b204e9800998ecf8427e"]'
const test = async (label, url, opts) => {
  try {
    const r = await fetch(url, opts)
    const b = (await r.text()).slice(0, 150)
    console.log(label, '->', b)
  } catch (e) { console.log(label, '网络错误:', e.message) }
}
// 先 precreate 拿一个真实 uploadid
const pre = await fetch('https://pan.baidu.com/rest/2.0/xpan/file?method=precreate&access_token=' + tok +
  '&path=%2Ftest_v2.jpg&size=1024&isdir=0&autoinit=1&rtype=1&block_list=' + encodeURIComponent(BL), { method: 'POST' })
const preJson = await pre.json()
console.log('precreate ->', JSON.stringify(preJson).slice(0, 120))
const uploadid = preJson.uploadid || ''

// 1. 文件 create：GET + query
await test('1.文件GET', 'https://pan.baidu.com/rest/2.0/xpan/file?method=create&access_token=' + tok +
  '&path=%2Ftest_v2.jpg&size=1024&isdir=0&uploadid=' + uploadid + '&block_list=' + encodeURIComponent(BL) + '&rtype=1')
// 2. 文件 create：POST + 参数在 body
await test('2.文件POST-body', 'https://pan.baidu.com/rest/2.0/xpan/file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ method: 'create', access_token: tok, path: '/test_v3.jpg', size: 1024, isdir: 0, uploadid, block_list: BL, rtype: 1 }).toString(),
})
// 3. 目录 create：GET
await test('3.目录GET', 'https://pan.baidu.com/rest/2.0/xpan/file?method=create&access_token=' + tok +
  '&path=%2Ftest_d1&isdir=1&size=0&block_list=%5B%22%22%5D')
