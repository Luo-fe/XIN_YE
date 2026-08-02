import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus,
  Pencil,
  RefreshCw,
  Loader2,
  X,
  Save,
  FileText,
  Inbox,
  Trash2,
  CloudUpload,
  Clock,
  FileText as FileTextIcon,
  ImagePlus,
  Crop,
  Images,
  Upload,
  Link2,
  Check,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { listDiaries, readDiary, saveDiary, deleteDiary } from '../api/contentApi'
import RichTextEditor from '../components/editor/RichTextEditor'
import FloatingImageTool from '../components/editor/FloatingImageTool'
import CoverAreaPicker from '../components/CoverAreaPicker'

export default function DiaryManageView() {
  const { showToast } = useToast()
  const [files, setFiles] = useState([]) // 日记列表
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null) // 编辑中的日记对象

  /** 刷新日记列表 */
  const refreshList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDiaries()
      setFiles(data)
    } catch (e) {
      showToast(e.message || '读取日记列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  /** 打开已有日记进行编辑 */
  const handleOpen = async (filename) => {
    setLoading(true)
    try {
      const data = await readDiary(filename)
      setEditing(data)
    } catch (e) {
      showToast(e.message || '读取日记失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  /** 新建日记 */
  const handleNew = () => {
    const today = new Date().toISOString().slice(0, 10)
    setEditing({
      filename: '',
      date: today,
      title: '',
      cover: '',
      summary: '',
      body: '',
    })
  }

  /** 保存日记 */
  const handleSave = async (form) => {
    if (!form.title.trim()) {
      showToast('请填写标题', 'error')
      return
    }
    setLoading(true)
    try {
      const result = await saveDiary({
        filename: form.filename || '',
        title: form.title,
        date: form.date,
        cover: form.cover,
        summary: form.summary,
        content: form.body || '',
      })
      showToast(`已保存：${result.filename}`, 'success')
      setEditing(null)
      await refreshList()
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  /** 删除日记 */
  const handleDelete = async (filename) => {
    if (!window.confirm(`确定要删除「${filename}」吗？`)) return
    try {
      await deleteDiary(filename)
      showToast('已删除', 'success')
      await refreshList()
    } catch (e) {
      showToast(e.message || '删除失败', 'error')
    }
  }

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">日记管理</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {files.length} 篇日记 · 直接读写博客数据目录
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refreshList}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-2xl bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-600 transition-all hover:bg-sky-500/25 active:scale-95 disabled:opacity-60 dark:text-sky-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新列表
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-primary to-aurora-pink px-4 py-2.5 text-xs font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            写日记
          </button>
        </div>
      </div>

      {/* 日记列表 */}
      {files.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {files.map((f) => (
            <div
              key={f.filename}
              className="glass-card group flex items-start gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5"
            >
              <button
                onClick={() => handleOpen(f.filename)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-violet-500/15 to-purple-500/15 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-700 group-hover:text-primary dark:text-gray-200">
                    {f.title || f.filename.replace(/\.md$/, '')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {f.date || f.filename.replace(/\.md$/, '')}
                  </p>
                  {f.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                      {f.summary}
                    </p>
                  )}
                </div>
                <Pencil className="h-4 w-4 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <button
                onClick={() => handleDelete(f.filename)}
                className="shrink-0 rounded-lg bg-white/60 p-1.5 text-gray-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:bg-white/10 dark:text-gray-300 opacity-60 group-hover:opacity-100"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center rounded-3xl p-10 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-tr from-primary/15 to-aurora-pink/15">
            <Inbox className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {loading ? '加载中…' : '暂无日记'}
          </p>
          <p className="mt-1 text-xs text-gray-400">点击右上角「写日记」开始记录</p>
        </div>
      )}

      {/* 编辑器 */}
      {editing && (
        <DiaryEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          loading={loading}
        />
      )}
    </div>
  )
}

/**
 * 日记编辑器：双栏布局（左富文本 + 右元数据面板）
 */
function DiaryEditor({ initial, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    filename: initial.filename || '',
    date: initial.date || '',
    title: initial.title || '',
    cover: initial.cover || '',
    summary: initial.summary || '',
    body: initial.body || '',
  })
  const editorRef = useRef(null)
  const [imgToolOpen, setImgToolOpen] = useState(false)
  const [imgToolTarget, setImgToolTarget] = useState('editor')

  // ===== 封面配置（上传 / 图库抽取 / 展示区域，与博客端 useDiaryCovers 同源）=====
  const slug = (initial.filename || '').replace(/\.md$/, '')
  const [coverCfg, setCoverCfg] = useState({ uploaded: '', picked: null, area: null })
  const [coverTab, setCoverTab] = useState('gallery') // gallery | upload | url
  const [photoOptions, setPhotoOptions] = useState([])
  const [photoLoading, setPhotoLoading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverAreaOpen, setCoverAreaOpen] = useState(false)
  const coverInputRef = useRef(null)

  // 加载该日记已有的封面配置（上传封面 / 图库抽取 / 展示区域）
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    Promise.all([
      fetch(`/api/diary-covers?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
      fetch('/api/diary-photo-covers').then((r) => r.json()),
      fetch('/api/diary-cover-areas').then((r) => r.json()),
    ])
      .then(([up, pk, ar]) => {
        if (cancelled) return
        setCoverCfg({
          uploaded: (up?.data && up.data.cover) || '',
          picked: (pk?.data && pk.data[slug]) || null,
          area: (ar?.data && ar.data[slug]) || null,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  // 按日记日期自动加载当天拍摄的照片（图库匹配候选）
  useEffect(() => {
    if (!form.date) {
      setPhotoOptions([])
      return
    }
    let cancelled = false
    setPhotoLoading(true)
    fetch(`/api/diary-photo-options?date=${encodeURIComponent(form.date)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setPhotoOptions(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => {
        if (!cancelled) setPhotoOptions([])
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [form.date])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    const finalForm = { ...form }
    if (editorRef.current) {
      finalForm.body = editorRef.current.getContent()
    }
    onSave(finalForm)
  }

  // ===== 封面操作 =====
  // 当前生效封面：上传 > 图库抽取 > frontmatter URL
  // 上传封面是相对路径（diary-covers/xxx.jpg），需规范化为根路径，
  // 否则在子路由页面下按相对路径解析导致封面不显示
  const normalizeCoverUrl = (u) =>
    !u ? '' : /^https?:\/\//.test(u) || u.startsWith('/') ? u : '/' + u.replace(/^[/\\]+/, '')
  const currentCover = coverCfg.uploaded
    ? normalizeCoverUrl(coverCfg.uploaded)
    : coverCfg.picked
      ? coverCfg.picked.url || coverCfg.picked.thumbPath || ''
      : form.cover || ''
  const isUploaded = !!coverCfg.uploaded
  const isPicked = !!coverCfg.picked
  // 旧自由比例区域 → 16:9 归一化（与博客列表页/详情页展示完全一致）
  const displayArea = normalizeArea16x9(coverCfg.area)
  // 当前封面图宽高比：cover 等比渲染需要（否则 0.75 竖图会被横向拉伸）
  const [coverImgRatio, setCoverImgRatio] = useState(null)
  useEffect(() => {
    if (!currentCover) {
      setCoverImgRatio(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null
      setCoverImgRatio(r)
    }
    img.onerror = () => setCoverImgRatio(null)
    img.src = currentCover
  }, [currentCover])
  const coverStyle = coverStyleOf(displayArea, coverImgRatio)
  // 封面容器统一 16:9
  const coverRatio = 16 / 9

  // 从当日图库中选用一张照片作为封面（持久化到 diary-photo-covers.json）
  const handlePickPhoto = async (photo) => {
    if (!slug) return
    try {
      const resp = await fetch('/api/diary-photo-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, photoId: photo.id, url: photo.url, thumbPath: photo.thumbPath }),
      })
      const json = await resp.json()
      if (json.data) setCoverCfg((prev) => ({ ...prev, picked: json.data }))
      else showToast(json.error || '选用失败', 'error')
    } catch {
      showToast('选用失败', 'error')
    }
  }

  // 上传自定义封面（持久化到 diary-covers.json）
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file || !slug) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('图片不能超过 8MB', 'error')
      return
    }
    setCoverUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/diary-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, dataUrl }),
      })
      const json = await resp.json()
      if (json.data && json.data.cover) {
        setCoverCfg((prev) => ({ ...prev, uploaded: json.data.cover }))
      } else {
        showToast(json.error || '上传失败', 'error')
      }
    } catch {
      showToast('上传失败', 'error')
    } finally {
      setCoverUploading(false)
    }
  }

  // 移除上传的自定义封面
  const handleRemoveUploaded = async () => {
    if (!slug) return
    try {
      const resp = await fetch(`/api/diary-cover?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) setCoverCfg((prev) => ({ ...prev, uploaded: '' }))
      else showToast(json.error || '移除失败', 'error')
    } catch {
      showToast('移除失败', 'error')
    }
  }

  // 恢复默认封面（清除图库抽取，回到按日期 seed 自动匹配）
  const handleResetPicked = async () => {
    if (!slug) return
    try {
      const resp = await fetch(`/api/diary-photo-cover?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) setCoverCfg((prev) => ({ ...prev, picked: null }))
      else showToast(json.error || '恢复失败', 'error')
    } catch {
      showToast('恢复失败', 'error')
    }
  }

  // 保存取景区域（固定 16:9 取景框）
  const handleSaveArea = async (area) => {
    if (!slug) return
    try {
      const resp = await fetch('/api/diary-cover-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, area }),
      })
      const json = await resp.json()
      if (json.data) {
        setCoverCfg((prev) => ({ ...prev, area: json.data }))
        setCoverAreaOpen(false)
        showToast('展示区域已保存', 'success')
      } else {
        showToast(json.error || '保存失败', 'error')
      }
    } catch {
      showToast('保存失败', 'error')
    }
  }

  // 清除取景区域，回到默认展示
  const handleResetArea = async () => {
    if (!slug) return
    try {
      const resp = await fetch(`/api/diary-cover-area?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      const json = await resp.json()
      if (json.ok) setCoverCfg((prev) => ({ ...prev, area: null }))
      else showToast(json.error || '清除失败', 'error')
    } catch {
      showToast('清除失败', 'error')
    }
  }

  const Label = ({ icon: Icon, text, color }) => (
    <div className={`mb-2 flex items-center gap-2 border-l-4 ${color || 'border-indigo-500'} pl-3`}>
      <Icon size={12} className="text-slate-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
        {text}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // 输入框内按回车不再误触发提交（否则在标题/日期/颜色输入框按回车会直接保存并关闭）
          if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
            e.preventDefault()
          }
        }}
        className="flex max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[40px] border border-white/50 bg-white/80 shadow-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80"
      >
        {/* 左侧：富文本编辑器 */}
        <section className="flex h-[80vh] min-w-0 flex-1 flex-col overflow-hidden rounded-[40px] border border-white/30 bg-white/30 dark:border-white/10 dark:bg-slate-800/40">
          <RichTextEditor
            ref={editorRef}
            title={form.title}
            setTitle={(v) => update('title', v)}
            initialContent={form.body}
            onOpenImageTool={() => {
              setImgToolTarget('editor')
              setImgToolOpen(true)
            }}
          />
        </section>

        {/* 右侧：元数据面板 */}
        <aside className="flex h-[80vh] w-[360px] shrink-0 flex-col overflow-hidden border-l border-white/30 bg-white/30 dark:border-white/10 dark:bg-slate-800/40">
          {/* 头部 */}
          <div className="shrink-0 border-b border-white/20 bg-white/5 px-6 pb-4 pt-7 dark:bg-black/20">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">
              {initial.filename ? 'Edit Diary' : 'New Diary'}
            </span>
            <h2 className="mt-1 text-lg font-black text-slate-800 dark:text-white">属性设置</h2>
          </div>

          {/* 字段区 */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-6">
              {/* 日期 */}
              <div>
                <Label icon={Clock} text="Date" color="border-sky-500" />
                <input
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-xs text-slate-800 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-black/20 dark:text-slate-200"
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                />
              </div>

              {/* 封面图 */}
              <div>
                <Label icon={CloudUpload} text="Cover Image" color="border-indigo-500" />

                {/* 封面预览：与博客列表页/详情页同比例同取景（所见即所得） */}
                <div
                  className="relative mb-3 w-full overflow-hidden rounded-[32px] border-2 border-white/10 bg-black/10 shadow-inner dark:bg-black/40"
                  style={{ aspectRatio: coverRatio }}
                >
                  {currentCover ? (
                    <>
                      <div
                        className="h-full w-full bg-no-repeat"
                        style={{
                          backgroundImage: `url(${currentCover})`,
                          backgroundSize: coverStyle.backgroundSize,
                          backgroundPosition: coverStyle.backgroundPosition,
                        }}
                        role="img"
                        aria-label="封面"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </>
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <ImagePlus size={26} className="opacity-40" />
                        <span className="text-[9px] font-black uppercase tracking-widest">暂无封面</span>
                      </div>
                    </div>
                  )}

                  {/* 来源标记 */}
                  {isUploaded && (
                    <span className="absolute left-2 top-2 rounded-md bg-indigo-500/70 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                      自定义
                    </span>
                  )}
                  {!isUploaded && isPicked && (
                    <span className="absolute left-2 top-2 rounded-md bg-sky-500/70 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                      图库
                    </span>
                  )}

                  {/* 封面操作按钮 */}
                  {currentCover && (
                    <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCoverAreaOpen(true)}
                        title="调整封面展示区域（固定 16:9 取景框）"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/30 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
                      >
                        <Crop size={14} />
                      </button>
                      {isUploaded && (
                        <button
                          type="button"
                          onClick={handleRemoveUploaded}
                          title="移除自定义封面"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-300/40 bg-rose-500/50 text-white backdrop-blur-md transition-colors hover:bg-rose-500/70"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {!isUploaded && isPicked && (
                        <button
                          type="button"
                          onClick={handleResetPicked}
                          title="恢复默认封面（按日期自动匹配）"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-300/40 bg-rose-500/50 text-white backdrop-blur-md transition-colors hover:bg-rose-500/70"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 来源切换：图库匹配 / 上传 / URL */}
                <div className="mb-2 flex gap-1.5">
                  {[
                    { key: 'gallery', icon: Images, label: '图库匹配' },
                    { key: 'upload', icon: Upload, label: '上传' },
                    { key: 'url', icon: Link2, label: 'URL' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCoverTab(key)}
                      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[10px] font-bold transition-all ${
                        coverTab === key
                          ? 'border-indigo-400 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                          : 'border-white/10 bg-white/10 text-slate-500 hover:border-indigo-300 dark:text-slate-400'
                      }`}
                    >
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                </div>

                {/* 图库匹配：按日记日期自动列出当天拍摄的照片 */}
                {coverTab === 'gallery' && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 dark:bg-black/20">
                    <p className="mb-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {form.date
                        ? `自动匹配 ${form.date} 当天拍摄的照片，点击选用为封面：`
                        : '请先填写日期，将自动匹配当天照片。'}
                    </p>
                    {photoLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                        <Loader2 size={16} className="animate-spin" /> 加载照片中...
                      </div>
                    ) : photoOptions.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-5 text-slate-400">
                        <Inbox size={18} className="opacity-50" />
                        <span className="text-[10px]">当天暂无照片，可切换「上传」自定义封面</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {photoOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePickPhoto(p)}
                            title={p.filename}
                            className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                              isPicked && coverCfg.picked && coverCfg.picked.photoId === p.id
                                ? 'border-indigo-500 ring-2 ring-indigo-400/50'
                                : 'border-transparent hover:border-indigo-300'
                            }`}
                          >
                            <img
                              src={p.thumbPath}
                              alt={p.filename}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {isPicked && coverCfg.picked && coverCfg.picked.photoId === p.id && (
                              <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-indigo-500 text-white">
                                <Check size={10} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 上传自定义封面 */}
                {coverTab === 'upload' && (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 py-5 text-slate-400 transition-all hover:border-indigo-400 hover:text-indigo-400 disabled:opacity-50 dark:bg-black/20"
                  >
                    {coverUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    <span className="text-[10px] font-bold">
                      {coverUploading ? '上传中...' : '点击上传自定义封面'}
                    </span>
                    <span className="text-[9px] opacity-70">支持 JPG / PNG / WebP，≤ 8MB</span>
                  </button>
                )}

                {/* URL 输入（写入日记 frontmatter cover） */}
                {coverTab === 'url' && (
                  <input
                    type="text"
                    value={form.cover}
                    onChange={(e) => update('cover', e.target.value)}
                    placeholder="手动粘贴封面图片 URL..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-xs text-slate-800 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-black/20 dark:text-slate-200"
                  />
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </div>

              {/* 摘要 */}
              <div>
                <Label icon={FileTextIcon} text="Description" color="border-emerald-500" />
                <textarea
                  rows={5}
                  className="w-full resize-none rounded-[32px] border border-white/10 bg-black/5 px-6 py-5 text-xs leading-relaxed text-slate-800 shadow-inner outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:bg-white/5 dark:text-slate-200"
                  placeholder="记录一下这篇日记的核心思绪..."
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                />
                <p className="mt-2 px-1 text-[9px] italic text-slate-400">
                  摘要将显示在首页卡片和搜索预览中
                </p>
              </div>
            </div>
          </div>

          {/* 底部保存按钮 */}
          <div className="shrink-0 border-t border-white/20 bg-white/5 px-6 py-5 backdrop-blur-md dark:bg-black/20">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <Clock size={12} />
              {loading ? '正在落盘至本地系统...' : '文档尚未保存'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-white/30 active:scale-95 dark:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-indigo-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存日记
              </button>
            </div>
          </div>
        </aside>
      </form>

      {/* 浮动图床工具 */}
      <FloatingImageTool
        isOpen={imgToolOpen}
        onClose={() => setImgToolOpen(false)}
        onInsert={(url) => {
          if (imgToolTarget === 'editor' && editorRef.current) {
            editorRef.current.insertImage(url)
            // 如果封面为空，顺便当封面
            if (!form.cover) update('cover', url)
          }
        }}
      />

      {/* 封面取景框（固定 16:9，与博客列表页/详情页展示一致） */}
      {coverAreaOpen && currentCover && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setCoverAreaOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/50 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">调整封面展示区域</h3>
            <CoverAreaPicker
              src={currentCover}
              initialArea={displayArea}
              onSave={handleSaveArea}
              onReset={coverCfg.area ? handleResetArea : undefined}
              onClose={() => setCoverAreaOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 把任意比例的取景区域（0-1）归一化为 16:9 等效区域（cover 语义）
 * 与博客端 useDiaryCovers.normalizeArea16x9 保持一致：
 * 宽型区域宽度不变、高度按 16:9 扩展；窄型区域高度不变、宽度按 16:9 扩展；
 * 超界回退宽度铺满；中心对齐 + clamp。旧取景内容不裁剪、不拉伸。
 */
function normalizeArea16x9(area) {
  if (!area || !area.width || !area.height) return null
  const { x, y, width, height } = area
  let nw = width
  let nh = height
  if (width / height > 16 / 9) {
    nh = (width * 9) / 16
  } else if (width / height < 16 / 9) {
    nw = (height * 16) / 9
    if (nw > 1) {
      nw = 1
      nh = 9 / 16
    }
  }
  const cx = x + width / 2
  const cy = y + height / 2
  const nx = Math.max(0, Math.min(1 - nw, cx - nw / 2))
  const ny = Math.max(0, Math.min(1 - nh, cy - nh / 2))
  return { x: nx, y: ny, width: nw, height: nh }
}

/**
 * 根据取景区域（0-1 比例）计算封面背景展示样式
 * 与博客端 useDiaryCovers.computeCoverStyle 保持一致：
 * 知道原图比例时用 cover 等比渲染（区域按原比例放大铺满 16:9 容器，不拉伸变形，
 * 0.75 手机竖图不会被横向拉宽）；比例未知（图未加载）时回退旧 sprite 公式。
 */
function coverStyleOf(area, imgRatio) {
  if (!area || !area.width || !area.height) {
    return { backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const { x, y, width, height } = area
  if (width >= 0.999 && height >= 0.999) {
    return { backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (imgRatio && imgRatio > 0) {
    const C = 16 / 9
    const rw = Math.max(1 / width, imgRatio / (C * height))
    const rh = (rw * C) / imgRatio
    return {
      backgroundSize: `${(rw * 100).toFixed(4)}% ${(rh * 100).toFixed(4)}%`,
      backgroundPosition: `${(
        rw > 1 + 1e-6 ? ((-x * rw) / (1 - rw)) * 100 : 0
      ).toFixed(4)}% ${(rh > 1 + 1e-6 ? ((-y * rh) / (1 - rh)) * 100 : 0).toFixed(4)}%`,
    }
  }
  // 某一维铺满（宽或高 ≈ 1）时该维位置无意义，必须用 0，避免除零产生 NaN%
  const px = width >= 0.999 ? 0 : (x / (1 - width)) * 100
  const py = height >= 0.999 ? 0 : (y / (1 - height)) * 100
  return {
    backgroundSize: `${(100 / width).toFixed(4)}% ${(100 / height).toFixed(4)}%`,
    backgroundPosition: `${px.toFixed(4)}% ${py.toFixed(4)}%`,
  }
}
