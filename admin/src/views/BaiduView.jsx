import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cloud,
  QrCode,
  RefreshCw,
  FolderPlus,
  List,
  Upload,
  LogOut,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import {
  getValidAccessToken,
  initPhotoDirs,
  listFiles,
  uploadFile,
  hasBaiduCredentials,
  PHOTO_DIR,
} from '../api'

/** 通用按钮 */
function ActionButton({ icon: Icon, label, onClick, disabled, loading, variant = 'primary' }) {
  const variants = {
    primary: 'bg-gradient-to-r from-primary to-aurora-pink text-white shadow-glow hover:-translate-y-0.5',
    emerald: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300',
    rose: 'bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-300',
    sky: 'bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-300',
    amber: 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-300',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${variants[variant]}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  )
}

export default function BaiduView() {
  const { showToast } = useToast()
  const credentialsReady = hasBaiduCredentials()

  const [authStatus, setAuthStatus] = useState({ authorized: false, loading: true })
  const [qrInfo, setQrInfo] = useState(null) // { qrcode_url, device_code, verification_url }
  const [polling, setPolling] = useState(false)
  const [actionLoading, setActionLoading] = useState({
    qr: false,
    initDirs: false,
    list: false,
    upload: false,
  })
  const [files, setFiles] = useState([])
  const [lastUploadPath, setLastUploadPath] = useState('')

  const fileInputRef = useRef(null)
  const pollTimerRef = useRef(null)

  /** 刷新授权状态（直接读 server 端 token 状态，不经浏览器 localStorage） */
  const refreshAuthStatus = useCallback(async () => {
    setAuthStatus({ authorized: false, loading: true })
    try {
      const resp = await fetch('/api/baidu/status')
      const status = await resp.json()
      setAuthStatus({ ...status, loading: false })
    } catch {
      setAuthStatus({ authorized: false, loading: false })
    }
  }, [])

  useEffect(() => {
    if (credentialsReady) refreshAuthStatus()
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [credentialsReady, refreshAuthStatus])

  /** 获取二维码（server 端 OAuth，token 不经浏览器） */
  const handleGetQrCode = async () => {
    setActionLoading((s) => ({ ...s, qr: true }))
    try {
      const resp = await fetch('/api/baidu/qr-code')
      const info = await resp.json()
      if (!resp.ok || info.error) {
        throw new Error(info.message || info.error || '获取二维码失败')
      }
      setQrInfo(info)
      showToast('二维码已生成，请用百度网盘 App 扫码', 'info')
      startPolling(info.device_code)
    } catch (e) {
      showToast(e.message || '获取二维码失败', 'error')
    } finally {
      setActionLoading((s) => ({ ...s, qr: false }))
    }
  }

  /** 轮询授权状态（server 端 OAuth） */
  const startPolling = (deviceCode) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    setPolling(true)

    const tick = async () => {
      try {
        const resp = await fetch(`/api/baidu/qr-status?code=${encodeURIComponent(deviceCode)}`)
        const result = await resp.json()
        if (result.status === 'authorized') {
          setPolling(false)
          setQrInfo(null)
          showToast('授权成功 🎉', 'success')
          await refreshAuthStatus()
          return
        }
        if (result.status === 'expired') {
          setPolling(false)
          setQrInfo(null)
          showToast(result.message || '二维码已过期，请重新获取', 'error')
          return
        }
        if (result.status === 'error') {
          setPolling(false)
          showToast(result.message || '授权失败', 'error')
          return
        }
        // pending：继续轮询
      } catch (e) {
        setPolling(false)
        showToast(e.message || '授权失败', 'error')
        return
      }
      pollTimerRef.current = setTimeout(tick, 5000)
    }
    pollTimerRef.current = setTimeout(tick, 5000)
  }

  /** 停止轮询 */
  const stopPolling = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    setPolling(false)
  }

  /** 初始化照片目录 */
  const handleInitDirs = async () => {
    setActionLoading((s) => ({ ...s, initDirs: true }))
    try {
      const token = await getValidAccessToken()
      if (!token) {
        showToast('未授权，请先扫码登录', 'error')
        return
      }
      await initPhotoDirs(token)
      showToast(`照片目录已就绪：${PHOTO_DIR}`, 'success')
    } catch (e) {
      showToast(e.message || '初始化目录失败', 'error')
    } finally {
      setActionLoading((s) => ({ ...s, initDirs: false }))
    }
  }

  /** 列出文件 */
  const handleListFiles = async () => {
    setActionLoading((s) => ({ ...s, list: true }))
    try {
      const token = await getValidAccessToken()
      if (!token) {
        showToast('未授权，请先扫码登录', 'error')
        return
      }
      const resp = await listFiles(token, PHOTO_DIR)
      const list = resp.list || []
      setFiles(list)
      showToast(`列出 ${list.length} 个文件`, 'success')
    } catch (e) {
      showToast(e.message || '列出文件失败', 'error')
    } finally {
      setActionLoading((s) => ({ ...s, list: false }))
    }
  }

  /** 上传测试文件 */
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一文件
    if (!file) return

    setActionLoading((s) => ({ ...s, upload: true }))
    try {
      const token = await getValidAccessToken()
      if (!token) {
        showToast('未授权，请先扫码登录', 'error')
        return
      }
      const remotePath = `${PHOTO_DIR}/${Date.now()}_${file.name}`
      const result = await uploadFile(token, remotePath, file)
      if (result.skipped) {
        showToast('文件已存在，跳过上传', 'info')
      } else {
        showToast(`上传成功：${result.path}`, 'success')
        setLastUploadPath(result.path || remotePath)
      }
    } catch (e) {
      showToast(e.message || '上传失败', 'error')
    } finally {
      setActionLoading((s) => ({ ...s, upload: false }))
    }
  }

  /** 退出授权（清空 server 端 token + 磁盘持久化文件） */
  const handleLogout = async () => {
    stopPolling()
    setQrInfo(null)
    setFiles([])
    setLastUploadPath('')
    try {
      await fetch('/api/baidu/logout', { method: 'POST' })
    } catch {
      /* 静默 */
    }
    await refreshAuthStatus()
    showToast('已退出授权', 'info')
  }

  // 未配置凭证
  if (!credentialsReady) {
    return (
      <div className="glass-card flex min-h-[60vh] flex-col items-center justify-center rounded-3xl p-10 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20">
          <ShieldAlert className="h-9 w-9 text-amber-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">未配置百度网盘凭证</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          请在 <code className="rounded bg-white/70 px-1 py-0.5 font-mono dark:bg-white/10">admin/.env.local</code> 配置：
        </p>
        <pre className="mt-3 rounded-2xl bg-gray-900/90 px-4 py-3 text-xs text-emerald-300">
{`VITE_BAIDU_APP_KEY=你的AppKey
VITE_BAIDU_SECRET_KEY=你的SecretKey`}
        </pre>
        <p className="mt-3 text-xs text-gray-400">配置完成后重启 dev server 生效</p>
      </div>
    )
  }

  const authorized = !!authStatus.authorized

  return (
    <div className="space-y-6">
      {/* 授权状态卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white shadow-md">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">授权状态</h3>
            <p className="mt-0.5 text-xs text-gray-400">设备码扫码授权，token 由 server 端管理（持久化到磁盘，重启不丢失）</p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              authorized
                ? 'bg-emerald-50/70 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-gray-100/70 text-gray-500 dark:bg-white/10 dark:text-gray-400'
            }`}
          >
            {authStatus.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : authorized ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            <span>{authStatus.loading ? '检查中…' : authorized ? '已授权' : '未授权'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionButton
            icon={QrCode}
            label={actionLoading.qr ? '生成中…' : '获取二维码'}
            onClick={handleGetQrCode}
            loading={actionLoading.qr}
            disabled={authorized || polling}
          />
          <ActionButton
            icon={RefreshCw}
            label="刷新状态"
            onClick={refreshAuthStatus}
            variant="sky"
          />
          {authorized && (
            <ActionButton
              icon={LogOut}
              label="退出授权"
              onClick={handleLogout}
              variant="rose"
            />
          )}
        </div>

        {/* 二维码区域 */}
        {qrInfo && (
          <div className="mt-5 rounded-2xl border border-white/50 bg-white/40 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {qrInfo.qrcode_url && (
                <img
                  src={qrInfo.qrcode_url}
                  alt="百度网盘授权二维码"
                  className="h-48 w-48 rounded-2xl bg-white p-2 shadow-md"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  请使用百度网盘 App 扫码授权
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {polling ? '正在等待授权结果…（每 5 秒轮询一次）' : '已停止轮询'}
                </p>
                {qrInfo.verification_url && (
                  <a
                    href={qrInfo.verification_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    手动打开授权页
                  </a>
                )}
                {polling && (
                  <button
                    onClick={stopPolling}
                    className="mt-3 block rounded-xl bg-gray-500/10 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-500/20"
                  >
                    停止轮询
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 文件操作卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-violet-500 to-purple-500 text-white shadow-md">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">文件操作</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              照片目录：<code className="font-mono">{PHOTO_DIR}</code>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionButton
            icon={FolderPlus}
            label={actionLoading.initDirs ? '创建中…' : '初始化照片目录'}
            onClick={handleInitDirs}
            loading={actionLoading.initDirs}
            disabled={!authorized}
            variant="emerald"
          />
          <ActionButton
            icon={List}
            label={actionLoading.list ? '列出中…' : '列出文件'}
            onClick={handleListFiles}
            loading={actionLoading.list}
            disabled={!authorized}
            variant="sky"
          />
          <ActionButton
            icon={Upload}
            label={actionLoading.upload ? '上传中…' : '上传测试文件'}
            onClick={handleUploadClick}
            loading={actionLoading.upload}
            disabled={!authorized}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {lastUploadPath && (
          <div className="mt-4 rounded-2xl bg-emerald-50/60 p-3 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            最近上传：<code className="font-mono break-all">{lastUploadPath}</code>
          </div>
        )}

        {/* 文件列表表格 */}
        {files.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/50 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/60 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">文件名</th>
                  <th className="px-3 py-2.5 font-semibold">大小</th>
                  <th className="px-3 py-2.5 font-semibold">类型</th>
                  <th className="px-3 py-2.5 font-semibold">修改时间</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, idx) => (
                  <tr
                    key={f.fs_id || idx}
                    className="border-t border-white/40 bg-white/30 dark:border-white/5 dark:bg-white/5"
                  >
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">
                      {f.server_filename || f.filename}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                      {formatSize(f.size)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                      {f.isdir === 1 ? '目录' : '文件'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                      {f.local_mtime ? new Date(f.local_mtime * 1000).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (bytes == null) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}
