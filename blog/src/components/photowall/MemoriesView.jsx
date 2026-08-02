import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Heart } from 'lucide-react'
import { GlassCard } from '../ui'
import { useJustifiedLayout } from '../../utils/justified'
import PhotoThumb from './PhotoThumb'

/**
 * 往昔回忆视图：展示仅有修改时间（无拍摄时间）的照片
 * 这些照片无法归入精确时间线，单独成页，按修改时间排序
 * @param {object} props
 * @param {Array} props.photos - 往昔回忆照片列表
 * @param {function} props.onPhotoClick - (photoList, index) => void
 * @param {boolean} [props.manageMode] - 批量管理模式
 * @param {Set} [props.selectedIds] - 已选中的照片 ID 集合
 * @param {function} [props.onToggleSelect] - (id) => void 切换选中
 */
export default function MemoriesView({
  photos,
  onPhotoClick,
  manageMode = false,
  selectedIds,
  onToggleSelect,
}) {
  const sorted = useMemo(() => {
    // 按修改时间升序（旧→新）
    return [...photos].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  }, [photos])
  // 行优先对齐行布局：不裁剪、原生比例、全貌可见（与时间视图一致）
  const { wallRef, rows } = useJustifiedLayout(sorted)

  if (sorted.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-aurora-pink/30 text-primary">
          <Heart className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          每张照片都有它的故事
        </h2>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          这里收藏着那些丢失了拍摄时间的旧时光，等待被重新发现。
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
          <Clock className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xl font-bold tracking-tight text-slate-700 dark:text-slate-100">
            往昔回忆
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {sorted.length} 张旧时光 · 仅记录于文件修改时间
          </span>
        </div>
      </motion.div>

      {/* 行优先对齐行：每行有机高度，剩余宽度动态分配进空隙，左右两端对齐；照片按原生比例显示，不裁剪 */}
      <div ref={wallRef} className="flex w-full flex-col gap-3">
        {rows.map((row, ri) => {
          const base = row.items.length > 0 ? sorted.indexOf(row.items[0].photo) : 0
          return (
            <div
              key={ri}
              className={row.items.length === 1 ? 'flex justify-center' : 'flex'}
              style={{ gap: Math.round(row.gap * 10) / 10 }}
            >
              {row.items.map((it, ii) => {
                const idx = base + ii
                return (
                  <motion.div
                    key={it.photo.id || `photo-${ri}-${ii}`}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.4, delay: (idx % 12) * 0.03 }}
                  >
                    <PhotoThumb
                      photo={it.photo}
                      width={Math.round(it.width)}
                      height={Math.round(row.height)}
                      onClick={() => onPhotoClick?.(sorted, idx)}
                      manageMode={manageMode}
                      selected={selectedIds?.has(it.photo.id) || false}
                      onToggleSelect={onToggleSelect}
                    />
                  </motion.div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
