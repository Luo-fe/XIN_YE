import { createContext, useCallback, useEffect, useState } from 'react'

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
})

const STORAGE_KEY = 'theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // 首次访问跟随系统偏好
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // 监听系统主题变化（仅当用户未手动设置过时跟随）
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (!saved) setTheme(e.matches ? 'dark' : 'light')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
