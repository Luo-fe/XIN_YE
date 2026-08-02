import { Outlet } from 'react-router-dom'
import {
  ThemeProvider,
  AuroraBackground,
  DanmakuBackground,
  ClickEffect,
  GlobalToolbox,
  SplashScreen,
  ToastContainer,
} from '../ui'
import Navbar from './Navbar'
import Footer from './Footer'
import PageTransition from './PageTransition'
import FloatingPlayer from '../FloatingPlayer'
import { useSiteBackground } from '../../hooks/useSiteBackgrounds'

// 顶层布局：闪屏 + 极光背景 + 弹幕背景 + 点击特效 + 导航 + 主内容(Outlet) + 悬浮播放器 + 全局工具箱 + 页脚 + Toast 容器
export default function Layout() {
  // 网站背景：每次打开随机抽取一张（后台配置，照片墙可一键设置）
  const { backgroundUrl } = useSiteBackground()
  return (
    <ThemeProvider>
      <SplashScreen />
      <AuroraBackground url={backgroundUrl} />
      <DanmakuBackground />
      <ClickEffect />
      <ToastContainer />
      <div className="relative flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-24 sm:px-6 lg:px-10">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <Footer />
        <FloatingPlayer />
        <GlobalToolbox />
      </div>
    </ThemeProvider>
  )
}
