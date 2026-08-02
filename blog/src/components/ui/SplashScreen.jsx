import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { siteConfig } from '../../config/site'
import { assetUrl } from '../../utils/assetUrl'

/**
 * 开机闪屏
 * - 仅在首次访问（sessionStorage.hasSeenSplash 未设置）时显示
 * - 2.2s 后自动关闭：头像光环旋转 + 作者名 + INITIALIZING SYSTEM + 进度条动画
 * - 用 AnimatePresence 控制闪屏层显隐，正文始终可见（不使用 visibility:hidden 那套 CSS）
 */
export default function SplashScreen() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const seen = sessionStorage.getItem('hasSeenSplash') === 'true'
    if (!seen) {
      setShow(true)
      const timer = window.setTimeout(() => {
        setShow(false)
        sessionStorage.setItem('hasSeenSplash', 'true')
      }, 2200)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-white dark:bg-slate-950"
        >
          <div className="relative z-10 flex flex-col items-center">
            {/* 头像 + 旋转光环 */}
            <div className="relative mb-8 h-24 w-24">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-[3px]"
              />
              <div className="relative h-full w-full rounded-full bg-white p-1.5 shadow-xl dark:bg-slate-900">
                <img
                  src={assetUrl('/icon.png')}
                  alt="芋泥椰奶"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">
              {siteConfig.author}
            </h1>
            <p className="mb-12 text-[10px] font-black tracking-[0.5em] text-slate-400">
              INITIALIZING SYSTEM
            </p>

            {/* 进度条 */}
            <div className="relative h-[1.5px] w-40 bg-slate-200 dark:bg-slate-800">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.8, ease: 'easeInOut' }}
                className="absolute left-0 top-0 h-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
