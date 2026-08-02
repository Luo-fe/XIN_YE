import { useState, useEffect, useCallback } from 'react'
import { X, CloudUpload, Link2, Loader2, ImageIcon, Search } from 'lucide-react'
import { uploadThumbnail, listPhotos } from '../../api/contentApi'
import { useToast } from '../Toast'

/**
 * 浮动图床工具
 * - 上传本地图片文件（base64 → 服务端保存到 public/photos/）
 * - 粘贴图片 URL
 * - 从照片墙已有照片中选择
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} props.onInsert - (url) => void，插入图片回调
 */
export default function FloatingImageTool({ isOpen, onClose, onInsert }) {
  const { showToast } = useToast()
  const [tab, setTab] = useState('upload') // upload | url | gallery
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [galleryPage, setGalleryPage] = useState(0)
  const [search, setSearch] = useState('')
  const PAGE_SIZE = 24

  // 加载照片墙
  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true)
    try {
      const data = await listPhotos()
      setPhotos(Array.isArray(data) ? data : [])
    } catch {
      setPhotos([])
    } finally {
      setLoadingPhotos(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && tab === 'gallery' && photos.length === 0) {
      loadPhotos()
    }
  }, [isOpen, tab, photos.length, loadPhotos])

  // 上传本地文件
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const filename = `editor_${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
      const result = await uploadThumbnail(filename, dataUrl)
      const url = result.url || result.path || `/photos/${filename}`
      onInsert(url)
      showToast('图片已插入', 'success')
      onClose()
    } catch (err) {
      showToast(err.message || '上传失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  // 插入 URL
  const handleInsertUrl = () => {
    const url = urlInput.trim()
    if (!url) {
      showToast('请输入图片 URL', 'error')
      return
    }
    onInsert(url)
    setUrlInput('')
    onClose()
  }

  if (!isOpen) return null

  // 过滤照片墙
  const filtered = search
    ? photos.filter((p) => {
        const fn = (p.filename || p.thumbPath || '').toLowerCase()
        return fn.includes(search.toLowerCase())
      })
    : photos
  const paged = filtered.slice(0, (galleryPage + 1) * PAGE_SIZE)

  return (
    <>
      <div
        className="fixed inset-0 z-[9990] bg-slate-900/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[9999] flex max-h-[85vh] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[32px] border border-white/50 bg-white/80 shadow-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80">
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/20 px-6 py-4 dark:border-white/10">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-white">
            <ImageIcon size={16} className="text-indigo-500" />
            图片工具
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex shrink-0 gap-1 border-b border-white/20 px-4 py-2 dark:border-white/10">
          {[
            { id: 'upload', label: '上传图片', icon: CloudUpload },
            { id: 'url', label: '粘贴 URL', icon: Link2 },
            { id: 'gallery', label: '从照片墙选', icon: ImageIcon },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                tab === t.id
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-700/50'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {/* 上传 */}
          {tab === 'upload' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[32px] border-2 border-dashed border-white/20 bg-black/5 px-6 py-12 shadow-inner transition-all hover:border-indigo-400 hover:bg-indigo-50/30 dark:bg-white/5 dark:hover:border-indigo-500/50">
                {uploading ? (
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                ) : (
                  <CloudUpload size={32} className="text-slate-400" />
                )}
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {uploading ? '上传中...' : '点击选择图片'}
                </span>
                <span className="text-[11px] text-slate-400">支持 JPG / PNG / GIF / WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          )}

          {/* URL */}
          {tab === 'url' && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInsertUrl()}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-2xl border border-white/20 bg-white/50 px-5 py-3 text-sm text-slate-800 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
              <button
                onClick={handleInsertUrl}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-600 active:scale-95"
              >
                <Link2 size={14} />
                插入图片
              </button>
            </div>
          )}

          {/* 照片墙 */}
          {tab === 'gallery' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setGalleryPage(0)
                  }}
                  placeholder="搜索文件名..."
                  className="w-full rounded-xl border border-white/20 bg-white/50 py-2 pl-9 pr-3 text-xs text-slate-700 shadow-inner outline-none transition-all focus:border-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                />
              </div>
              {loadingPhotos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                </div>
              ) : paged.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {paged.map((p) => {
                      const url = p.thumbPath || p.url || ''
                      if (!url) return null
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onInsert(url)
                            onClose()
                          }}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-white/20 transition-all hover:scale-105 hover:border-indigo-400 hover:shadow-lg dark:border-white/10"
                        >
                          <img
                            src={url}
                            alt={p.filename || ''}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-indigo-500/0 transition-colors group-hover:bg-indigo-500/20" />
                        </button>
                      )
                    })}
                  </div>
                  {paged.length < filtered.length && (
                    <button
                      onClick={() => setGalleryPage((p) => p + 1)}
                      className="mt-2 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      加载更多 ({filtered.length - paged.length} 张)
                    </button>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  {photos.length === 0 ? '照片墙暂无照片' : '未找到匹配照片'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
