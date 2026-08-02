import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-primary to-primary-light text-white shadow-glow hover:shadow-[0_0_40px_rgba(139,92,246,0.55)] border border-white/30',
  ghost:
    'bg-white/40 dark:bg-white/10 text-primary-dark dark:text-white border border-white/50 dark:border-white/20 hover:bg-white/60 dark:hover:bg-white/20',
  danger:
    'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_8px_30px_rgba(244,63,94,0.35)] border border-white/30',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
}

/**
 * 玻璃态按钮，带涟漪点击效果
 * @param {object} props
 * @param {'primary'|'ghost'|'danger'} props.variant
 * @param {'sm'|'md'|'lg'} props.size
 */
export default function GlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const [ripples, setRipples] = useState([])

  const addRipple = useCallback((e) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const size = Math.max(rect.width, rect.height) * 1.2
    const id = Date.now() + Math.random()
    setRipples((prev) => [...prev, { id, x, y, size }])
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 600)
  }, [disabled])

  return (
    <motion.button
      type={type}
      onClick={onClick}
      onPointerDown={addRipple}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden font-medium backdrop-blur-md transition-colors select-none',
        VARIANTS[variant],
        SIZES[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0.5, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="pointer-events-none absolute rounded-full bg-white/50"
            style={{ left: r.x - r.size / 2, top: r.y - r.size / 2, width: r.size, height: r.size }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  )
}
