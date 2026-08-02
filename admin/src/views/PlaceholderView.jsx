import { Construction } from 'lucide-react'

/**
 * 通用占位视图（未实现的页面暂用此组件）
 * @param {{ title?: string }} props
 */
export default function PlaceholderView({ title }) {
  return (
    <div className="glass-card flex min-h-[60vh] flex-col items-center justify-center rounded-3xl p-10 text-center">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-tr from-primary/20 to-aurora-pink/20">
        <Construction className="h-9 w-9 text-primary" />
      </div>
      <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        {title ? `${title} · 开发中` : '开发中'}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        该模块正在紧锣密鼓地开发中，敬请期待。
        后续将在此提供完整的内容管理能力。
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-full bg-amber-50/70 px-4 py-1.5 text-xs font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        功能规划中
      </div>
    </div>
  )
}
