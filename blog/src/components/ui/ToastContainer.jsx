import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Toast, { TOAST_EVENT } from './Toast'

/**
 * 全局 Toast 容器，监听自定义事件并管理多条 Toast 滑入滑出
 * 固定显示在右上角，移动端自动收窄。挂载在 body 末层即可。
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (e) => {
      const { id, type, message, duration } = e.detail
      setToasts((prev) => [...prev, { id, type, message, duration }])
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [])

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            type={t.type}
            message={t.message}
            duration={t.duration}
            onClose={() => remove(t.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
