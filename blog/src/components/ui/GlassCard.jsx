import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

/**
 * 毛玻璃卡片容器
 * @param {object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.className - 附加类名
 * @param {function} props.onClick - 点击回调
 * @param {boolean} props.hover - 是否开启悬浮上浮效果
 */
const GlassCard = forwardRef(function GlassCard(
  { children, className = '', onClick, hover = false, ...props },
  ref,
) {
  const interactive = typeof onClick === 'function'

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      whileHover={hover ? { y: -6, scale: 1.01, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.14)' } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={clsx(
        'rounded-3xl border backdrop-blur-xl shadow-glass',
        'bg-white/40 dark:bg-slate-800/50',
        'border-white/40 dark:border-white/10',
        interactive && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
})

export default GlassCard
