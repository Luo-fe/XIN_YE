import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronRight, Loader2, ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import photoTimeIndex from '../../data/photo-time-index.json'
import { useMasonryLayout } from '../../utils/justified'
import PhotoThumb from './PhotoThumb'

// 每页照片数：足够大以降低翻页链条频率，又不至于一次性渲染过多节点
const MONTH_PAGE_SIZE = 120

/**
 * 时间视图：左侧 sticky 年月导航（同步预渲染，不等 manifest 加载）+ 右侧按选中月份展示照片
 *
 * 数据流：
 * - 左侧目录：直接读取打包进 JS 的 photo-time-index.json（7KB），页面打开立即可见
 * - 右侧照片：从父级传入的 photos（已加载完成的完整 manifest 派生）按月份过滤
 *   - 未加载完成时显示骨架屏
 *   - 已加载但月份无照片时显示空状态
 *
 * @param {object} props
 * @param {Array} props.photos - 已加载的照片数组（来自 useLocalPhotos.seasons）
 * @param {boolean} props.loading - 照片 manifest 是否仍在加载
 * @param {Object} [props.monthCounts] - 实时月份计数 { "2026-07": 123 }，来自父级
 *                                        （流年四季+往昔回忆合并）；提供后覆盖静态索引计数，
 *                                        照片删除/编辑后侧栏目录数量即时同步
 * @param {function} props.onPhotoClick - (photoList, index) => void 打开灯箱
 * @param {boolean} [props.manageMode]
 * @param {Set} [props.selectedIds]
 * @param {function} [props.onToggleSelect]
 * @param {function} [props.onActiveKeyChange] - 当前选中月份变化回调（供父级"全选"限定作用域）
 */
