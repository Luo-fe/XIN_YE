/**
 * 百度网盘授权与 token 管理
 *
 * 统一走服务端 API（/api/baidu/*），token 由 server-plugin.js 管理：
 *   - 扫码授权：/api/baidu/qr-code + /api/baidu/qr-status
 *   - 状态查询：/api/baidu/status
 *   - token 获取：/api/baidu/status 返回 authorized 后，调用 /api/baidu/token 获取
 *   - 退出授权：/api/baidu/logout
 *
 * 前端不再使用 localStorage 存储 token，避免服务端/前端状态不同步。
 */

import {
  BAIDU_APP_KEY,
  BAIDU_SECRET_KEY,
  hasBaiduCredentials,
} from './baiduConfig'

/**
 * 获取授权状态（走服务端 API）
 * @returns {Promise<{ authorized: boolean, loading?: boolean }>}
 */
export async function getAuthStatus() {
  if (!hasBaiduCredentials()) return { authorized: false }
  try {
    const resp = await fetch('/api/baidu/status')
    const status = await resp.json()
    return { authorized: Boolean(status.authorized), loading: false }
  } catch {
    return { authorized: false, loading: false }
  }
}

/**
 * 获取有效 access_token（走服务端 API）
 * @returns {Promise<string|null>}
 */
export async function getValidAccessToken() {
  if (!hasBaiduCredentials()) return null
  try {
    const resp = await fetch('/api/baidu/token')
    if (!resp.ok) return null
    const data = await resp.json()
    return data.access_token || null
  } catch {
    return null
  }
}

/**
 * 获取扫码授权二维码（服务端 OAuth）
 * @returns {Promise<{ qrcode_url: string, device_code: string, verification_url: string, expires_in: number, interval: number }>}
 */
export async function getQrCode() {
  if (!hasBaiduCredentials()) {
    throw new Error('未配置百度网盘凭证，请在 admin/.env.local 中设置 VITE_BAIDU_APP_KEY / VITE_BAIDU_SECRET_KEY')
  }

  const resp = await fetch('/api/baidu/qr-code')
  const data = await resp.json()
  if (!resp.ok || data.error) {
    throw new Error(data.message || data.error || '获取二维码失败')
  }
  return {
    qrcode_url: data.qrcode_url,
    device_code: data.device_code,
    verification_url: data.verification_url,
    expires_in: data.expires_in || 300,
    interval: data.interval || 5,
  }
}

/**
 * 轮询扫码授权状态（服务端 OAuth）
 * @param {string} deviceCode
 * @returns {Promise<'pending'|'authorized'>}
 */
export async function getQrCodeStatus(deviceCode) {
  const resp = await fetch(
    `/api/baidu/qr-status?code=${encodeURIComponent(deviceCode)}`,
  )
  const result = await resp.json()
  if (result.status === 'authorized') return 'authorized'
  if (result.status === 'pending') return 'pending'
  if (result.status === 'expired') throw new Error('二维码已过期，请重新获取')
  throw new Error(result.message || '授权失败')
}

/**
 * 退出授权
 */
export async function clearTokens() {
  try {
    await fetch('/api/baidu/logout', { method: 'POST' })
  } catch {
    /* 静默 */
  }
}

/**
 * 同步 token 到服务端（兼容旧调用，实际由服务端自行管理）
 * @returns {Promise<boolean>}
 */
export async function syncTokenToServer() {
  // 服务端流程下 token 已在服务端管理，无需同步
  return true
}

/**
 * 获取当前 token 信息（兼容旧调用）
 * @returns {{ access_token: string, refresh_token: string, expires_at: string }}
 */
export function getTokens() {
  // 服务端流程下，前端不持有原始 token
  // 返回空对象保持接口兼容，实际 token 由服务端管理
  return { access_token: '', refresh_token: '', expires_at: '' }
}

/**
 * 存储 token（兼容旧调用，实际由服务端管理）
 */
export function setTokens() {
  // no-op：服务端流程下由 handleQrStatus / handleBaiduSaveToken 管理
}

/**
 * 刷新 token（兼容旧调用，实际由服务端 ensureValidToken 管理）
 */
export async function refreshToken() {
  // no-op：服务端自动刷新
}

export { hasBaiduCredentials }
