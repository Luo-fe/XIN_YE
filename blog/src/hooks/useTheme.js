import { useContext } from 'react'
import { ThemeContext } from '../components/ui/ThemeProvider'

/** 读取当前主题与切换方法，需在 ThemeProvider 内使用 */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

export default useTheme
