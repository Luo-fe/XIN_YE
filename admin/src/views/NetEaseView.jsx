import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Music,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  LogOut,
  QrCode,
  Save,
  ListMusic,
  Stethoscope,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '../components/Toast'

/** 网易云 AppID/RSA 私钥 是否在 .env.local 中配置 */
function hasNeteaseCredentials() {
  const id = import.meta.env.VITE_NETEASE_CLIENT_ID || ''
  const privateKey = import.meta.env.VITE_NETEASE_PRIVATE_KEY || ''
  return Boolean(id && privateKey && id !== 'REPLACE_ME' && privateKey !== 'REPLACE_ME')
}

const AUDIO_LEVELS = [
  { value: 'lossless', label: '无损（需VIP）' },
  { value: 'exhigh', label: '极高（320kbps）' },
  { value: 'standard', label: '标准（128kbps）' },
]

/** 通用按钮（沿用 BaiduView 风格） */
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

export default function NetEaseView() {
  const { showToast } = useToast()
  const credentialsReady = hasNeteaseCredentials()

  const [authStatus, setAuthStatus] = useState({ authorized: false, loading: true })
  const [qrInfo, setQrInfo] = useState(null) // { qrcodeUrl, qrcodeKey, expiresAt }
  const [polling, setPolling] = useState(false)
  const [playlists, setPlaylists] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  // 默认值与服务端 neteaseConfigStore 一致（exhigh=320kbps），避免未保存时显示与实际不符
  const [audioLevel, setAudioLevel] = useState('exhigh')
  const [loading, setLoading] = useState({ qr: false, playlists: false, save: false, diag: false })
  const [diagResult, setDiagResult] = useState(null) // 诊断结果

  const pollTimerRef = useRef(null)

  /** 拉取授权状态 */
  const refreshAuthStatus = useCallback(async () => {
    setAuthStatus({ authorized: false, loading: true })
    try {
      const resp = await fetch('/api/netease/token-status')
      const status = await resp.json()
      setAuthStatus({ ...status, loading: false })
    } catch {
      setAuthStatus({ authorized: false, loading: false })
    }
  }, [])

  /** 拉取已保存配置（选中歌单 + 音质） */
  const refreshConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/netease/config')
      const cfg = await resp.json()
      if (Array.isArray(cfg.selectedPlaylistIds)) setSelectedIds(cfg.selectedPlaylistIds)
      if (cfg.audioLevel) setAudioLevel(cfg.audioLevel)
    } catch {
      /* 静默 */
    }
  }, [])

  useEffect(() => {
    if (!credentialsReady) return
    refreshAuthStatus()
    refreshConfig()
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [credentialsReady, refreshAuthStatus, refreshConfig])

  /** 获取二维码 */
  const handleGetQrCode = async () => {
    setLoading((s) => ({ ...s, qr: true }))
    setDiagResult(null)
    try {
      const resp = await fetch('/api/netease/qr-code')
      const info = await resp.json()
      if (!resp.ok || info.error) {
        // 保留 hint 字段用于在界面上展示完整修复指引
        if (info.hint) {
          setDiagResult({
            ok: false,
            step: 'qr_code',
            code: info.code,
            message: info.message || info.error,
            hint: info.hint,
          })
        }
        throw new Error(info.message || info.error || '获取二维码失败')
      }
      setQrInfo(info)
      showToast('二维码已生成，请用网易云音乐 App 扫码', 'info')
      startPolling(info.qrcodeKey)
    } catch (e) {
      showToast(e.message || '获取二维码失败', 'error')
    } finally {
      setLoading((s) => ({ ...s, qr: false }))
    }
  }

  /** 运行诊断：测试网易云 OpenAPI 匿名登录是否可用 */
  const handleDiagnose = async () => {
    setLoading((s) => ({ ...s, diag: true }))
    setDiagResult(null)
    try {
      const resp = await fetch('/api/netease/diagnose')
      const data = await resp.json()
      setDiagResult(data)
      if (data.ok) {
        showToast('诊断通过：匿名登录可用', 'success')
      } else {
        showToast(data.message || '诊断未通过', 'error')
      }
    } catch (e) {
      setDiagResult({ ok: false, message: String(e.message || e) })
      showToast('诊断请求失败', 'error')
    } finally {
      setLoading((s) => ({ ...s, diag: false }))
    }
  }

  /** 轮询扫码状态（5 秒一次，参考 BaiduView 模式） */
  const startPolling = (qrcodeKey) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    setPolling(true)

    const tick = async () => {
      try {
        const resp = await fetch(`/api/netease/qr-status?key=${encodeURIComponent(qrcodeKey)}`)
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
        // pending / scanned：继续轮询
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

  /** 拉取用户歌单 */
  const handleLoadPlaylists = async () => {
    setLoading((s) => ({ ...s, playlists: true }))
    try {
      // 25s 超时：服务端遍历歌单较慢时避免按钮无限转圈
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 25000)
      let resp
      try {
        resp = await fetch('/api/netease/user-playlists', { signal: ctrl.signal })
      } finally {
        clearTimeout(timer)
      }
      const data = await resp.json()
      if (!resp.ok || data.error) {
        throw new Error(data.message || data.error || '拉取歌单失败')
      }
      setPlaylists(data.playlists || [])
      showToast(`已拉取 ${data.count || 0} 个歌单`, 'success')
    } catch (e) {
      showToast(e.message || '拉取歌单失败', 'error')
      // 拉取失败通常是 token 失效（如服务器重启后），刷新授权状态徽章提示重新登录
      refreshAuthStatus()
    } finally {
      setLoading((s) => ({ ...s, playlists: false }))
    }
  }

  /** 切换歌单选中态 */
  const togglePlaylist = (id) => {
    const sid = String(id)
    setSelectedIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    )
  }

  /** 保存配置 */
  const handleSave = async () => {
    setLoading((s) => ({ ...s, save: true }))
    try {
      const resp = await fetch('/api/netease/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPlaylistIds: selectedIds, audioLevel }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        throw new Error(data.message || data.error || '保存失败')
      }
      showToast(`已保存 ${selectedIds.length} 个歌单`, 'success')
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    } finally {
      setLoading((s) => ({ ...s, save: false }))
    }
  }

  /** 退出授权 */
  const handleLogout = async () => {
    stopPolling()
    setQrInfo(null)
    setPlaylists([])
    setSelectedIds([])
    try {
      await fetch('/api/netease/logout', { method: 'POST' })
    } catch {
      /* 静默 */
    }
    await refreshAuthStatus()
    showToast('已退出网易云授权', 'info')
  }

  // 未配置凭证
  if (!credentialsReady) {
    return (
      <div className="glass-card flex min-h-[60vh] flex-col items-center justify-center rounded-3xl p-10 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20">
          <ShieldAlert className="h-9 w-9 text-amber-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">未配置网易云凭证</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          请先到{' '}
          <a
            href="https://developer.music.163.com/st/developer"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            网易云音乐开放平台
          </a>{' '}
          注册应用，然后在{' '}
          <code className="rounded bg-white/70 px-1 py-0.5 font-mono dark:bg-white/10">
            admin/.env.local
          </code>{' '}
          配置：
        </p>
        <pre className="mt-3 rounded-2xl bg-gray-900/90 px-4 py-3 text-left text-xs text-emerald-300">
{`VITE_NETEASE_CLIENT_ID=你的AppID
VITE_NETEASE_PRIVATE_KEY=你的PKCS8私钥（单行base64或多行PEM用\\n分隔）`}
        </pre>
        <p className="mt-3 text-xs text-gray-400">
          扫码登录流程，无需配置回调地址；配置后重启 dev server 生效
        </p>
      </div>
    )
  }

  const authorized = !!authStatus.authorized

  return (
    <div className="space-y-6">
      {/* 授权状态卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-rose-500 to-red-500 text-white shadow-md">
            <Music className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">授权状态</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              扫码登录流程，token 由 admin server 端管理（持久化到 .netease-token.json，重启不丢失）
            </p>
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

        {authorized && authStatus.user && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/40 px-4 py-2.5 dark:bg-white/5">
            {authStatus.user.avatarUrl && (
              <img
                src={authStatus.user.avatarUrl}
                alt={authStatus.user.nickname || 'avatar'}
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                {authStatus.user.nickname || '网易云用户'}
              </p>
              {authStatus.user.userId && (
                <p className="text-xs text-gray-400">UID: {authStatus.user.userId}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!authorized && (
            <ActionButton
              icon={QrCode}
              label={loading.qr ? '生成中…' : '获取二维码'}
              onClick={handleGetQrCode}
              loading={loading.qr}
              disabled={polling}
            />
          )}
          <ActionButton
            icon={Stethoscope}
            label={loading.diag ? '诊断中…' : '诊断登录'}
            onClick={handleDiagnose}
            loading={loading.diag}
            variant="amber"
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

        {/* 诊断结果 */}
        {diagResult && (
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              diagResult.ok
                ? 'border-emerald-400/40 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                : 'border-amber-400/40 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-2">
              {diagResult.ok ? (
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {diagResult.ok ? '配置正常' : `诊断未通过（code=${diagResult.code ?? '?'}）`}
                </p>
                <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-300">
                  {diagResult.message}
                </p>
                {diagResult.hint && (
                  <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-white/60 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:bg-white/10 dark:text-gray-200">
                    {diagResult.hint}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 二维码区域 */}
        {qrInfo && (
          <div className="mt-5 rounded-2xl border border-white/50 bg-white/40 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {qrInfo.qrcodeUrl && (
                <img
                  src={qrInfo.qrcodeUrl}
                  alt="网易云音乐授权二维码"
                  className="h-48 w-48 rounded-2xl bg-white p-2 shadow-md"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  请使用网易云音乐 App 扫码授权
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {polling ? '正在等待授权结果…（每 5 秒轮询一次）' : '已停止轮询'}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  二维码 5 分钟内有效，过期后请重新获取
                </p>
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

      {/* 歌单 + 音质配置卡片 */}
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-violet-500 to-purple-500 text-white shadow-md">
            <ListMusic className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">歌单与音质</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              勾选要展示到博客悬浮播放器的歌单，保存后 blog 端会通过 admin 代理拉取歌曲
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ActionButton
            icon={ListMusic}
            label={loading.playlists ? '拉取中…' : '拉取我的歌单'}
            onClick={handleLoadPlaylists}
            loading={loading.playlists}
            disabled={!authorized}
            variant="sky"
          />
          <ActionButton
            icon={Save}
            label={loading.save ? '保存中…' : '保存配置'}
            onClick={handleSave}
            loading={loading.save}
            disabled={!authorized}
            variant="emerald"
          />

          {/* 音质选择 */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-1.5 dark:bg-white/5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">音质</span>
            <select
              value={audioLevel}
              onChange={(e) => setAudioLevel(e.target.value)}
              className="rounded-xl border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none dark:text-gray-200"
            >
              {AUDIO_LEVELS.map((lv) => (
                <option key={lv.value} value={lv.value}>
                  {lv.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 歌单列表 */}
        {playlists.length > 0 ? (
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {playlists.map((p) => {
              const checked = selectedIds.includes(String(p.id))
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                    checked
                      ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                      : 'border-white/40 bg-white/30 hover:bg-white/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlaylist(p.id)}
                    className="h-4 w-4 shrink-0 accent-[#8B5CF6]"
                  />
                  {p.coverImgUrl ? (
                    <img
                      src={p.coverImgUrl}
                      alt={p.name}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-slate-400 to-slate-500 text-white">
                      <Music className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.trackCount || 0} 首{p.creator?.nickname ? ` · ${p.creator.nickname}` : ''}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/40 px-4 py-8 text-center text-xs text-gray-400 dark:border-white/10">
            {authorized ? '点击「拉取我的歌单」开始' : '请先完成网易云扫码授权'}
          </div>
        )}

        {/* 已选数量 */}
        {selectedIds.length > 0 && (
          <div className="mt-4 rounded-2xl bg-violet-50/60 px-4 py-2.5 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
            已选 <strong>{selectedIds.length}</strong> 个歌单 · 当前音质 <strong>{audioLevel}</strong>
          </div>
        )}
      </section>
    </div>
  )
}
