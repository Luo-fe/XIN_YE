// 旧版 PCS 接口探测：pcs/file 的 mkdir / meta / create（绕开 xpan create 权限问题）
import { readFileSync } from 'node:fs'
const tok = JSON.parse(readFileSync(new URL('../admin/.baidu-token.json', import.meta.url), 'utf8')).access_token
const H = { 'User-Agent': 'pan.baidu.com' }
const show = async (label, url, opt = {}) => {
  try { const r = await fetch(url, { method: 'POST', headers: H, ...opt }); show2(label, await r.text()) }
  catch (e) { console.log(label, '-> 网络错误:', e.message) }
}
const show2 = (label, t) => console.log(label, '->', t.slice(0, 250))

// 1. PCS mkdir
await show('A.PCS mkdir', 'https://pcs.baidu.com/rest/2.0/pcs/file?method=mkdir&access_token=' + tok + '&path=%2Ftest_pcs')
// 2. PCS meta（探测 scope 是否支持 PCS 域名）
await show('B.PCS meta', 'https://pcs.baidu.com/rest/2.0/pcs/file?method=meta&access_token=' + tok + '&path=%2F')
// 3. PCS create（superfile2 完成，与 xpan create 同参数）
await show('C.PCS create', 'https://pcs.baidu.com/rest/2.0/pcs/file?method=create&access_token=' + tok + '&path=%2Ftest_pcs.jpg&size=1024&isdir=0')
