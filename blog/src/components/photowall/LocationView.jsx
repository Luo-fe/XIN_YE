import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { GlassCard } from '../ui'
import { groupByLocation } from '../../hooks/usePhotos'
import PhotoThumb from './PhotoThumb'

/**
 * 地点视图：按省/市分组列表展示，每组带省/市名 + 照片数 + 缩略图网格
 * @param {object} props
 * @param {Array} props.photos
 * @param {function} props.onPhotoClick - (photoList, index) => void 打开灯箱
 * @param {boolean} [props.manageMode] - 批量管理模式
 * @param {Set} [props.selectedIds] - 已选中的照片 ID 集合
 * @param {function} [props.onToggleSelect] - (id) => void 切换选中
 */
export default function LocationView({
  photos,
  onPhotoClick,
  manageMode = false,
  selectedIds,
  onToggleSelect,
}) {
  const groups = useMemo(() => groupByLocation(photos), [photos])

  return (
    <div className="flex flex-col gap-6">
      {groups.map((prov, gi) => (
        <motion.div
          key={prov.province}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: gi * 0.04 }}
        >
          <GlassCard className="p-5">
            {/* 省标题 */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
                <MapPin className="h-4 w-4" />
              </span>
              <h3 className="gradient-text text-xl font-bold tracking-tight sm:text-2xl">
                {prov.province}
              </h3>
              <span className="rounded-full border border-white/40 bg-white/40 px-2.5 py-0.5 text-xs font-medium text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                {prov.photos.length} 张
              </span>
            </div>

            {/* 城市分组 */}
            <div className="flex flex-col gap-5">
              {prov.cities.map((city) => (
                <div key={city.city} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {city.city}
                    <span className="text-xs text-slate-400">
                      · {city.photos.length} 张
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {city.photos.map((p, i) => (
                      <PhotoThumb
                        key={p.id || `${city.city}-${i}`}
                        photo={p}
                        className="aspect-square"
                        onClick={() => onPhotoClick?.(city.photos, i)}
                        manageMode={manageMode}
                        selected={selectedIds?.has(p.id) || false}
                        onToggleSelect={onToggleSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  )
}
