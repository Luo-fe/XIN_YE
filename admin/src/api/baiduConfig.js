/**
 * 百度网盘开放平台 API 配置（Web 版）
 *
 * 凭证从 import.meta.env 读取，绝不硬编码。
 *
 * 由于浏览器跨域限制，百度网盘接口不支持直接跨域请求，
 * 所有接口均通过 vite dev 代理访问（详见 vite.config.js 中 server.proxy）：
 *   /baidu/*        -> https://pan.baidu.com       （xpan 业务接口 + share）
 *   /baidu-oauth/*  -> https://openapi.baidu.com    （OAuth 授权/token）
 *   /baidu-pcs/*    -> https://d.pcs.baidu.com      （PCS 分片上传 superfile2）
 */

export const BAIDU_APP_KEY = import.meta.env.VITE_BAIDU_APP_KEY || ''
export const BAIDU_SECRET_KEY = import.meta.env.VITE_BAIDU_SECRET_KEY || ''
export const BAIDU_APP_NAME = import.meta.env.VITE_BAIDU_APP_NAME || '芋泥椰奶'

/** 网盘应用根目录（/apps/{AppName}） */
export const APP_DIR = `/apps/${BAIDU_APP_NAME}`
/** 照片墙专用目录 */
export const PHOTO_DIR = `${APP_DIR}/照片墙`

// 以下接口均使用 dev 代理路径，规避浏览器 CORS
export const BAIDU_TOKEN_URL = '/baidu-oauth/oauth/2.0/token'
export const BAIDU_DEVICE_CODE_URL = '/baidu-oauth/oauth/2.0/device/code'
export const BAIDU_PAN_API = '/baidu/rest/2.0/xpan'
export const BAIDU_PCS_API = '/baidu-pcs/rest/2.0/pcs'
export const BAIDU_SHARE_URL = '/baidu/share/set'

/** localStorage key 前缀 */
export const TOKEN_STORAGE_PREFIX = 'yn_blog_baidu_'

/** 是否已配置百度凭证（AppKey + SecretKey 均非空） */
export function hasBaiduCredentials() {
  return Boolean(BAIDU_APP_KEY && BAIDU_SECRET_KEY)
}
