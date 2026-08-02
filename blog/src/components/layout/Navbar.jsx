import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { siteConfig } from '../../config/site'
import { useTheme } from '../../hooks/useTheme'
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyLock'

// 固定顶部毛玻璃导航栏：滚动向下隐藏、向上显示；激活项高亮+小圆点；移动端汉堡菜单
export default function Navbar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [showNav, setShowNav] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  // 上次滚动位置存 ref：监听器只绑定一次，避免每次滚动都重建（高频滚动卡顿）
  const lastScrollYRef = useRef(0)

  // 滚动方向控制显隐
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 80) {
        setShowNav(false)
      } else {
        setShowNav(true)
      }
      lastScrollYRef.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 路由切换时关闭移动菜单
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // 移动菜单展开时锁定背景滚动（引用计数式，与模态框/灯箱互不干扰）
  useEffect(() => {
    if (mobileOpen) lockBodyScroll()
    else unlockBodyScroll()
    return () => unlockBodyScroll()
  }, [mobileOpen])

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 transition-transform duration-500',
          'border-b border-white/20 dark:border-white/5',
          'bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm',
          showNav ? 'translate-y-0' : '-translate-y-full',
        )}
      >
        <div className="mx-auto flex h-16 w-[90%] max-w-6xl items-center justify-between px-4 sm:px-[30px]">
          {/* 站点标题 */}
          <Link
            to="/"
            className="text-xl font-black tracking-tighter text-slate-800 transition-colors hover:text-primary dark:text-white dark:hover:text-primary-lighter"
          >
            {siteConfig.navTitle}
            {siteConfig.navSuffix && (
              <span className="mx-1 text-primary">{siteConfig.navSuffix}</span>
            )}
            {siteConfig.navAfter}
          </Link>

          {/* PC 端导航 */}
          <nav className="hidden items-center gap-8 text-sm font-bold md:flex">
            {siteConfig.nav.map((link) => {
              const active = isActive(link.path)
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={clsx(
                    'relative py-1 transition-colors',
                    active
                      ? 'text-primary dark:text-primary-lighter'
                      : 'text-slate-700 hover:text-primary dark:text-slate-200',
                  )}
                >
                  {link.name}
                  {active && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 animate-pulse rounded-full bg-primary"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切换主题"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/50 bg-white/50 text-primary-dark backdrop-blur-md transition-colors hover:bg-primary hover:text-white dark:border-white/20 dark:bg-white/10 dark:text-primary-lighter dark:hover:bg-primary"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* 移动端汉堡按钮 */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="菜单"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/50 bg-white/50 text-slate-700 backdrop-blur-md transition-colors hover:bg-primary hover:text-white dark:border-white/20 dark:bg-white/10 dark:text-slate-200 md:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* 移动端下拉毛玻璃菜单 */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-md md:hidden"
            />
            <motion.nav
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="fixed inset-x-3 top-[68px] z-50 rounded-2xl border border-white/30 bg-white/70 p-3 shadow-glass backdrop-blur-2xl dark:border-white/10 dark:bg-slate-800/80 md:hidden"
            >
              <div className="grid grid-cols-3 gap-2">
                {siteConfig.nav.map((link) => {
                  const active = isActive(link.path)
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={clsx(
                        'rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-white shadow-glow'
                          : 'text-slate-700 hover:bg-primary/10 hover:text-primary dark:text-slate-200',
                      )}
                    >
                      {link.name}
                    </Link>
                  )
                })}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
