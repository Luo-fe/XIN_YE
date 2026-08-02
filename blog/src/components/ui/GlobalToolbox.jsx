import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Shuffle, Sun, Moon, Grid, X } from 'lucide-react'
import { ThemeContext } from './ThemeProvider'
import { useContext } from 'react'
import useDiaries from '../../hooks/useDiaries'
import { toast } from './Toast'

/**
 * 全局工具箱（左下角悬浮）
 * - 主开关按钮 + 展开面板，3 个工具：回到顶部 / 随机文章 / 主题切换
 * - 位置：bottom-20 left-6（避开 FloatingPlayer 右下角 + DanmakuBackground 关闭按钮 bottom-6 left-6）
 * - z-[9998]（低于 ClickEffect 的 z-[9999]，但 ClickEffect pointer-events:none 不冲突）
 */
export default function GlobalToolbox() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, toggleTheme } = useContext(ThemeContext)
  const navigate = useNavigate()
  const { diaries, loading } = useDiaries()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info('已回到顶部')
  }

  const goRandomDiary = () => {
    if (loading) {
      toast.info('日记加载中…')
      return
    }
    if (!diaries.length) {
      toast.warning('暂无可跳转的日记')
      return
    }
    const pick = diaries[Math.floor(Math.random() * diaries.length)]
    navigate(`/diaries/${pick.slug}`)
    toast.success(`随机跳转：${pick.title}`)
    setIsOpen(false)
  }

  const handleTheme = () => {
    toggleTheme()
    toast.info(theme === 'dark' ? '已切换至浅色' : '已切换至深色')
  }

  const tools = [
    { id: 'top', name: '顶部', icon: ArrowUp, action: scrollToTop },
    { id: 'random', name: '随机', icon: Shuffle, action: goRandomDiary },
    { id: 'theme', name: theme === 'dark' ? '浅色' : '深色', icon: theme === 'dark' ? Sun : Moon, action: handleTheme },
  ]

  return (
    <div className="fixed bottom-20 left-6 z-[9998] flex flex-col items-start gap-3">
      {/* 展开面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            style={{ transformOrigin: 'bottom left' }}
            className="mb-2 flex w-44 flex-col gap-2 rounded-3xl border border-white/40 bg-white/70 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-800/80"
          >
            <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <span>工具箱</span>
              <button
                onClick={() => setIsOpen(false)}
                className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                aria-label="关闭工具箱"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={t.action}
                  className="flex items-center gap-2 rounded-2xl bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-primary hover:text-white dark:bg-slate-700/50 dark:text-slate-200"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.name}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 悬浮主开关 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`grid h-11 w-11 place-items-center rounded-full border border-white/40 shadow-xl backdrop-blur-xl transition-all duration-500 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'rotate-45 bg-primary text-white'
            : 'bg-white/70 text-slate-700 dark:border-white/10 dark:bg-slate-800/80 dark:text-white'
        }`}
        title={isOpen ? '关闭工具箱' : '打开工具箱'}
        aria-label={isOpen ? '关闭工具箱' : '打开工具箱'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Grid className="h-5 w-5" />}
      </button>
    </div>
  )
}
