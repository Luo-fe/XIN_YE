import { memo, useState, useEffect, useRef } from 'react'
import { ImageIcon, Check } from 'lucide-react'
import clsx from 'clsx'
import { assetUrl } from '../../utils/assetUrl'

/**
 * 照片缩略图：懒加载 + 加载失败渐变占位 + CSS 悬浮动画
 *
 * 性能优化：
 * - 用 React.memo 包裹，props 不变时跳过重渲染（翻页时已挂载的项不会重新 render）
 * - 去掉 framer-motion，改用 CSS transition（避免大量 motion 组件初始化开销）
 * - onClick 改为 onPhotoClick(list, index) 稳定引用模式，避免闭包每次新建
 *
 * @param {object} props
 * @param {object} props.photo - 照片对象
 * @param {Array}  [props.list] - 所属照片列表（配合 index 传给 onPhotoClick）
 * @param {number} [props.index] - 在 list 中的索引
 * @param {function} [props.onPhotoClick] - 点击回调 (list, index) => void
 * @param {function} [props.onClick] - 直接点击回调（兼容旧用法，优先级高于 onPhotoClick）
 * @param {string} props.className - 附加类名
 * @param {boolean} [props.manageMode] - 是否处于批量管理模式
 * @param {boolean} [props.selected] - 是否被选中（管理模式下）
 * @param {function} [props.onToggleSelect] - 切换选中状态（管理模式下）
 * @param {'square'|'auto'} [props.aspect] - 宽高比
 * @param {number} [props.width] - 对齐行布局下的精确像素宽度（与 height 一起按原生比例给定，不裁剪）
 * @param {number} [props.height] - 对齐行布局下的精确像素高度
 */
function PhotoThumbInner({
  photo,
  list,
  index,
  onPhotoClick,
  onClick,
  className = '',
  manageMode = false,
  selected = false,
  onToggleSelect,
  aspect = 'auto',
  width,
  height,
}) {
  const [fallback, setFallback] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef(null)

  // 优先加载缩略图（webp 平均 18KB），原图留给灯箱大图查看
  const primarySrc = assetUrl(photo.thumbPath) || assetUrl(photo.url) || ''
  const secondarySrc = photo.url && assetUrl(photo.url) !== primarySrc ? assetUrl(photo.url) : ''
  const imgSrc = fallback === 0 ? primarySrc : fallback === 1 ? secondarySrc : ''
  const showImage = imgSrc && fallback < 2

  const handleClick = (e) => {
    if (manageMode) {
      e.stopPropagation()
      onToggleSelect?.(photo.id)
      return
    }
    if (onClick) {
      onClick()
    } else {
      onPhotoClick?.(list, index)
    }
  }

  // 切换图片源时重置 loaded；若已在缓存中（complete）则立即标记
  useEffect(() => {
    setLoaded(false)
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true)
    }
  }, [imgSrc])

  return (
    <div
      onClick={handleClick}
      style={width && height ? { width, height } : undefined}
      className={clsx(
        'group relative overflow-hidden rounded-xl',
        'border shadow-glass transition-transform duration-300 ease-out',
        'hover:-translate-y-1 hover:scale-[1.03]',
        // 对齐行布局：width/height 已按原生宽高比精确给定，无需兜底高度；
        // 无尺寸时退回 aspect-square（如地点视图）
        aspect === 'square' && !(width && height) ? 'aspect-square' : undefined,
        manageMode
          ? selected
            ? 'cursor-pointer border-primary ring-2 ring-primary/60 dark:border-primary'
            : 'cursor-pointer border-white/40 hover:border-primary/40 dark:border-white/10'
          : 'cursor-zoom-in border-white/40 dark:border-white/10',
        className,
      )}
    >
      {/* 渐变占位底色 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-aurora-pink/20 to-primary-light/25" />

      {showImage ? (
        <img
          ref={imgRef}
          src={imgSrc}
          alt="照片缩略图"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFallback((s) => s + 1)}
          className={clsx(
            'relative z-10 h-full w-full object-cover transition-all duration-500 group-hover:scale-105',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        <div className="relative z-10 flex aspect-square w-full items-center justify-center text-primary/50">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      {/* 管理模式选择框 */}
      {manageMode && (
        <div
          className={clsx(
            'absolute right-2 top-2 z-30 grid h-7 w-7 place-items-center rounded-lg border-2 backdrop-blur-md transition-all',
            selected
              ? 'border-primary bg-primary text-white shadow-lg'
              : 'border-white/60 bg-white/30 text-transparent hover:border-primary/60',
          )}
        >
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* 悬浮信息层 */}
      {!manageMode && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {photo.dateTime && (
            <span className="text-[11px] font-medium text-white/90 drop-shadow">
              {photo.dateTime}
            </span>
          )}
          {(photo.location?.district || photo.location?.city || photo.location?.province) && (
            <span className="text-[11px] text-primary-lighter drop-shadow">
              {photo.location.district || photo.location.city || photo.location.province}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 自定义 memo 比较：只在真正变化的 props 变化时重渲染
 * - photo 引用不变 → 跳过
 * - selected boolean 变化 → 重渲染
 * - manageMode 变化 → 重渲染
 */
function areEqual(prev, next) {
  return (
    prev.photo === next.photo &&
    prev.selected === next.selected &&
    prev.manageMode === next.manageMode &&
    prev.onClick === next.onClick &&
    prev.onPhotoClick === next.onPhotoClick &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.list === next.list &&
    prev.index === next.index &&
    prev.aspect === next.aspect &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.className === next.className
  )
}

const PhotoThumb = memo(PhotoThumbInner, areEqual)
export default PhotoThumb
