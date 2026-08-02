import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Clock,
  MapPin,
  Globe,
  Cloud,
  Sun,
  Heart,
  ImageIcon,
  Pencil,
  Download,
  Trash2,
  CheckSquare,
  Square,
  CheckCheck,
  X,
  RotateCcw,
} from 'lucide-react'
import clsx from 'clsx'
import { GlassCard, Skeleton } from '../components/ui'
import { toast } from '../components/ui/Toast'
import { useLocalPhotos, getLocalManifest } from '../hooks/usePhotos'
import {
  loadPhotoEdits,
  clearAllPhotoEdits,
  mergePhotoWithEdit,
} from '../utils/photoCache'
import TimeView from '../components/photowall/TimeView'
import LocationView from '../components/photowall/LocationView'
import Map3DView from '../components/photowall/Map3DView'
import MemoriesView from '../components/photowall/MemoriesView'
import BaiduAlbumsView from '../components/photowall/BaiduAlbumsView'
import Lightbox from '../components/photowall/Lightbox'

// 顶层两大类：流年四季在前、网盘照片在后
const TOP_TABS = [
  { key: 'seasons', name: '流年四季', icon: Sun },
  { key: 'baidu', name: '网盘照片', icon: Cloud },
]

// 流年四季子视图
const SEASON_TABS = [
  { key: 'time', name: '时间视图', icon: Clock },
  { key: 'location', name: '地点视图', icon: MapPin },
  { key: 'map', name: '地图视图', icon: Globe },
  { key: 'memories', name: '往昔回忆', icon: Heart },
]

