// 探测当前应用可用的文件接口权限（跑完贴给 Claude）
import { readFileSync } from 'node:fs'
const tok = JSON.parse(readFileSync(new URL('../admin/.baidu-token.json', import.meta.url), 'utf8')).access_token
const H = { 'User-Agent': 'pan.baidu.com' }
const t = async (label, url) => {
  try { const r = await fetch(url, { headers: H }); console.log(label, '->', (await r.text()).slice(0, 150)) }
  catch (e) { console.log(label, '网络错误:', e.message) }
}
await t('A.文件列表 list', 'https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=' + tok + '&dir=%2F&limit=3')
await t('B.下载 download', 'https://pan.baidu.com/rest/2.0/xpan/file?method=download&access_token=' + tok + '&path=%2Fapps%2F%E8%8A%8B%E6%B3%A5%E5%A5%B6%E7%89%99')
await t('C.图片列表 recentlist', 'https://pan.baidu.com/rest/2.0/xpan/multimedia?method=recentlist&access_token=' + tok + '&category=3&limit=2')