export default function TimeView({
  photos,
  loading = false,
  monthCounts,
  onPhotoClick,
  manageMode = false,
  selectedIds,
  onToggleSelect,
  onActiveKeyChange,
}) {
  // 索引：最新月份在前（已在生成时排序）。
  // manifest 加载后（monthCounts 有值）用实时计数覆盖静态索引，
  // 并隐藏已无照片的月份；加载前先用静态索引保证目录立即可见
  const monthIndex = useMemo(() => {
    if (!monthCounts || Object.keys(monthCounts).length === 0) return photoTimeIndex
    return photoTimeIndex
      .map((m) => (monthCounts[m.key] != null ? { ...m, count: monthCounts[m.key] } : m))
      .filter((m) => m.count > 0)
  }, [monthCounts])

  // 按年聚合目录
  const yearNav = useMemo(() => {
    const map = new Map()
    for (const m of monthIndex) {
      if (!map.has(m.year)) map.set(m.year, { year: m.year, months: [], total: 0 })
      const y = map.get(m.year)
      y.months.push(m)
      y.total += m.count
    }
    return [...map.values()]
  }, [monthIndex])

  // 当前选中的月份 key（默认最新月份）
  const [activeKey, setActiveKey] = useState(() => monthIndex[0]?.key || '')
  const [visibleCount, setVisibleCount] = useState(MONTH_PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // 通知父级当前月份（初始 + 切换），供批量管理"全选"限定在当前月份
  useEffect(() => {
    onActiveKeyChange?.(activeKey)
  }, [activeKey, onActiveKeyChange])

  // 切换月份：重置分页
  const handleSelectMonth = useCallback((key) => {
    setActiveKey(key)
    setVisibleCount(MONTH_PAGE_SIZE)
    setIsLoadingMore(false)
  }, [])

  // 选中月份的照片：从已加载的 photos 中过滤
  const monthPhotos = useMemo(() => {
    if (!activeKey || !photos || photos.length === 0) return []
    return photos.filter((p) => (p.dateTime || '').startsWith(activeKey))
  }, [activeKey, photos])

  const pagedPhotos = useMemo(
    () => monthPhotos.slice(0, visibleCount),
    [monthPhotos, visibleCount],
  )

  const hasMore = visibleCount < monthPhotos.length

  // ---- 列平衡瀑布流（masonry）----
  // 每列等宽、左右两端对齐；照片宽度 = 列宽、高度按原生宽高比 —— 全貌原样展示，
  // 不裁剪、不拉伸、不截取；竖图自然更高更大（统一行高会把竖图压成小窄条）。
  // 逐张放入当前最矮的列，尺寸由 manifest 原生宽高比 + 容器宽度预先算好，加载后不重排。
  const { wallRef, cols, colWidth } = useMasonryLayout(pagedPhotos)

  // 无限滚动：用回调 ref 在哨兵真正挂载时创建观察器。
  // 不能用普通 useEffect 读 sentinelRef —— AnimatePresence mode="wait" 下切换月份时，
  // 新内容要等旧内容退场后才挂载，effect 在挂载前执行会拿到 null/旧元素，观察器随之丢失，
  // 导致"加载更多"永远转圈却不再加载。回调 ref 在元素挂载/卸载时可靠触发。
  const loadingRef = useRef(false)
  loadingRef.current = isLoadingMore
  const observerRef = useRef(null)
  const sentinelCallback = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!el) return // 哨兵卸载（本月照片已全部加载完，或切换月份）
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !loadingRef.current) {
            setIsLoadingMore(true)
            setVisibleCount((c) => c + MONTH_PAGE_SIZE)
          }
        }
      },
      { rootMargin: '400px 0px', threshold: 0 },
    )
    observer.observe(el)
    observerRef.current = observer
  }, [])

  // visibleCount 变化后等待 DOM 渲染（图片占位撑开高度），然后释放 loading 状态
  useEffect(() => {
    if (!isLoadingMore) return
    const timer = setTimeout(() => setIsLoadingMore(false), 400)
    return () => clearTimeout(timer)
  }, [visibleCount, isLoadingMore])

  // 切换月份时滚回顶部
  const contentTopRef = useRef(null)
  useEffect(() => {
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeKey])

  const activeMonth = monthIndex.find((m) => m.key === activeKey)

  return (
    <div className="flex gap-6">
      {/* 左侧 sticky 年月导航：目录立即可见 */}
      <aside className="scrollbar-hide sticky top-4 hidden h-[calc(100vh-2rem)] w-48 shrink-0 overflow-y-auto pr-2 lg:block">
        <div className="mb-3 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          时间目录
        </div>
        <nav className="flex flex-col gap-3">
          {yearNav.map((y) => (
            <div key={y.year} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/15 text-[10px] font-black text-primary">
                  {String(y.year).slice(-2)}
                </span>
                {y.year} 年
                <span className="text-[10px] font-normal text-slate-400">{y.total}</span>
              </div>
              <div className="flex flex-col gap-0.5 border-l border-white/40 pl-2 dark:border-white/10">
                {y.months.map((mo) => {
                  const active = activeKey === mo.key
                  return (
                    <button
                      key={mo.key}
                      type="button"
                      onClick={() => handleSelectMonth(mo.key)}
                      className={clsx(
                        'group flex items-center gap-1 rounded-md px-2 py-1 text-left text-xs transition-all',
                        active
                          ? 'bg-primary/15 font-semibold text-primary-dark shadow-sm dark:text-primary-lighter'
                          : 'text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200',
                      )}
                    >
                      <ChevronRight
                        className={clsx(
                          'h-3 w-3 shrink-0 transition-transform',
                          active
                            ? 'text-primary'
                            : 'text-slate-300 group-hover:text-slate-400',
                        )}
                      />
                      <span className="flex-1">{mo.month} 月</span>
                      <span
                        className={clsx(
                          'rounded-full px-1.5 text-[10px] tabular-nums',
                          active
                            ? 'bg-primary/20 text-primary-dark dark:text-primary-lighter'
                            : 'text-slate-400',
                        )}
                      >
                        {mo.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* 右侧：选中月份的照片网格 */}
      <div ref={contentTopRef} className="flex min-w-0 flex-1 flex-col gap-4 scroll-mt-20">
        {/* 月份标题栏 */}
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/80 to-aurora-pink/80 text-white shadow-glass">
            <Calendar className="h-5 w-5" />
          </span>
          <div className="flex flex-col">
            <h3 className="gradient-text text-2xl font-bold tracking-tight sm:text-3xl">
              {activeMonth
                ? `${activeMonth.year} 年 ${activeMonth.month} 月`
                : '选择月份'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {loading
                ? '正在加载照片数据…'
                : monthPhotos.length > 0
                  ? `共 ${monthPhotos.length.toLocaleString()} 张照片`
                  : '该月份暂无照片'}
            </p>
          </div>
        </div>

        {/* 移动端月份选择器（隐藏左侧导航时的替代） */}
        <div className="lg:hidden">
          <select
            value={activeKey}
            onChange={(e) => handleSelectMonth(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
          >
            {monthIndex.map((m) => (
              <option key={m.key} value={m.key}>
                {m.year} 年 {m.month} 月（{m.count} 张）
              </option>
            ))}
          </select>
        </div>

        {/* 内容区 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey + (loading ? '-loading' : '-ready')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {loading ? (
              <MonthSkeleton />
            ) : monthPhotos.length === 0 ? (
              <EmptyMonth />
            ) : (
              <>
                {/* 瀑布流：每列等宽左右两端对齐，列间空隙固定；
                    照片按原生宽高比全貌展示（不裁剪、不拉伸、不截取），
                    竖图自然更高更大、横图自然更宽更矮 */}
                <div ref={wallRef} className="flex w-full items-start gap-3">
                  {cols.map((col, ci) => (
                    <div key={ci} className="flex min-w-0 flex-1 flex-col gap-3">
                      {col.map((it) => (
                        <PhotoThumb
                          key={it.photo.id || `masonry-${ci}-${it.index}`}
                          photo={it.photo}
                          width={Math.round(colWidth)}
                          height={Math.round(it.height)}
                          list={monthPhotos}
                          index={it.index}
                          onPhotoClick={onPhotoClick}
                          manageMode={manageMode}
                          selected={selectedIds?.has(it.photo.id) || false}
                          onToggleSelect={onToggleSelect}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div
                    ref={sentinelCallback}
                    className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        正在加载照片…
                      </>
                    ) : (
                      // 空闲时保持静态提示，转圈只在真正翻页加载时出现
                      <span className="text-xs text-slate-400/90 dark:text-slate-500">
                        继续下滑加载更多
                      </span>
                    )}
                  </div>
                )}

                {!hasMore && monthPhotos.length > 0 && (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    已经到底啦 · 本月共 {monthPhotos.length.toLocaleString()} 张照片
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function MonthSkeleton() {
  // 模拟对齐行的骨架：每行几块不同宽度的脉冲块，高度随行有机变化
  const widths = [
    [30, 42, 28, 22],
    [22, 34, 26, 30, 18],
    [26, 24, 40, 16, 22, 14],
    [34, 28, 24, 20],
  ]
  return (
    <div className="flex flex-col gap-3">
      {widths.map((row, ri) => (
        <div key={ri} className="flex gap-3">
          {row.map((w, ci) => (
            <div
              key={ci}
              className="animate-pulse rounded-xl bg-gradient-to-br from-primary/20 via-aurora-pink/15 to-primary-light/20"
              style={{ width: `${w}%`, height: 170 + ((ri * 37 + ci * 13) % 80) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyMonth() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/40 bg-white/30 py-16 text-center backdrop-blur-md dark:border-white/10 dark:bg-white/5">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
        <ImageIcon className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        该月份暂无照片
      </p>
    </div>
  )
}
