import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import OverviewView from './views/OverviewView'
import PlaceholderView from './views/PlaceholderView'
import SettingsView from './views/SettingsView'
import BaiduView from './views/BaiduView'
import NetEaseView from './views/NetEaseView'
import DiaryManageView from './views/DiaryManageView'
import MoodManageView from './views/MoodManageView'
import AnniversaryManageView from './views/AnniversaryManageView'
import TimelineManageView from './views/TimelineManageView'
import MomentsManageView from './views/MomentsManageView'
import SyncView from './views/SyncView'
import PhotoUploadView from './views/PhotoUploadView'
import { ToastProvider } from './components/Toast'
import { DEFAULT_NAV_KEY, findNavByKey } from './config/navigation'

const SIDEBAR_COLLAPSE_KEY = 'yn_admin_sidebar_collapsed'

function App() {
  const [activeKey, setActiveKey] = useState(DEFAULT_NAV_KEY)
  const [collapsed, setCollapsed] = useState(() => {
    // 窄屏默认收起侧边栏
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
      if (stored !== null) return stored === '1'
      return window.innerWidth < 768
    }
    return false
  })

  // 持久化折叠状态
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // 窄屏自适应：宽度变化时自动调整
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 640) setCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const currentNav = useMemo(() => findNavByKey(activeKey), [activeKey])

  // 渲染主内容区对应视图
  const renderView = () => {
    switch (currentNav.component) {
      case 'overview':
        return <OverviewView />
      case 'settings':
        return <SettingsView />
      case 'baidu':
        return <BaiduView />
      case 'netease':
        return <NetEaseView />
      case 'diaries':
        return <DiaryManageView />
      case 'moods':
        return <MoodManageView />
      case 'anniversaries':
        return <AnniversaryManageView />
      case 'timeline':
        return <TimelineManageView />
      case 'whispers':
        return <MomentsManageView />
      case 'sync':
        return <SyncView />
      case 'photos':
        return <PhotoUploadView />
      case 'placeholder':
      default:
        return <PlaceholderView title={currentNav.title} />
    }
  }

  return (
    <ToastProvider>
      {/* 多层背景系统 */}
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        {/* 第 1 层：背景图片 */}
        <div
          className="absolute inset-0 z-[-10]"
          style={{
            backgroundImage: 'url(/bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* 第 2 层：毛玻璃模糊遮罩 */}
        <div className="absolute inset-0 z-[-9] bg-white/30 dark:bg-slate-900/40 backdrop-blur-md transition-colors duration-1000" />
        {/* 第 3 层：呼吸渐变色叠加 */}
        <div
          className="absolute inset-0 z-[-8] opacity-50 dark:opacity-15"
          style={{
            background: 'linear-gradient(-45deg, #a5b4fc, #f9a8d4, #93c5fd, #c4b5fd)',
            backgroundSize: '400% 400%',
            animation: 'gradientMove 15s ease infinite',
          }}
        />
        {/* 第 4 层：装饰光晕 */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/40 dark:bg-indigo-900/20 blur-[100px] rounded-full z-[-7]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-purple-900/30 blur-[100px] rounded-full z-[-7]" />
      </div>

      <div className="flex min-h-screen w-full relative z-10">
        <Sidebar
          activeKey={activeKey}
          onSelect={setActiveKey}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={currentNav.title} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">{renderView()}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

export default App
