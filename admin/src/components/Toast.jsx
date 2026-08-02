import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idSeq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 2600) => {
    const id = ++idSeq
    setToasts((list) => [...list, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }) {
  const { message, type } = toast
  const palette = {
    success: { Icon: CheckCircle2, color: 'text-emerald-600', ring: 'ring-emerald-200/60' },
    error: { Icon: AlertCircle, color: 'text-rose-600', ring: 'ring-rose-200/60' },
    info: { Icon: Info, color: 'text-primary', ring: 'ring-primary-lighter/60' },
  }
  const { Icon, color, ring } = palette[type] || palette.info

  return (
    <div
      className={`glass-card pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-glass ring-1 ${ring} animate-[float_0.3s_ease-out]`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
      <p className="flex-1 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
        {message}
      </p>
      <button
        onClick={onClose}
        className="shrink-0 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // 兜底：在 provider 外使用时退化为 noop，避免抛错打断渲染
    return { showToast: () => 0, dismiss: () => {} }
  }
  return ctx
}
