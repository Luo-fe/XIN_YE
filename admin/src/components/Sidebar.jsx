import { Heart, PanelLeftClose, PanelLeft } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import clsx from 'clsx'

const APP_VERSION = 'v0.1.0'

/**
 * 左侧固定侧边栏导航
 * @param {{ activeKey: string, onSelect: (key: string) => void, collapsed: boolean, onToggleCollapse: () => void }} props
 */
export default function Sidebar({ activeKey, onSelect, collapsed, onToggleCollapse }) {
  return (
    <aside
      className={clsx(
        'glass-card z-30 flex shrink-0 flex-col border-r border-white/50 transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* 顶部：标题 + logo 占位 */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-primary via-primary-light to-aurora-pink shadow-glow">
          <Heart className="h-5 w-5 text-white" fill="white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="gradient-text truncate text-base font-bold leading-tight">
              情侣博客管理后台
            </h1>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Couple Blog Admin
            </p>
          </div>
        )}
      </div>

      {/* 折叠按钮 */}
      <button
        onClick={onToggleCollapse}
        className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white/50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/10"
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed && <span>收起</span>}
      </button>

      {/* 导航列表 */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-hide">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.key === activeKey
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-primary to-aurora-pink text-white shadow-glow'
                  : 'text-gray-600 hover:bg-white/60 hover:text-primary dark:text-gray-300 dark:hover:bg-white/10',
                collapsed && 'justify-center',
              )}
            >
              <Icon
                className={clsx(
                  'h-5 w-5 shrink-0 transition-transform',
                  active ? 'scale-110' : 'group-hover:scale-110',
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* 底部：版本号 */}
      <div className="border-t border-white/40 px-4 py-3 dark:border-white/10">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
            <span>{APP_VERSION}</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              本地模式
            </span>
          </div>
        ) : (
          <div className="text-center text-[10px] text-gray-400">{APP_VERSION}</div>
        )}
      </div>
    </aside>
  )
}