export default function PhotoWall() {
  const {
    seasons,
    memories,
    loading,
    updatePhoto,
    resetPhoto,
    deletePhotos,
    restoreAllDeleted,
    editedCount,
    deletedCount,
  } = useLocalPhotos()
  const [topTab, setTopTab] = useState('seasons')
  const [seasonTab, setSeasonTab] = useState('time')
  const [lightbox, setLightbox] = useState({ list: [], index: -1 })

  // 批量管理模式
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // 当前流年四季子视图所用的照片列表（往昔回忆用 memories，其余用 seasons）
  const activeSeasonPhotos = seasonTab === 'memories' ? memories : seasons

  // 时间视图当前选中的月份 key（TimeView 回调同步；用于"全选"限定在当前月份，
  // 避免误以为只选当前视图实际全站几千张照片被选中删除）
  const [activeMonthKey, setActiveMonthKey] = useState('')
  const handleActiveMonthChange = useCallback((key) => setActiveMonthKey(key), [])

  // 实时月份计数（流年四季 + 往昔回忆合并）：照片删除/编辑后侧栏目录数量自动同步，
  // 不再依赖打包进 JS 的静态 photo-time-index.json（该索引不会随删除更新）
  const monthCounts = useMemo(() => {
    const counts = {}
    for (const p of seasons) {
      const key = (p.dateTime || '').slice(0, 7)
      if (key) counts[key] = (counts[key] || 0) + 1
    }
    for (const p of memories) {
      const key = (p.dateTime || '').slice(0, 7)
      if (key) counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [seasons, memories])

  const openLightbox = useCallback(
    (list, index) => {
      if (manageMode) return // 管理模式下不打开灯箱
      setLightbox({ list, index })
    },
    [manageMode],
  )
  const closeLightbox = useCallback(() => setLightbox((s) => ({ ...s, index: -1 })), [])
  const setIndex = useCallback((i) => setLightbox((s) => ({ ...s, index: i })), [])

  // 切换选择
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 全选当前视图：时间视图限定在当前月份（不选其他月份的照片，防止误删）
  const selectAll = useCallback(() => {
    if (seasonTab === 'time') {
      const scope = activeMonthKey
        ? seasons.filter((p) => (p.dateTime || '').startsWith(activeMonthKey))
        : []
      setSelectedIds(new Set(scope.map((p) => p.id)))
      if (scope.length === 0) toast.info('当前月份没有可选照片')
      return
    }
    setSelectedIds(new Set(activeSeasonPhotos.map((p) => p.id)))
  }, [seasonTab, activeMonthKey, seasons, activeSeasonPhotos])

  // 取消全选
  const deselectAll = useCallback(() => setSelectedIds(new Set()), [])

  // 退出管理模式
  const exitManageMode = useCallback(() => {
    setManageMode(false)
    setSelectedIds(new Set())
  }, [])

  // 批量删除选中照片（物理删除：删除缩略图文件 + manifest 记录）
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.info('请先选择要删除的照片')
      return
    }
    if (
      !window.confirm(
        `确定删除选中的 ${selectedIds.size} 张照片吗？\n\n此操作将永久删除照片的缩略图文件和数据记录，无法恢复！`,
      )
    )
      return
    const count = selectedIds.size
    const ok = await deletePhotos([...selectedIds])
    if (ok) {
      toast.success(`已删除 ${count} 张照片`)
    } else {
      toast.error('删除失败：admin 服务未连接或服务端错误，删除未生效')
    }
    setSelectedIds(new Set())
  }, [selectedIds, deletePhotos])

  // 灯箱列表可能是 seasons / memories / 城市子集，编辑后需同步更新灯箱内的照片对象
  const handleUpdatePhoto = useCallback(
    (id, patch) => {
      updatePhoto?.(id, patch)
      setLightbox((s) => {
        if (!s.list || s.index < 0) return s
        const nextList = s.list.map((p) => (p.id === id ? { ...p, ...patch } : p))
        return { ...s, list: nextList }
      })
      toast.success('已保存到本地缓存')
    },
    [updatePhoto],
  )

  const handleResetPhoto = useCallback(
    (id) => {
      resetPhoto?.(id)
      setLightbox((s) => {
        if (!s.list || s.index < 0) return s
        const original = getLocalManifest().find((m) => m.id === id)
        if (!original) return s
        const nextList = s.list.map((p) =>
          p.id === id ? { ...p, ...original, location: original.location, gps: original.gps } : p,
        )
        return { ...s, list: nextList }
      })
      toast.info('已恢复为原始值')
    },
    [resetPhoto],
  )

  // 导出合并编辑后的完整 manifest（用户可手动覆盖 src/data/local-photos-manifest.json）
  const handleExportEdits = useCallback(() => {
    const edits = loadPhotoEdits()
    const editCount = Object.keys(edits).length
    if (editCount === 0) {
      toast.info('暂无编辑可导出')
      return
    }
    const source = getLocalManifest()
    const merged = source.map((item) => mergePhotoWithEdit(item, edits[item.id]))
    const content = JSON.stringify(merged, null, 2) + '\n'
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'local-photos-manifest.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`已导出 ${editCount} 张照片的编辑结果`)
  }, [])

  const handleClearAllEdits = useCallback(() => {
    if (editedCount === 0) return
    if (!window.confirm(`确定清空全部 ${editedCount} 张照片的本地编辑吗？此操作不可撤销。`)) return
    clearAllPhotoEdits()
    window.location.reload()
  }, [editedCount])

  const switchTopTab = useCallback((next) => {
    setTopTab(next)
  }, [])

  const switchSeasonTab = useCallback((next) => {
    setSeasonTab(next)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
            <Camera className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">
              光影画廊
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              用快门收藏每一个定格的瞬间
              {!loading && seasons.length > 0 && (
                <span className="ml-2 rounded-full border border-white/40 bg-white/40 px-2 py-0.5 text-xs font-medium text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                  流年四季 {seasons.length.toLocaleString()} 张 · 往昔回忆 {memories.length.toLocaleString()} 张
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 已删除照片：可一键恢复（本地删除记录兜底，防止 admin 未连接时误删无法挽回） */}
        {deletedCount > 0 && (
          <button
            type="button"
            onClick={restoreAllDeleted}
            title="恢复所有已删除的照片（仅本地记录；服务端已物理删除的文件无法恢复）"
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-1.5 text-xs backdrop-blur-md transition-colors hover:bg-rose-500/20 dark:border-rose-300/20 dark:bg-rose-500/15"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-500 dark:text-rose-300" />
            <span className="font-medium text-rose-600 dark:text-rose-300">
              已删除 {deletedCount} 张 · 恢复
            </span>
          </button>
        )}

        {/* 编辑工具条：有编辑时显示导出/清空按钮 */}
        {editedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-1.5 text-xs backdrop-blur-md dark:border-amber-300/20 dark:bg-amber-500/15">
            <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            <span className="font-medium text-amber-700 dark:text-amber-200">
              已本地编辑 {editedCount} 张
            </span>
            <button
              type="button"
              onClick={handleExportEdits}
              title="导出合并后的 manifest 文件，覆盖到博客 src/data/local-photos-manifest.json 即可永久生效"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300/50 bg-white/40 px-2 py-0.5 font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:border-amber-300/30 dark:bg-white/10 dark:text-amber-200"
            >
              <Download className="h-3 w-3" />
              导出
            </button>
            <button
              type="button"
              onClick={handleClearAllEdits}
              title="清空所有本地编辑，恢复 manifest 原始数据"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300/50 bg-white/40 px-2 py-0.5 font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:border-rose-300/30 dark:bg-white/10 dark:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              清空
            </button>
          </div>
        )}
      </header>

      {/* 顶层 Tab：网盘照片 | 流年四季 */}
      <div className="flex flex-wrap gap-2">
        {TOP_TABS.map((t) => {
          const active = topTab === t.key
          const Icon = t.icon
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTopTab(t.key)}
              className={clsx(
                'relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur-md transition-colors',
                active
                  ? 'border-primary/40 bg-primary/20 text-primary-dark dark:text-white'
                  : 'border-white/40 bg-white/40 text-slate-600 hover:bg-white/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.name}
              {active && (
                <motion.span
                  layoutId="photowall-top-tab-dot"
                  className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 内容区 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={topTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-5"
        >
          {topTab === 'baidu' && <BaiduAlbumsView onPhotoClick={openLightbox} />}

          {topTab === 'seasons' && (
            <>
              {/* 流年四季子 Tab */}
              <div className="flex flex-wrap items-center gap-2">
                {SEASON_TABS.map((t) => {
                  const active = seasonTab === t.key
                  const Icon = t.icon
                  const count =
                    t.key === 'memories' ? memories.length : seasons.length
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => switchSeasonTab(t.key)}
                      className={clsx(
                        'relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/20 text-primary-dark dark:text-white'
                          : 'border-white/40 bg-white/40 text-slate-600 hover:bg-white/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.name}
                      {count > 0 && (
                        <span className="ml-0.5 text-[10px] opacity-70">{count.toLocaleString()}</span>
                      )}
                    </button>
                  )
                })}

                {/* 管理按钮：时间/地点/往昔回忆视图可用，地图视图不适用 */}
                {seasonTab !== 'map' && (
                  <button
                    type="button"
                    onClick={() => (manageMode ? exitManageMode() : setManageMode(true))}
                    className={clsx(
                      'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors',
                      manageMode
                        ? 'border-rose-400/50 bg-rose-500/20 text-rose-600 dark:text-rose-300'
                        : 'border-white/40 bg-white/40 text-slate-600 hover:bg-white/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20',
                    )}
                  >
                    {manageMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    {manageMode ? '退出管理' : '批量管理'}
                  </button>
                )}
              </div>

              {loading && seasonTab !== 'time' ? (
                <LoadingState />
              ) : activeSeasonPhotos.length === 0 && seasonTab !== 'memories' && !loading ? (
                <EmptyState />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={seasonTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {seasonTab === 'time' && (
                      <TimeView
                        photos={seasons}
                        loading={loading}
                        monthCounts={monthCounts}
                        onPhotoClick={openLightbox}
                        manageMode={manageMode}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onActiveKeyChange={handleActiveMonthChange}
                      />
                    )}
                    {seasonTab === 'location' && (
                      <LocationView
                        photos={activeSeasonPhotos}
                        onPhotoClick={openLightbox}
                        manageMode={manageMode}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                      />
                    )}
                    {seasonTab === 'map' && (
                      <Map3DView allPhotos={seasons} onPhotoClick={openLightbox} />
                    )}
                    {seasonTab === 'memories' && (
                      <MemoriesView
                        photos={memories}
                        onPhotoClick={openLightbox}
                        manageMode={manageMode}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <Lightbox
        photos={lightbox.list}
        index={lightbox.index}
        onClose={closeLightbox}
        onIndexChange={setIndex}
        onUpdatePhoto={handleUpdatePhoto}
        onResetPhoto={handleResetPhoto}
        editable={topTab === 'seasons'}
      />

      {/* 批量管理浮动工具条 */}
      <AnimatePresence>
        {manageMode && topTab === 'seasons' && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/85"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              已选 {selectedIds.size} 张
            </span>
            <div className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
            <button
              type="button"
              onClick={selectAll}
              className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              title="全选当前视图照片"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全选
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
            >
              <Square className="h-3.5 w-3.5" />
              取消
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              className={clsx(
                'inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition-all',
                selectedIds.size > 0
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg hover:-translate-y-0.5'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-500',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
            <button
              type="button"
              onClick={exitManageMode}
              className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
              完成
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton height={28} width={180} />
      <div className="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={160 + (i % 3) * 40} rounded="rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-aurora-pink/30 text-primary">
        <ImageIcon className="h-7 w-7" />
      </span>
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
        照片墙建设中，敬请期待
      </h2>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
        我们的照片正在整理中，很快就会在这里和你见面。
      </p>
    </GlassCard>
  )
}
