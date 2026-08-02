/**
 * 百度网盘文件操作（Web 版）
 *
 * 所有接口均通过 vite dev 代理路径访问（详见 baiduConfig.js / vite.config.js）。
 * 上传采用 fetch + FormData（multipart/form-data），区别于 Capacitor 端的 base64 方案。
 */

import axios from 'axios'
import {
  BAIDU_PAN_API,
  BAIDU_PCS_API,
  APP_DIR,
  PHOTO_DIR,
} from './baiduConfig'

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' }

/** 将对象序列化为 application/x-www-form-urlencoded 字符串 */
function toForm(data) {
  return new URLSearchParams(data).toString()
}

/**
 * 创建目录（errno=-8 视为已存在，按成功处理）
 * @param {string} token access_token
 * @param {string} dirPath 网盘绝对路径
 * @returns {Promise<{ success: boolean }>}
 */
export async function createDir(token, dirPath) {
  try {
    await axios.post(
      `${BAIDU_PAN_API}/file?method=create&access_token=${token}`,
      toForm({ path: dirPath, isdir: 1, rtype: 0 }),
      { headers: FORM_HEADERS },
    )
    return { success: true }
  } catch (e) {
    const errno = e.response?.data?.errno
    if (errno === -8) return { success: true }
    throw e
  }
}

/**
 * 计算 ArrayBuffer 的 MD5（十六进制字符串）。
 * 若运行环境不支持 MD5（如非 HTTPS 上下文），回退为时间戳+随机数。
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function md5FromArrayBuffer(arrayBuffer) {
  try {
    const hashBuffer = await crypto.subtle.digest('MD5', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return Date.now().toString(16) + Math.random().toString(16).slice(2, 10)
  }
}

/**
 * 三步上传文件到百度网盘（precreate → superfile2 → create）
 * Web 版第二步使用 FormData 上传二进制。
 *
 * @param {string} token access_token
 * @param {string} remotePath 网盘绝对路径
 * @param {Blob} fileBlob 文件二进制内容
 * @returns {Promise<{ success?: boolean, skipped?: boolean, fs_id?: string, path?: string }>}
 */
export async function uploadFile(token, remotePath, fileBlob) {
  const size = fileBlob.size
  const arrayBuffer = await fileBlob.arrayBuffer()
  const md5 = await md5FromArrayBuffer(arrayBuffer)
  const blockList = JSON.stringify([md5])

  // 1. precreate
  const preResp = await axios.post(
    `${BAIDU_PAN_API}/file?method=precreate&access_token=${token}`,
    toForm({
      path: remotePath,
      size,
      isdir: 0,
      autoinit: 1,
      block_list: blockList,
      rtype: 3,
    }),
    { headers: FORM_HEADERS },
  )

  const preData = preResp.data || {}
  if (preData.error_code) {
    // 31061: 文件已存在；-8: 路径已存在
    if (preData.error_code === 31061 || preData.error_code === -8) {
      return { skipped: true }
    }
    throw new Error(`precreate 失败: ${preData.error_code} ${preData.error_msg || ''}`)
  }

  const uploadid = preData.uploadid
  if (!uploadid) {
    throw new Error('precreate 未返回 uploadid')
  }

  // 2. superfile2（用 FormData 上传二进制，浏览器自动设置 multipart/form-data 边界）
  const superUrl =
    `${BAIDU_PCS_API}/superfile2?method=upload&access_token=${token}` +
    `&path=${encodeURIComponent(remotePath)}&uploadid=${uploadid}&partseq=0`
  const formData = new FormData()
  formData.append('file', fileBlob)

  const uploadResp = await fetch(superUrl, {
    method: 'POST',
    body: formData,
  })
  if (!uploadResp.ok) {
    throw new Error(`superfile2 上传 HTTP 错误: ${uploadResp.status}`)
  }
  const uploadData = await uploadResp.json().catch(() => ({}))
  if (uploadData && uploadData.error_code) {
    throw new Error(`superfile2 上传失败: ${uploadData.error_code} ${uploadData.error_msg || ''}`)
  }

  // 3. create
  const createResp = await axios.post(
    `${BAIDU_PAN_API}/file?method=create&access_token=${token}`,
    toForm({
      path: remotePath,
      size,
      isdir: 0,
      rtype: 3,
      uploadid,
      block_list: blockList,
    }),
    { headers: FORM_HEADERS },
  )

  const createData = createResp.data || {}
  if (createData.error_code) {
    if (createData.error_code === 31061 || createData.error_code === -8) {
      return { skipped: true }
    }
    throw new Error(`create 失败: ${createData.error_code} ${createData.error_msg || ''}`)
  }

  return {
    success: true,
    fs_id: createData.fs_id,
    path: createData.path || remotePath,
  }
}

/**
 * 列出目录下的文件
 * @param {string} token
 * @param {string} dir 网盘绝对路径
 * @returns {Promise<object>} 百度返回的 list 响应
 */
export async function listFiles(token, dir) {
  const resp = await axios.get(`${BAIDU_PAN_API}/file?method=list&access_token=${token}`, {
    params: { dir },
  })
  return resp.data
}

/**
 * 获取文件元信息（含 dlink）
 * @param {string} token
 * @param {number[]} fsids 文件 id 数组
 * @returns {Promise<object>}
 */
export async function getFileMetas(token, fsids) {
  const resp = await axios.get(
    `${BAIDU_PAN_API}/multimedia?method=filemetas&access_token=${token}`,
    { params: { fsids: JSON.stringify(fsids), dlink: 1 } },
  )
  return resp.data
}

/**
 * 删除文件/目录
 * @param {string} token
 * @param {string} path 网盘绝对路径
 * @returns {Promise<object>}
 */
export async function deleteFile(token, path) {
  const resp = await axios.post(
    `${BAIDU_PAN_API}/file?method=filemanager&access_token=${token}`,
    toForm({ opera: 'delete', filelist: JSON.stringify([path]) }),
    { headers: FORM_HEADERS },
  )
  return resp.data
}

/**
 * 初始化照片目录：依次创建 APP_DIR 与 PHOTO_DIR
 * @param {string} token
 * @returns {Promise<{ success: boolean }>}
 */
export async function initPhotoDirs(token) {
  await createDir(token, APP_DIR)
  await createDir(token, PHOTO_DIR)
  return { success: true }
}
