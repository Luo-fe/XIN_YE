/**
 * 百度网盘分享接口（Web 版）
 * 通过 vite dev 代理 /baidu/share/set 访问 pan.baidu.com
 */

import axios from 'axios'
import { BAIDU_SHARE_URL } from './baiduConfig'

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' }

function toForm(data) {
  return new URLSearchParams(data).toString()
}

/**
 * 创建分享链接
 * @param {string} token access_token
 * @param {number} fsid 文件 fs_id
 * @param {string} [password=''] 提取码，空串表示无提取码
 * @returns {Promise<object>} 百度返回的 share 信息（含 shareid / shorturl / links 等）
 */
export async function createShare(token, fsid, password = '') {
  const resp = await axios.post(
    `${BAIDU_SHARE_URL}?access_token=${token}`,
    toForm({
      period: 0, // 永久有效
      pwd: password,
      fid_list: JSON.stringify([fsid]),
    }),
    { headers: FORM_HEADERS },
  )
  return resp.data
}
