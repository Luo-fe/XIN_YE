import { useEffect, useState } from 'react'
import { Cloud } from 'lucide-react'
import clsx from 'clsx'
import { getAuthStatus } from '../api'

/**
 * 顶部栏：显示当前页面标题 + 百度网盘授权状态指示器
 * @param {{ title: string }} props
 */
export default function TopBar({ title }) {
  const [baiduAuthorized, setBaiduAuthorized] = useState(false)

  useEffect(() => {
    let cancelled = false
    const checkStatus = async () => {
      const status = await getAuthStatus()
      if (!cancelled) setBaiduAuthorized(Boolean(status.authorized))
    }
    checkStatus()
    // 每 60 秒刷新一次
    const timer = setInterval(checkStatus, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <header className="glass-card sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/40 px-6 py-4 dark:border-white/10">
      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold text-gray-800 dark:text-gray-100">
          {title}
        </h2>
        <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
          欢迎回来，今天也要记录美好瞬间 💕
        </p>
      </div>

      {/* 百度网盘授权状态指示器 */}
      <div
        className={clsx(
          'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur',
          baiduAuthorized
            ? 'bg-emerald-50/70 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-gray-100/70 text-gray-500 dark:bg-white/10 dark:text-gray-400',
        )}
        title={baiduAuthorized ? '百度网盘已授权' : '百度网盘未授权'}
      >
        <Cloud className="h-4 w-4" />
        <span
          className={clsx(
            'h-2 w-2 rounded-full',
            baiduAuthorized ? 'bg-emerald-500' : 'bg-gray-400',
          )}
        />
        <span>{baiduAuthorized ? '网盘已授权' : '网盘未授权'}</span>
      </div>
    </header>
  )
}
