import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import clsx from 'clsx'

const TOAST_EVENT = 'couple-toast-show'

const CONFIG = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-400',
    cls: 'text-emerald-600 dark:text-emerald-300',
  },
  error: {
    icon: XCircle,
    bar: 'bg-rose-400',
    cls: 'text-rose-600 dark:text-rose-300',
  },
  warning: {
    icon: AlertTriangle,
    bar: 'bg-amber-400',
    cls: 'text-amber-600 dark:text-amber-300',
  },
  info: {
    icon: Info,
    bar: 'bg-primary',
    cls: 'text-primary-dark dark:text-primary-lighter',
  },
}

/**
 * 单条 Toast 通知
 * @param {object} props
 * @param {'success'|'error'|'warning'|'info'} props.type
 * @param {string} props.message
 * @param {number} props.duration - 自动关闭时长(ms)
 * @param {function} props.onClose
 */
export default function Toast({ type = 'info', message, duration = 3000, onClose }) {
  const cfg = CONFIG[type] || CONFIG.info
  const Icon = cfg.icon
  // onClose 每次父级渲染都是新闭包；用 ref 存最新值，
  // 计时器只随 duration 变化重置（连续弹多条 toast 时旧条不会被无限延长）
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current?.(), duration)
    return () => window.clearTimeout(timer)
  }, [duration])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={clsx(
        'pointer-events-auto flex w-72 items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-glass backdrop-blur-xl sm:w-80',
        'bg-white/70 border-white/50 dark:bg-white/10 dark:border-white/20',
      )}
    >
      <span className={clsx('absolute left-0 top-0 h-full w-1', cfg.bar)} />
      <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', cfg.cls)} />
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">{message}</p>
      <button
        onClick={() => onClose?.()}
        className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

/**
 * 触发一条 Toast（任意位置可调用）
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} message
 * @param {number} [duration]
 */
function emit(type, message, duration) {
  const detail = { id: Date.now() + Math.random(), type, message, duration }
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }))
}

export const toast = {
  success: (message, duration) => emit('success', message, duration),
  error: (message, duration) => emit('error', message, duration),
  warning: (message, duration) => emit('warning', message, duration),
  info: (message, duration) => emit('info', message, duration),
}

export { TOAST_EVENT }
