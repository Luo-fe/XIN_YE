import { Heart } from 'lucide-react'
import { siteConfig } from '../../config/site'

// 底部毛玻璃条：站点信息 + 心形 + 年份
export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-10 border-t border-white/30 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:px-6 lg:px-10">
        <p>
          © {siteConfig.startYear}–{year} {siteConfig.siteName}
        </p>
        <p className="flex items-center gap-1.5">
          Made with
          <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
          {siteConfig.footerNote}
        </p>
      </div>
    </footer>
  )
}
