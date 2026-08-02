import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import moments from '../../data/moments.json'

/**
 * 弹幕背景：PC 端全屏漂浮弹幕，可关闭
 * - 仅在 md 及以上屏幕显示（移动端隐藏，避免性能负担）
 * - 弹幕内容来自 src/data/moments.json 的真实碎碎念
 * - 关闭状态写入 localStorage，下次访问不再显示（可手动重开）
 */
export default function DanmakuBackground() {
  const list = useMemo(
    () => (Array.isArray(moments) ? moments.map((m) => m.text).filter(Boolean) : []),
    [],
  )
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (localStorage.getItem('danmaku-closed') === '1') {
      setVisible(false)
    }
  }, [])

  // 仅生成一次弹幕布局，避免每次渲染重算
  const danmakus = useMemo(() => {
    if (!list.length) return []
    const count = 6
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      text: list[Math.floor(Math.random() * list.length)],
      top: Math.random() * 70 + 10, // 10% - 80%
      duration: Math.random() * 12 + 18, // 18s - 30s
      delay: Math.random() * 12, // 0 - 12s 错峰
      size: Math.random() * 4 + 14, // 14px - 18px
    }))
  }, [list])

  const handleClose = () => {
    setVisible(false)
    localStorage.setItem('danmaku-closed', '1')
  }

  const handleReopen = () => {
    localStorage.removeItem('danmaku-closed')
    setVisible(true)
  }

  if (!mounted || list.length === 0) return null

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden md:block"
            aria-hidden="true"
          >
            {danmakus.map((item) => (
              <span
                key={item.id}
                className="absolute select-none whitespace-nowrap font-bold tracking-wider text-slate-700/20 dark:text-white/10"
                style={{
                  top: `${item.top}%`,
                  left: 0,
                  fontSize: `${item.size}px`,
                  // animation-fill-mode: backwards 让延迟期间应用 0% 关键帧（位于屏幕外右侧），避免弹幕卡在左侧 visible
                  animation: `danmaku-float-left ${item.duration}s linear ${item.delay}s infinite backwards`,
                }}
              >
                {item.text}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 关闭/重开按钮（PC 端可见） */}
      <div className="fixed bottom-6 left-6 z-[9998] hidden md:block">
        {visible ? (
          <button
            type="button"
            onClick={handleClose}
            title="关闭弹幕"
            aria-label="关闭弹幕"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-white/60 text-slate-600 shadow-glass backdrop-blur-md transition-all hover:bg-primary hover:text-white dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReopen}
            title="开启弹幕"
            aria-label="开启弹幕"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-white/60 text-primary shadow-glass backdrop-blur-md transition-all hover:bg-primary hover:text-white dark:border-white/10 dark:bg-slate-800/70 dark:text-primary-lighter"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  )
}
