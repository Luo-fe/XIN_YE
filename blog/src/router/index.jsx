import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from '../components/layout/Layout'
import Home from '../pages/Home'

// 路由级懒加载：除首页外所有页面按需加载，大幅减小首包体积。
// echarts（地图/心情图表）、aplayer（音乐）、react-markdown（日记/富文本）
// 等重依赖只在使用到的页面里才被下载。
const DiaryList = lazy(() => import('../pages/DiaryList'))
const DiaryDetail = lazy(() => import('../pages/DiaryDetail'))
const ChatAnalysis = lazy(() => import('../pages/ChatAnalysis'))
const Mood = lazy(() => import('../pages/Mood'))
const Anniversary = lazy(() => import('../pages/Anniversary'))
const Timeline = lazy(() => import('../pages/Timeline'))
const Moments = lazy(() => import('../pages/Moments'))
const PhotoWall = lazy(() => import('../pages/PhotoWall'))
const Music = lazy(() => import('../pages/Music'))
const About = lazy(() => import('../pages/About'))
const NotFound = lazy(() => import('../pages/NotFound'))

/** 懒加载兜底：极光风格的轻量加载指示 */
function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-slate-400">加载中…</span>
      </div>
    </div>
  )
}

// 路由表：Layout 包裹所有页面，统一极光背景与导航/页脚
// basename 取自 Vite 的 import.meta.env.BASE_URL（等于 vite.config 的 base）
// 本地开发为 '/'，GitHub Pages 子路径部署时为 '/<repo-name>/'，自动匹配
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        {
          path: 'diaries',
          element: (
            <Suspense fallback={<PageFallback />}>
              <DiaryList />
            </Suspense>
          ),
        },
        {
          path: 'diaries/:slug',
          element: (
            <Suspense fallback={<PageFallback />}>
              <DiaryDetail />
            </Suspense>
          ),
        },
        {
          path: 'chat',
          element: (
            <Suspense fallback={<PageFallback />}>
              <ChatAnalysis />
            </Suspense>
          ),
        },
        {
          path: 'moods',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Mood />
            </Suspense>
          ),
        },
        {
          path: 'anniversaries',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Anniversary />
            </Suspense>
          ),
        },
        {
          path: 'timeline',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Timeline />
            </Suspense>
          ),
        },
        {
          path: 'moments',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Moments />
            </Suspense>
          ),
        },
        {
          path: 'photos',
          element: (
            <Suspense fallback={<PageFallback />}>
              <PhotoWall />
            </Suspense>
          ),
        },
        {
          path: 'music',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Music />
            </Suspense>
          ),
        },
        {
          path: 'about',
          element: (
            <Suspense fallback={<PageFallback />}>
              <About />
            </Suspense>
          ),
        },
        {
          path: '*',
          element: (
            <Suspense fallback={<PageFallback />}>
              <NotFound />
            </Suspense>
          ),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)

export default router
