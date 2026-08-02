import { motion } from 'framer-motion'
import clsx from 'clsx'

/**
 * 骨架屏，带 shimmer 闪光动画
 * @param {number|string} props.width
 * @param {number|string} props.height
 * @param {string} props.rounded - 圆角类名
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  rounded = 'rounded-lg',
  className = '',
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden bg-white/30 dark:bg-white/10',
        rounded,
        className,
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
        initial={{ backgroundPosition: '200% 0' }}
        animate={{ backgroundPosition: '-200% 0' }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
