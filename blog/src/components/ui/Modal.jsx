import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyLock'

/**
 * 模态框：淡入 + 缩放，背景毛玻璃遮罩，ESC / 点击遮罩关闭
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {string} props.title
 */
export default function Modal({ open, onClose, children, title, className = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    // 引用计数式滚动锁：与移动菜单/灯箱同时打开时互不干扰
    lockBodyScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockBodyScroll()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <motion.div
            className={clsx(
              'relative z-10 w-full max-w-lg rounded-2xl border p-6 shadow-glass backdrop-blur-xl',
              'bg-white/70 border-white/50 dark:bg-white/10 dark:border-white/20',
              'max-h-[90vh] overflow-y-auto',
              className,
            )}
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="gradient-text text-xl font-bold">{title}</h3>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/40 dark:text-gray-300 dark:hover:bg-white/10"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
