import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  User,
  FolderGit2,
  Cloud,
  Save,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Info,
  Image as ImageIcon,
  Crop,
  Upload,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react'
import { getConfig, setConfig } from '../utils/configStore'
import { useToast } from '../components/Toast'
import CoverAreaPicker from '../components/CoverAreaPicker'

/** 从 env 读取百度凭证（脱敏处理） */
function useBaiduCredential() {
  return useMemo(() => {
    const appKey = import.meta.env.VITE_BAIDU_APP_KEY || ''
    const envAppName = import.meta.env.VITE_BAIDU_APP_NAME || ''
    return {
      appKey,
      envAppName,
      hasAppKey: Boolean(appKey) && appKey !== '你的百度AppKey',
      maskedAppKey: maskSecret(appKey),
    }
  }, [])
}

/** 脱敏显示：保留前 4 位与后 4 位，中间用 • 代替 */
function maskSecret(secret) {
  if (!secret) return ''
  if (secret.length <= 8) return '••••'
  return `${secret.slice(0, 4)}${'•'.repeat(Math.min(8, secret.length - 8))}${secret.slice(-4)}`
}

/** 通用分区容器 */
function Section({ icon: Icon, title, desc, children, accent = 'from-primary to-aurora-pink' }) {
  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="mb-5 flex items-start gap-3">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr ${accent} text-white shadow-md`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          {desc && <p className="mt-0.5 text-xs text-gray-400">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/** 字段标签 */
function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        {children}
      </label>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </div>
  )
}

export default function SettingsView() {
  const { showToast } = useToast()
  const credential = useBaiduCredential()

  // 初始化表单数据（优先从 admin 服务端读取已落盘的配置，本地 localStorage 作兜底）
  const [form, setForm] = useState(() => getConfig())
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  // 主页 Hero 图：取景框弹窗 + 上传
  const [heroCropOpen, setHeroCropOpen] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const heroFileInputRef = useRef(null)
  // 网站背景：列表 + 添加上传/URL
  const [backgrounds, setBackgrounds] = useState([])
  const [bgUrlInput, setBgUrlInput] = useState('')
  const [bgUploading, setBgUploading] = useState(false)
  const [bgDeleting, setBgDeleting] = useState('')
  const bgFileInputRef = useRef(null)

  // 加载背景列表
  const refreshBackgrounds = useCallback(async () => {
    try {
      const resp = await fetch('/api/backgrounds')
      const json = await resp.json()
      if (Array.isArray(json.backgrounds)) setBackgrounds(json.backgrounds)
    } catch {
      /* 服务端不可用时保持空 */
    }
  }, [])

  useEffect(() => {
    refreshBackgrounds()
  }, [refreshBackgrounds])

  /** 上传图片文件 → 返回可访问 URL（存到博客 public/） */
  const uploadImageFile = useCallback(
    async (file) => {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      // 图片存到博客 public/photos/ 的接口（上传后返回 /photos/xxx 可直接引用）
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const resp = await fetch(`/api/content/photo-thumb/img_${Date.now()}.${ext}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const json = await resp.json()
      if (!resp.ok || !json.data?.path) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      return json.data.path
    },
    [],
  )

  /** 主页 Hero 图：上传 */
  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('图片不能超过 8MB', 'error')
      return
    }
    setHeroUploading(true)
    try {
      const path = await uploadImageFile(file)
      updateProfile('coupleHero', path)
      showToast('主页图已上传，保存配置后生效', 'success')
    } catch (err) {
      showToast(err.message || '上传失败', 'error')
    } finally {
      setHeroUploading(false)
    }
  }

  /** 主页 Hero 图：保存取景区域 */
  const handleSaveHeroArea = (area) => {
    updateProfile('heroArea', area)
    setHeroCropOpen(false)
    showToast('展示区域已保存，保存配置后生效', 'success')
  }

  /** 网站背景：上传添加 */
  const handleAddBackgroundUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('背景图不能超过 15MB', 'error')
      return
    }
    setBgUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataUrl }),
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
      await refreshBackgrounds()
      showToast('背景已添加', 'success')
    } catch (err) {
      showToast(err.message || '添加失败', 'error')
    } finally {
      setBgUploading(false)
    }
  }

  /** 网站背景：URL 添加 */
  const handleAddBackgroundUrl = async () => {
    const url = bgUrlInput.trim()
    if (!url) {
      showToast('请输入图片 URL', 'error')
      return
    }
    setBgUploading(true)
    try {
      const resp = await fetch('/api/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: url.slice(0, 40), url }),
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
      setBgUrlInput('')
      await refreshBackgrounds()
      showToast('背景已添加', 'success')
    } catch (err) {
      showToast(err.message || '添加失败', 'error')
    } finally {
      setBgUploading(false)
    }
  }

  /** 网站背景：删除 */
  const handleDeleteBackground = async (id) => {
    if (!window.confirm('确定删除这个背景吗？')) return
    setBgDeleting(id)
    try {
      const resp = await fetch(`/api/backgrounds?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
      await refreshBackgrounds()
      showToast('背景已删除', 'success')
    } catch (err) {
      showToast(err.message || '删除失败', 'error')
    } finally {
      setBgDeleting('')
    }
  }

  // 挂载时读取服务端配置（SettingsView 保存后会写入 blog/public/site-config.json，
  // 博客端启动时读取 → 设置对博客真实生效）
  useEffect(() => {
    let cancelled = false
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.data) return
        const { profile, paths, baidu } = json.data
        setForm((prev) => ({
          ...prev,
          ...(profile && { profile: { ...prev.profile, ...profile } }),
          ...(paths && { paths: { ...prev.paths, ...paths } }),
          ...(baidu && { baidu: { ...prev.baidu, ...baidu } }),
        }))
      })
      .catch(() => {
        /* 服务端不可用时保持 localStorage 值 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** 更新 profile 字段 */
  const updateProfile = (key, value) => {
    setForm((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }))
  }

  /** 更新关于段落（数组按索引改） */
  const updateAboutParagraph = (index, value) => {
    setForm((prev) => {
      const arr = [...(prev.profile.aboutParagraphs || ['', '', ''])]
      arr[index] = value
      return { ...prev, profile: { ...prev.profile, aboutParagraphs: arr } }
    })
  }

  /** 更新特色卡片（数组按索引 + 字段改） */
  const updateFeature = (index, key, value) => {
    setForm((prev) => {
      const arr = (prev.profile.features || []).map((f) => ({ ...f }))
      if (!arr[index]) arr[index] = { title: '', desc: '' }
      arr[index][key] = value
      return { ...prev, profile: { ...prev.profile, features: arr } }
    })
  }

  /** 更新 paths 字段 */
  const updatePath = (key, value) => {
    setForm((prev) => ({ ...prev, paths: { ...prev.paths, [key]: value } }))
  }

  /** 更新 baidu 字段 */
  const updateBaidu = (key, value) => {
    setForm((prev) => ({ ...prev, baidu: { ...prev.baidu, [key]: value } }))
  }

  /** 保存全部配置：写入 admin 服务端（落盘到博客 public/site-config.json，博客端生效） */
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { profile: form.profile, paths: form.paths, baidu: form.baidu }
      const resp = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      // 本地缓存兜底（服务端不可用时仍保留表单值）
      setConfig(payload)
      showToast('站点配置已保存，刷新博客页面即可生效', 'success')
    } catch (e) {
      showToast(e.message || '保存失败，请重试', 'error')
    } finally {
      setSaving(false)
    }
  }

  /** 测试路径（前端校验非空） */
  const handleTestPath = () => {
    const { blogPath } = form.paths
    if (!blogPath.trim()) {
      showToast('博客路径不能为空', 'error')
      return
    }
    setTesting(true)
    // 占位：前端仅做格式校验。后续接入本地接口后可改为真实探测目录是否存在。
    setTimeout(() => {
      setTesting(false)
      const looksValid =
        /^[a-zA-Z]:[\\/].+/.test(blogPath) || // Windows 路径
        /^[/~].+/.test(blogPath) // Unix 路径
      if (looksValid) {
        showToast(`路径格式校验通过：${blogPath}`, 'success')
      } else {
        showToast('路径格式看起来不太对，请检查', 'info')
      }
    }, 600)
  }

  return (
    <div className="space-y-6">
      {/* 个人简介 */}
      <Section
        icon={User}
        title="个人简介"
        desc="展示在博客前端的个人信息"
        accent="from-violet-500 to-purple-500"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>昵称</FieldLabel>
            <input
              type="text"
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              placeholder="例如：芋泥椰奶"
              value={form.profile.nickname}
              onChange={(e) => updateProfile('nickname', e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>恋爱日期</FieldLabel>
            <input
              type="date"
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              value={form.profile.loveStartDate}
              onChange={(e) => updateProfile('loveStartDate', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel hint="支持外链">头像 URL</FieldLabel>
            <input
              type="text"
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              placeholder="https://example.com/avatar.png"
              value={form.profile.avatar}
              onChange={(e) => updateProfile('avatar', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>个性签名</FieldLabel>
            <textarea
              rows={3}
              className="glass-input w-full resize-none px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              placeholder="写一句甜蜜的签名吧～"
              value={form.profile.signature}
              onChange={(e) => updateProfile('signature', e.target.value)}
            />
          </div>

          {/* 关于页个人简介卡片（与「关于」页展示一一对应） */}
          <div>
            <FieldLabel hint="关于页的大标题">署名</FieldLabel>
            <input
              type="text"
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              placeholder="例如：小熊骑士 & 昕昕公主"
              value={form.profile.author}
              onChange={(e) => updateProfile('author', e.target.value)}
            />
          </div>
          <div>
            <FieldLabel hint="关于页头像下方的文字">位置文字</FieldLabel>
            <input
              type="text"
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
              placeholder="例如：在这个小小星球上的某个角落"
              value={form.profile.location}
              onChange={(e) => updateProfile('location', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>关于我们段落（3 段，每段单独编辑）</FieldLabel>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <textarea
                  key={i}
                  rows={3}
                  className="glass-input w-full resize-none px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
                  placeholder={`段落 ${i + 1}`}
                  value={form.profile.aboutParagraphs?.[i] || ''}
                  onChange={(e) => updateAboutParagraph(i, e.target.value)}
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>特色卡片（3 张：标题 + 描述）</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    className="glass-input w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-100"
                    placeholder={`卡片 ${i + 1} 标题（如：用心记录）`}
                    value={form.profile.features?.[i]?.title || ''}
                    onChange={(e) => updateFeature(i, 'title', e.target.value)}
                  />
                  <input
                    type="text"
                    className="glass-input w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-100"
                    placeholder={`卡片 ${i + 1} 描述（如：日记 · 心情 · 碎碎念）`}
                    value={form.profile.features?.[i]?.desc || ''}
                    onChange={(e) => updateFeature(i, 'desc', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 主页 Hero 图：图像 + 展示区域框选 */}
          <div className="md:col-span-2">
            <FieldLabel hint="展示在主页顶部的主题卡片">主页主题卡片图像</FieldLabel>
            <div className="flex flex-col gap-2.5">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/20 bg-slate-100 dark:bg-slate-800">
                {form.profile.coupleHero ? (
                  <div
                    className="h-full w-full bg-no-repeat"
                    style={{
                      backgroundImage: `url(${form.profile.coupleHero})`,
                      backgroundSize: form.profile.heroArea
                        ? `${(100 / form.profile.heroArea.width).toFixed(4)}% ${(100 / form.profile.heroArea.height).toFixed(4)}%`
                        : 'cover',
                      // 某维铺满（≈1）时该维位置用 0，避免除零 NaN% 使位置声明失效
                      backgroundPosition: form.profile.heroArea
                        ? `${((form.profile.heroArea.width >= 0.999 ? 0 : (form.profile.heroArea.x / (1 - form.profile.heroArea.width)) * 100)).toFixed(4)}% ${((form.profile.heroArea.height >= 0.999 ? 0 : (form.profile.heroArea.y / (1 - form.profile.heroArea.height)) * 100)).toFixed(4)}%`
                        : 'center',
                    }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                    <ImageIcon className="h-8 w-8 opacity-40" />
                    <span className="text-xs">尚未设置主页图（使用默认合照）</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="glass-input min-w-0 flex-1 px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-100"
                  placeholder="或粘贴图片 URL…"
                  value={form.profile.coupleHero || ''}
                  onChange={(e) => updateProfile('coupleHero', e.target.value)}
                />
                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHeroUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => heroFileInputRef.current?.click()}
                  disabled={heroUploading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-500/25 disabled:opacity-60 dark:text-sky-300"
                >
                  {heroUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  上传图片
                </button>
                <button
                  type="button"
                  disabled={!form.profile.coupleHero}
                  onClick={() => setHeroCropOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-500/25 disabled:opacity-50 dark:text-violet-300"
                >
                  <Crop className="h-3.5 w-3.5" />
                  {form.profile.heroArea ? '重新框选展示区域' : '框选展示区域'}
                </button>
                {form.profile.heroArea && (
                  <button
                    type="button"
                    onClick={() => updateProfile('heroArea', null)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-500/10 px-2.5 py-2 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/20"
                    title="恢复整图展示"
                  >
                    <X className="h-3.5 w-3.5" />
                    清除区域
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                用固定取景框（16:9）框选展示区域，主页卡片按相同比例渲染 —— 框选什么就显示什么，不缩放不变形
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 网站背景管理 */}
      <Section
        icon={ImageIcon}
        title="网站背景"
        desc="全站背景图：可添加多张，每次打开网站随机抽取一张；照片墙中可一键把照片设为背景"
        accent="from-pink-500 to-rose-500"
      >
        <div className="space-y-4">
          {/* 背景列表 */}
          {backgrounds.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {backgrounds.map((bg) => (
                <div
                  key={bg.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/40 bg-white/30 dark:border-white/10 dark:bg-white/5"
                >
                  <img
                    src={bg.thumbPath || bg.url}
                    alt={bg.name || '背景'}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <p className="absolute bottom-1.5 left-2 right-8 truncate text-[10px] font-medium text-white/90">
                    {bg.name || (bg.kind === 'local' ? '照片墙照片' : '背景')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDeleteBackground(bg.id)}
                    disabled={bgDeleting === bg.id}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-lg bg-black/50 text-white/80 transition-colors hover:bg-rose-500/80 hover:text-white disabled:opacity-50"
                    title="删除背景"
                  >
                    {bgDeleting === bg.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/40 px-4 py-8 text-center text-xs text-gray-400 dark:border-white/10">
              还没有背景。从照片墙把照片设为背景，或在这里上传 / 填写 URL
            </div>
          )}

          {/* 添加背景 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAddBackgroundUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bgFileInputRef.current?.click()}
              disabled={bgUploading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {bgUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              上传背景图
            </button>
            <input
              type="text"
              className="glass-input min-w-0 flex-1 px-4 py-2 text-xs text-gray-700 dark:text-gray-100"
              placeholder="或粘贴图片 URL…"
              value={bgUrlInput}
              onChange={(e) => setBgUrlInput(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddBackgroundUrl}
              disabled={bgUploading || !bgUrlInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/40 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-white/60 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              添加
            </button>
            <button
              type="button"
              onClick={refreshBackgrounds}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/40 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white/60 dark:bg-white/10 dark:text-gray-300"
              title="刷新列表"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400">
            已配置 {backgrounds.length} 张背景 · 每次打开网站随机抽取一张 · 从照片墙灯箱点「设为背景」可把照片直接加入
          </p>
        </div>
      </Section>

      {/* 主页图取景框弹窗 */}
      {heroCropOpen && form.profile.coupleHero && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
          onClick={() => setHeroCropOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/50 bg-white/85 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/85"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                框选主页主题卡片展示区域
              </h3>
              <button
                type="button"
                onClick={() => setHeroCropOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CoverAreaPicker
              src={form.profile.coupleHero}
              initialArea={form.profile.heroArea || undefined}
              targetRatio={16 / 9}
              onSave={handleSaveHeroArea}
              onClose={() => setHeroCropOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 路径配置 */}
      <Section
        icon={FolderGit2}
        title="路径配置"
        desc="博客前端工程路径与代码仓库地址"
        accent="from-emerald-500 to-teal-500"
      >
        <div className="space-y-5">
          <div>
            <FieldLabel hint="本地物理路径">博客前端路径</FieldLabel>
            <div className="flex gap-2">
              <input
                type="text"
                className="glass-input flex-1 px-4 py-2.5 font-mono text-sm text-gray-700 dark:text-gray-100"
                placeholder="f:\图片\couple-blog\blog"
                value={form.paths.blogPath}
                onChange={(e) => updatePath('blogPath', e.target.value)}
              />
              <button
                onClick={handleTestPath}
                disabled={testing}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-300"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {testing ? '测试中' : '测试路径'}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel hint="可选">GitHub 仓库远程地址</FieldLabel>
            <input
              type="text"
              className="glass-input w-full px-4 py-2.5 font-mono text-sm text-gray-700 dark:text-gray-100"
              placeholder="https://github.com/yourname/couple-blog.git"
              value={form.paths.repoUrl}
              onChange={(e) => updatePath('repoUrl', e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* 百度网盘凭证 */}
      <Section
        icon={Cloud}
        title="百度网盘凭证"
        desc="用于照片上传与云端同步"
        accent="from-sky-500 to-blue-500"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-2 rounded-2xl bg-sky-50/60 p-3 text-xs text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              凭证存放于 <code className="rounded bg-white/70 px-1 py-0.5 font-mono dark:bg-white/10">admin/.env.local</code>，
              修改后需重启开发服务器生效。Secret Key 不会在此处显示。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel hint="只读 · 脱敏">AppKey</FieldLabel>
              {credential.hasAppKey ? (
                <div className="glass-input flex items-center justify-between px-4 py-2.5">
                  <span className="truncate font-mono text-sm text-gray-700 dark:text-gray-100">
                    {credential.maskedAppKey}
                  </span>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                </div>
              ) : (
                <div className="glass-input flex items-center gap-2 px-4 py-2.5">
                  <span className="text-sm text-gray-400">未配置</span>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-gray-400">
                读取自 <code className="font-mono">VITE_BAIDU_APP_KEY</code>
              </p>
            </div>

            <div>
              <FieldLabel hint={`默认来自 env：${credential.envAppName || '未设置'}`}>
                App 名称
              </FieldLabel>
              <input
                type="text"
                className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-100"
                placeholder={credential.envAppName || '例如：芋泥椰奶'}
                value={form.baidu.appName}
                onChange={(e) => updateBaidu('appName', e.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-gray-400">
                保存至本地配置，留空则使用 env 默认值
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 保存按钮 */}
      <div className="glass-card flex items-center justify-between gap-4 rounded-3xl p-5">
        <p className="hidden text-xs text-gray-400 sm:block">
          配置将保存到浏览器 localStorage（key: yn_blog_config）
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-aurora-pink px-8 py-3 text-sm font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中…' : '保存配置'}
        </button>
      </div>
    </div>
  )
}
